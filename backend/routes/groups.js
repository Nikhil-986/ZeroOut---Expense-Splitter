'use strict';

const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPLIT_TYPES = ['EQUAL', 'EXACT', 'PERCENTAGE'];
const MAX_AMOUNT_PAISE = 9999999999; // NUMERIC(10,2) ceiling = 99,999,999.99

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.expose = true;
  }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toPaise = (v) => Math.round(Number(v) * 100);
const round2 = (x) => Math.round(x * 100) / 100;
const paiseToSql = (p) => (p / 100).toFixed(2);

const formatExpense = (r) => ({
  id: r.id,
  group_id: r.group_id,
  paid_by: r.paid_by,
  description: r.description,
  split_type: r.split_type,
  created_at: r.created_at,
  amount_paise: toPaise(r.amount),
});

const formatSettlement = (r) => ({
  id: r.id,
  group_id: r.group_id,
  paid_by: r.paid_by,
  paid_to: r.paid_to,
  created_at: r.created_at,
  amount_paise: toPaise(r.amount),
});

const formatSplit = (r) => ({
  expense_id: r.expense_id,
  user_id: r.user_id,
  amount_owed_paise: toPaise(r.amount_owed),
  percentage: r.percentage === null ? null : Number(r.percentage),
});

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function loadMembers(groupId) {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, u.upi_id, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.joined_at ASC, u.id ASC`,
    [groupId]
  );
  return rows;
}

// Verifies the caller belongs to :id. Non-members get 404 to avoid leaking existence.
async function groupAccess(req, res, next) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: 'Invalid group id' });
  }
  try {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/* ------------------------------------------------------------------ *
 * Split engines (integer paise, deterministic remainder distribution)
 * ------------------------------------------------------------------ */
function splitEqual(totalPaise, userIds) {
  const n = userIds.length;
  const base = Math.floor(totalPaise / n);
  const rem = totalPaise % n;
  return userIds.map((user_id, i) => ({
    user_id,
    amount_owed_paise: base + (i < rem ? 1 : 0),
    percentage: round2(100 / n),
  }));
}

function splitExact(totalPaise, splits) {
  const rows = splits.map((s) => {
    const paise = toPaise(s.amount);
    if (!Number.isInteger(paise) || paise < 0) {
      throw new ValidationError('Each exact amount must be a number ≥ 0');
    }
    return { user_id: String(s.user_id), amount_owed_paise: paise, percentage: 0 };
  });

  const sum = rows.reduce((a, r) => a + r.amount_owed_paise, 0);
  if (sum !== totalPaise) {
    throw new ValidationError(
      `Exact shares add up to ₹${(sum / 100).toFixed(2)} but the bill is ₹${(totalPaise / 100).toFixed(2)}`
    );
  }
  rows.forEach((r) => {
    r.percentage = round2((r.amount_owed_paise * 100) / totalPaise);
  });
  return rows;
}

function splitPercentage(totalPaise, splits) {
  const hundredths = splits.map((s) => {
    const h = Math.round(Number(s.percentage) * 100);
    if (!Number.isFinite(h) || h < 0 || h > 10000) {
      throw new ValidationError('Each percentage must be between 0 and 100');
    }
    return h;
  });

  const sum = hundredths.reduce((a, b) => a + b, 0);
  if (sum !== 10000) {
    throw new ValidationError(`Percentages must total 100% (currently ${(sum / 100).toFixed(2)}%)`);
  }

  let allocated = 0;
  return splits.map((s, i) => {
    const isLast = i === splits.length - 1;
    const amount = isLast
      ? totalPaise - allocated
      : Math.floor((totalPaise * hundredths[i]) / 10000);
    allocated += amount;
    return {
      user_id: String(s.user_id),
      amount_owed_paise: amount,
      percentage: hundredths[i] / 100,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Max-Heap debt simplification
 * ------------------------------------------------------------------ */
class MaxHeap {
  constructor(compare) {
    this.heap = [];
    this.compare = compare;
  }
  size() {
    return this.heap.length;
  }
  push(item) {
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }
  _siftUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.heap[i], this.heap[parent]) <= 0) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }
  _siftDown(i) {
    const n = this.heap.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let largest = i;
      if (l < n && this.compare(this.heap[l], this.heap[largest]) > 0) largest = l;
      if (r < n && this.compare(this.heap[r], this.heap[largest]) > 0) largest = r;
      if (largest === i) break;
      [this.heap[i], this.heap[largest]] = [this.heap[largest], this.heap[i]];
      i = largest;
    }
  }
}

/**
 * Greedy max-heap settlement.
 * balances: [{ user_id, name, net_paise }]. Positive = owed money, negative = owes money.
 * Each step clears at least one party, so N people need at most N-1 transfers.
 */
function simplifyDebtsMaxHeap(balances) {
  const creditors = new MaxHeap((a, b) => a.amount - b.amount);
  const debtors = new MaxHeap((a, b) => a.amount - b.amount);

  for (const b of balances) {
    if (b.net_paise > 0) {
      creditors.push({ userId: b.user_id, name: b.name, amount: b.net_paise });
    } else if (b.net_paise < 0) {
      debtors.push({ userId: b.user_id, name: b.name, amount: -b.net_paise });
    }
  }

  const transactions = [];
  const trace = [];
  let step = 0;

  while (creditors.size() > 0 && debtors.size() > 0) {
    const c = creditors.pop();
    const d = debtors.pop();
    const transfer = Math.min(c.amount, d.amount);

    c.amount -= transfer;
    d.amount -= transfer;
    step += 1;

    transactions.push({
      from_user_id: d.userId,
      from_name: d.name,
      to_user_id: c.userId,
      to_name: c.name,
      amount_paise: transfer,
    });
    trace.push({
      step,
      from_name: d.name,
      to_name: c.name,
      transfer_paise: transfer,
      debtor_remaining_paise: d.amount,
      creditor_remaining_paise: c.amount,
    });

    if (c.amount > 0) creditors.push(c);
    if (d.amount > 0) debtors.push(d);
  }

  return { transactions, trace };
}

// Pairwise IOUs before simplification (expenses net of settlements, per pair).
function rawPairwise({ splits, payerOf, settlements, nameOf }) {
  const owe = new Map(); // "debtor|creditor" -> paise
  const add = (from, to, paise) => {
    if (!from || !to || from === to || !paise) return;
    const key = `${from}|${to}`;
    owe.set(key, (owe.get(key) || 0) + paise);
  };

  for (const s of splits) add(s.user_id, payerOf.get(s.expense_id), s.amount_owed_paise);
  for (const st of settlements) add(st.paid_by, st.paid_to, -st.amount_paise);

  const out = [];
  const seen = new Set();
  for (const [key, value] of owe) {
    if (seen.has(key)) continue;
    const [a, b] = key.split('|');
    const reverse = `${b}|${a}`;
    seen.add(key);
    seen.add(reverse);

    const net = value - (owe.get(reverse) || 0);
    if (net > 0) {
      out.push({ from_user_id: a, from_name: nameOf(a), to_user_id: b, to_name: nameOf(b), amount_paise: net });
    } else if (net < 0) {
      out.push({ from_user_id: b, from_name: nameOf(b), to_user_id: a, to_name: nameOf(a), amount_paise: -net });
    }
  }
  return out.sort((x, y) => y.amount_paise - x.amount_paise);
}

/**
 * Net Balance = (Expenses Paid + Settlements Paid) - (Splits Owed + Settlements Received)
 * All values are integer paise.
 */
function computeSummary({ members, expenses, splits, settlements }) {
  const ledger = new Map(
    members.map((m) => [
      m.user_id,
      {
        user_id: m.user_id,
        name: m.name,
        email: m.email,
        upi_id: m.upi_id || null,
        total_paid_paise: 0,
        total_owed_paise: 0,
        settlements_paid_paise: 0,
        settlements_received_paise: 0,
        net_paise: 0,
      },
    ])
  );

  const payerOf = new Map();
  for (const e of expenses) {
    payerOf.set(e.id, e.paid_by);
    const row = ledger.get(e.paid_by);
    if (row) row.total_paid_paise += e.amount_paise;
  }
  for (const s of splits) {
    const row = ledger.get(s.user_id);
    if (row) row.total_owed_paise += s.amount_owed_paise;
  }
  for (const s of settlements) {
    const payer = ledger.get(s.paid_by);
    if (payer) payer.settlements_paid_paise += s.amount_paise;
    const payee = ledger.get(s.paid_to);
    if (payee) payee.settlements_received_paise += s.amount_paise;
  }

  const rows = [...ledger.values()];
  for (const r of rows) {
    r.net_paise =
      r.total_paid_paise + r.settlements_paid_paise -
      (r.total_owed_paise + r.settlements_received_paise);
  }

  const balances = rows.map((r) => ({ user_id: r.user_id, name: r.name, net_paise: r.net_paise }));
  const { transactions, trace } = simplifyDebtsMaxHeap(balances);
  const nameOf = (id) => (ledger.get(id) || {}).name || 'Unknown';

  return {
    members: rows,
    balances,
    optimizedSettlements: transactions,
    heapTrace: trace,
    rawSettlements: rawPairwise({ splits, payerOf, settlements, nameOf }),
    expenses,
    splits,
    settlements,
    zeroSumPaise: balances.reduce((a, b) => a + b.net_paise, 0),
  };
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

// GET /groups: every group the caller belongs to
router.get('/', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.category, g.created_by, g.created_at,
            (SELECT COUNT(*)::int FROM group_members m WHERE m.group_id = g.id) AS member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
      ORDER BY g.created_at ASC`,
    [req.user.userId]
  );
  res.json(rows);
}));

