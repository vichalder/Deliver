const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all devices
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM devices');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single device
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Device not found' });
    } else {
      res.json(rows[0]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new device
router.post('/', async (req, res) => {
  const { name, type } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO devices (name, type, status) VALUES (?, ?, "active")',
      [name, type]
    );
    res.status(201).json({ id: result.insertId, name, type, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update device location
router.post('/:id/location', async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;
  try {
    await pool.query(
      'UPDATE devices SET last_latitude = ?, last_longitude = ?, last_seen = NOW() WHERE id = ?',
      [latitude, longitude, id]
    );
    await pool.query(
      'INSERT INTO device_history (device_id, latitude, longitude) VALUES (?, ?, ?)',
      [id, latitude, longitude]
    );
    res.status(200).json({ message: 'Location updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get device history
router.get('/:id/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM device_history WHERE device_id = ? ORDER BY timestamp DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;