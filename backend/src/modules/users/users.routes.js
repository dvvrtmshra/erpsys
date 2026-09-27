const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY username'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, username, email, role, created_at',
      [username, email, hash, role || 'viewer']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { username, email, role, password } = req.body;
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
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
