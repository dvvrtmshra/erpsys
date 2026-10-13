const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY username'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required.' });
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  if (!password) return res.status(400).json({ error: 'Password is required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, username, email, role, created_at',
      [username, email, hash, role || 'viewer']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { username, email, role, password } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required.' });
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  if (password && password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    let query, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET username=$1, email=$2, role=$3, password_hash=$4 WHERE id=$5 RETURNING id, username, email, role';
      params = [username, email, role, hash, req.params.id];
    } else {
      query = 'UPDATE users SET username=$1, email=$2, role=$3 WHERE id=$4 RETURNING id, username, email, role';
      params = [username, email, role, req.params.id];
    }
    const { rows } = await pool.query(query, params);
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

module.exports = router;
