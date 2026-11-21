'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to backend/.env');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Health: verifies the PostgreSQL connection
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unreachable', error: err.message });
  }
});

app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Central error handler: maps PostgreSQL error codes to HTTP statuses
const PG_ERRORS = {
  '22P02': [400, 'Malformed identifier'],
  '23502': [400, 'Missing required field'],
  '23503': [400, 'Referenced record does not exist'],
  '23505': [409, 'Record already exists'],
  '23514': [400, 'Value violates a data rule'],
};

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const mapped = PG_ERRORS[err.code];
  const status = mapped ? mapped[0] : err.status || 500;
  const message = mapped ? mapped[1] : status < 500 ? err.message : 'Internal server error';

  if (status >= 500) console.error('[error]', err);
  return res.status(status).json({ error: message });
});

const server = app.listen(PORT, () => {
  console.log(`ZeroOut API listening on http://localhost:${PORT}`);
});

async function shutdown() {
  server.close();
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