// POST /groups: creates the group and enrolls the creator, atomically
router.post('/', wrap(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const category = String(req.body?.category || 'Trip').trim().slice(0, 50) || 'Trip';
  if (name.length < 2 || name.length > 150) {
    throw new ValidationError('Group name must be 2–150 characters');
  }

  const group = await withTransaction(async (client) => {
    const g = await client.query(
      `INSERT INTO groups (name, category, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, category, created_by, created_at`,
      [name, category, req.user.userId]
    );
    await client.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [g.rows[0].id, req.user.userId]
    );
    return g.rows[0];
  });

  return res.status(201).json({ ...group, member_count: 1 });
}));

// POST /groups/:id/members: add an existing user by email
router.post('/:id/members', groupAccess, wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError('A valid email is required');

  const user = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
  if (user.rowCount === 0) {
    return res.status(404).json({ error: 'No ZeroOut account exists for that email yet' });
  }

  const ins = await pool.query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)
     ON CONFLICT (group_id, user_id) DO NOTHING
     RETURNING joined_at`,
    [req.params.id, user.rows[0].id]
  );
  if (ins.rowCount === 0) {
    return res.status(409).json({ error: 'That person is already in this group' });
  }

  return res.status(201).json({
    user_id: user.rows[0].id,
    name: user.rows[0].name,
    email: user.rows[0].email,
    joined_at: ins.rows[0].joined_at,
  });
}));

// POST /groups/:id/expenses: atomic expense + splits insert
router.post('/:id/expenses', groupAccess, wrap(async (req, res) => {
  const groupId = req.params.id;
  const body = req.body || {};
  const description = String(body.description || '').trim();
  const splitType = String(body.split_type || '').toUpperCase();
  const totalPaise = toPaise(body.amount);
  const payerId = String(body.paid_by || req.user.userId);

  if (!description || description.length > 255) {
    throw new ValidationError('Description is required (max 255 characters)');
  }
  if (!SPLIT_TYPES.includes(splitType)) {
    throw new ValidationError('split_type must be EQUAL, EXACT or PERCENTAGE');
  }
  if (!Number.isInteger(totalPaise) || totalPaise <= 0 || totalPaise > MAX_AMOUNT_PAISE) {
    throw new ValidationError('Amount must be greater than ₹0 and at most ₹99,99,99,999.99');
  }

  const members = await loadMembers(groupId);
  const memberIds = new Set(members.map((m) => m.user_id));
  if (!memberIds.has(payerId)) {
    throw new ValidationError('paid_by must be a member of this group');
  }

  let shares;
  if (splitType === 'EQUAL') {
    const requested =
      Array.isArray(body.participants) && body.participants.length > 0
        ? [...new Set(body.participants.map(String))]
        : members.map((m) => m.user_id);
    if (requested.some((id) => !memberIds.has(id))) {
      throw new ValidationError('All participants must be group members');
    }
    shares = splitEqual(totalPaise, requested);
  } else {
    if (!Array.isArray(body.splits) || body.splits.length === 0) {
      throw new ValidationError(`splits[] is required for ${splitType} expenses`);
    }
    const ids = body.splits.map((s) => String(s.user_id));
    if (new Set(ids).size !== ids.length) {
      throw new ValidationError('Duplicate user in splits');
    }
    if (ids.some((id) => !memberIds.has(id))) {
      throw new ValidationError('All split users must be group members');
    }
    shares = splitType === 'EXACT'
      ? splitExact(totalPaise, body.splits)
      : splitPercentage(totalPaise, body.splits);
  }

  const expense = await withTransaction(async (client) => {
    const ins = await client.query(
      `INSERT INTO expenses (group_id, paid_by, amount, description, split_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, group_id, paid_by, amount, description, split_type, created_at`,
      [groupId, payerId, paiseToSql(totalPaise), description, splitType]
    );
    const row = ins.rows[0];

    for (const s of shares) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount_owed, percentage)
         VALUES ($1, $2, $3, $4)`,
        [row.id, s.user_id, paiseToSql(s.amount_owed_paise), Number(s.percentage).toFixed(2)]
      );
    }
    return row;
  });

  return res.status(201).json({
    ...formatExpense(expense),
    splits: shares.map((s) => ({
      user_id: s.user_id,
      amount_owed_paise: s.amount_owed_paise,
      percentage: s.percentage,
    })),
  });
}));

