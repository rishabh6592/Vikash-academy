const express = require('express');
const ClassModel = require('../models/ClassModel');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public — the marketing site's "Our Classes" section reads this with no login
router.get('/', async (req, res) => {
  const classes = await ClassModel.find().sort({ createdAt: 1 });
  res.json(classes);
});

// Admin only — add a class
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, timing, days, fee } = req.body;
    if (!name || !timing || !days || fee === undefined) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const cls = await ClassModel.create({ name, timing, days, fee });
    res.status(201).json(cls);
  } catch (err) {
    res.status(500).json({ message: 'Could not create class.' });
  }
});

// Admin only — edit a class (name, timing, days, fee — supports partial updates
// so the inline auto-save fields in the dashboard keep working)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const cls = await ClassModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!cls) return res.status(404).json({ message: 'Class not found.' });
    res.json(cls);
  } catch (err) {
    res.status(500).json({ message: 'Could not update class.' });
  }
});

// Admin only — delete a class, but only if no student is enrolled in it
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const inUse = await Student.exists({ classId: req.params.id });
    if (inUse) {
      return res.status(409).json({
        message: 'This class has students enrolled in it. Move or remove those students before deleting this class.'
      });
    }
    const cls = await ClassModel.findByIdAndDelete(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Class not found.' });
    await Payment.deleteMany({ classId: req.params.id });
    res.json({ message: 'Class deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete class.' });
  }
});

module.exports = router;
