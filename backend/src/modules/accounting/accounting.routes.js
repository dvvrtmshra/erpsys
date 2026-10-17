const express = require('express');
const pool = require('../../db');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM accounting_entries ORDER BY entry_date DESC, created_at DESC'
    );
    const income = rows.filter(r => r.type === 'income').reduce((s, r) => s + parseFloat(r.amount), 0);
    const expense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + parseFloat(r.amount), 0);
    res.json({ entries: rows, summary: { income, expense, balance: income - expense } });
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { type, amount, description, reference, entry_date } = req.body;
  if (!type) return res.status(400).json({ error: 'Entry type (income/expense) is required.' });
  if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ error: 'A valid amount is required.' });
  if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Type must be "income" or "expense".' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO accounting_entries (type, amount, description, reference, entry_date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [type, amount, description, reference, entry_date || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM accounting_entries WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Entry not found.' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

module.exports = router;
