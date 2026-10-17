const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db');
const { requireAuth } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

const router = express.Router();

// Simple in-memory login rate limiter: max 10 attempts per 15 min per IP
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function isLoginRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_LOGIN_ATTEMPTS;
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

router.post('/login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (isLoginRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes and try again.' });
  }
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (password.length > 72) {
    return res.status(400).json({ error: 'Password must be 72 characters or fewer.' });
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
    // C-1: Regenerate session on login to prevent session fixation
    await new Promise((resolve, reject) => {
      req.session.regenerate(err => err ? reject(err) : resolve());
    });
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.username = user.username;
    clearLoginAttempts(ip);
    res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
  } catch (err) {
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

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  if (newPassword.length > 72) {
    return res.status(400).json({ error: 'New password must be 72 characters or fewer.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.session.userId]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

module.exports = router;
