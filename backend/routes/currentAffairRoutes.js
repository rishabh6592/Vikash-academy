const express = require('express');
const CurrentAffair = require('../models/CurrentAffair');

const router = express.Router();

// Public — no login required. Returns the last 30 days of current affairs,
// most recent first. The 30-day cleanup itself happens in the fetch job
// (jobs/fetchCurrentAffairs.js); this route just reads whatever's left.
router.get('/', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const items = await CurrentAffair.find({ publishedAt: { $gte: thirtyDaysAgo } })
      .sort({ publishedAt: -1 })
      .limit(100);
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Could not load current affairs.' });
  }
});

module.exports = router;