const express = require('express');
const Notification = require('../models/Notification');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin only — most recent notifications first, for the bell dropdown
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
  res.json(notifications);
});

// Admin only — just the unread count, for the small red badge on the bell.
// Kept separate from the list above so the dashboard can poll this cheaply
// every few seconds without re-fetching and re-rendering the whole list.
router.get('/unread-count', requireAuth, requireRole('admin'), async (req, res) => {
  const count = await Notification.countDocuments({ read: false });
  res.json({ count });
});

// Admin only — mark a single notification as read (e.g. when clicked)
router.put('/:id/read', requireAuth, requireRole('admin'), async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { read: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  res.json(notification);
});

// Admin only — "Mark all read" button in the dropdown
router.put('/read-all', requireAuth, requireRole('admin'), async (req, res) => {
  await Notification.updateMany({ read: false }, { read: true });
  res.json({ message: 'All notifications marked as read.' });
});

// Admin only — "Clear All" button in the dropdown. Deletes every
// notification instead of just marking them read.
router.delete('/clear-all', requireAuth, requireRole('admin'), async (req, res) => {
  await Notification.deleteMany({});
  res.json({ message: 'All notifications cleared.' });
});

module.exports = router;