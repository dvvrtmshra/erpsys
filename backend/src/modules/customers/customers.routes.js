const express = require('express');
const pool = require('../../db');
const { requireAuth } = require('../../middleware/auth');
const { dbError } = require('../../utils/dbError');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: dbError(err) });
  }
});

router.post('/', async (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO customers (name, contact_person, email, phone, address) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, contact_person, email, phone, address]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.put('/:id', async (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });
  try {
    const { rows } = await pool.query(
      'UPDATE customers SET name=$1, contact_person=$2, email=$3, phone=$4, address=$5 WHERE id=$6 RETURNING *',
      [name, contact_person, email, phone, address, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Customer not found.' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: dbError(err) });
  }
});

module.exports = router;
