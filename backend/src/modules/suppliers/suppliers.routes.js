const express = require('express');
const pool = require('../../db');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, contact_person, email, phone, address]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE suppliers SET name=$1, contact_person=$2, email=$3, phone=$4, address=$5 WHERE id=$6 RETURNING *',
      [name, contact_person, email, phone, address, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