// POST /groups/:id/settlements: direct debt settlement
router.post('/:id/settlements', groupAccess, wrap(async (req, res) => {
  const body = req.body || {};
  const paidBy = String(body.paid_by || req.user.userId);
  const paidTo = String(body.paid_to || '');
  const amountPaise = toPaise(body.amount);

  if (!Number.isInteger(amountPaise) || amountPaise <= 0 || amountPaise > MAX_AMOUNT_PAISE) {
    throw new ValidationError('Settlement amount must be greater than ₹0');
  }
  if (paidBy === paidTo) {
    throw new ValidationError('A settlement needs two different people');
  }

  const members = await loadMembers(req.params.id);
  const memberIds = new Set(members.map((m) => m.user_id));
  if (!memberIds.has(paidBy) || !memberIds.has(paidTo)) {
    throw new ValidationError('Both parties must be group members');
  }

  const { rows } = await pool.query(
    `INSERT INTO settlements (group_id, paid_by, paid_to, amount)
     VALUES ($1, $2, $3, $4)
     RETURNING id, group_id, paid_by, paid_to, amount, created_at`,
    [req.params.id, paidBy, paidTo, paiseToSql(amountPaise)]
  );
  return res.status(201).json(formatSettlement(rows[0]));
}));

// GET /groups/:id/summary: balances, optimized plan, heap trace, raw ledger
router.get('/:id/summary', groupAccess, wrap(async (req, res) => {
  const groupId = req.params.id;

  const [members, expenses, splits, settlements] = await Promise.all([
    loadMembers(groupId),
    pool.query(
      `SELECT id, group_id, paid_by, amount, description, split_type, created_at
         FROM expenses WHERE group_id = $1 ORDER BY created_at DESC`,
      [groupId]
    ),
    pool.query(
      `SELECT s.expense_id, s.user_id, s.amount_owed, s.percentage
         FROM expense_splits s
         JOIN expenses e ON e.id = s.expense_id
        WHERE e.group_id = $1`,
      [groupId]
    ),
    pool.query(
      `SELECT id, group_id, paid_by, paid_to, amount, created_at
         FROM settlements WHERE group_id = $1 ORDER BY created_at DESC`,
      [groupId]
    ),
  ]);

  const summary = computeSummary({
    members,
    expenses: expenses.rows.map(formatExpense),
    splits: splits.rows.map(formatSplit),
    settlements: settlements.rows.map(formatSettlement),
  });

  return res.json(summary);
}));

module.exports = router;
