const mongoose = require('mongoose');

/* Simple notification feed for the admin dashboard bell icon.
   Currently only admin-facing (there is one admin account), so there is
   no "forUserId" — every notification is meant for whoever is logged in
   as admin. If multiple admin accounts are added later, add a
   `forAdminId` field and filter by it in the routes. */
const notificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    type: { type: String, enum: ['payment', 'general'], default: 'general' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
