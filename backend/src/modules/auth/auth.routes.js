const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = $1',
      [username]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.username = user.username;
    res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
  } catch (err) {
    const { dbError } = require('../../utils/dbError');
    res.status(500).json({ error: dbError(err) });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ id: req.session.userId, username: req.session.username, role: req.session.userRole });
});

module.exports = router;
