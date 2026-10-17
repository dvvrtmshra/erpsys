const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

const router = express.Router();
router.use(requireAuth);

const VALID_ROLES = ['admin', 'manager', 'viewer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUserFields({ username, email, password, role }, isNew = false) {
  if (!username || username.trim().length === 0) return 'Username is required.';
  if (username.length > 100) return 'Username must be 100 characters or fewer.';
  if (!email || email.trim().length === 0) return 'Email is required.';
  if (email.length > 255) return 'Email must be 255 characters or fewer.';
  if (!EMAIL_RE.test(email)) return 'Email address is not valid.';
  if (isNew && !password) return 'Password is required.';
  if (password) {
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password.length > 72) return 'Password must be 72 characters or fewer.';
  }
  if (role !== undefined && role !== null && !VALID_ROLES.includes(role)) {
    return `Role must be one of: ${VALID_ROLES.join(', ')}.`;
  }
  return null;
}

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
  const validErr = validateUserFields({ username, email, password, role }, true);
  if (validErr) return res.status(400).json({ error: validErr });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, username, email, role, created_at',
      [username.trim(), email.trim(), hash, role || 'viewer']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { username, email, role, password } = req.body;
  const validErr = validateUserFields({ username, email, password, role });
  if (validErr) return res.status(400).json({ error: validErr });
  // Role is required on update to prevent accidental null
  if (!role) return res.status(400).json({ error: 'Role is required.' });
  // Prevent admin from demoting their own account
  if (parseInt(req.params.id) === req.session.userId && role !== req.session.userRole) {
    return res.status(400).json({ error: 'You cannot change your own role.' });
  }
  try {
    let query, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET username=$1, email=$2, role=$3, password_hash=$4 WHERE id=$5 RETURNING id, username, email, role';
      params = [username.trim(), email.trim(), role, hash, req.params.id];
    } else {
      query = 'UPDATE users SET username=$1, email=$2, role=$3 WHERE id=$4 RETURNING id, username, email, role';
      params = [username.trim(), email.trim(), role, req.params.id];
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
