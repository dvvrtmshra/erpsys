const express = require('express');
const pool = require('../../db');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, s.name AS awarded_supplier_name
      FROM tenders t
      LEFT JOIN suppliers s ON s.id = t.awarded_supplier_id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, s.name AS awarded_supplier_name
      FROM tenders t LEFT JOIN suppliers s ON s.id = t.awarded_supplier_id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { title, description, deadline, budget } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO tenders (title, description, deadline, budget) VALUES ($1,$2,$3,$4) RETURNING *',
      [title, description, deadline || null, budget || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { title, description, status, deadline, budget, awarded_supplier_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tenders SET title=$1, description=$2, status=$3, deadline=$4, budget=$5,
       awarded_supplier_id=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [title, description, status, deadline || null, budget || null, awarded_supplier_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tenders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
