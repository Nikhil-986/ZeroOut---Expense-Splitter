'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (raw) => String(raw || '').trim().toLowerCase();
const UPI_RE = /^[\w.\-]{2,255}@[A-Za-z]{2,64}$/;
const publicUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  upi_id: row.upi_id || null,
  created_at: row.created_at,
});
const signToken = (user) =>
  jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

// POST /auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Name must be 2–100 characters' });
    }
    if (!EMAIL_RE.test(email) || email.length > 255) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: 'Password must be 6–72 characters' });
    }

    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, upi_id, created_at`,
      [name, email, password_hash]
    );

    const user = publicUser(rows[0]);
    return res.status(201).json({ access_token: signToken(user), user });
  } catch (err) {
    return next(err);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!EMAIL_RE.test(email) || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, upi_id, created_at FROM users WHERE email = $1',
      [email]
    );
    const row = rows[0];
    const ok = row && (await bcrypt.compare(password, row.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = publicUser(row);
    return res.json({ access_token: signToken(user), user });
  } catch (err) {
    return next(err);
  }
});

// GET /auth/me (protected)
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, upi_id, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(publicUser(rows[0]));
  } catch (err) {
    return next(err);
  }
});

// PATCH /auth/me (protected): save or clear the caller's UPI ID.
// An empty or null value clears it.
router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    const raw = req.body?.upi_id;
    const upi = raw === null || raw === undefined ? '' : String(raw).trim();

    if (upi !== '' && !UPI_RE.test(upi)) {
      return res.status(400).json({ error: 'Enter a UPI ID like name@bank' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET upi_id = $2
        WHERE id = $1
    RETURNING id, name, email, upi_id, created_at`,
      [req.user.userId, upi === '' ? null : upi]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(publicUser(rows[0]));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
