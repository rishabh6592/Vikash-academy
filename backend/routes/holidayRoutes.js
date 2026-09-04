const express = require('express');
const Holiday = require('../models/Holiday');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public — the marketing site's holiday notice board reads this with no login
router.get('/', async (req, res) => {
  const holidays = await Holiday.find().sort({ date: 1 });
  res.json(holidays);
});

// Admin only
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date || !reason) return res.status(400).json({ message: 'Date and reason are required.' });
    const holiday = await Holiday.create({ date, reason });
    res.status(201).json(holiday);
  } catch (err) {
    res.status(500).json({ message: 'Could not add holiday.' });
  }
});

// Admin only
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) return res.status(404).json({ message: 'Holiday not found.' });
    res.json({ message: 'Holiday removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove holiday.' });
  }
});

module.exports = router;
