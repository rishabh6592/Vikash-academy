const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const { requireAuth } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

function signToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

/* ---------------- Admin login ---------------- */
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const admin = await Admin.findOne({ username: username.trim().toLowerCase() });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const ok = await admin.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = signToken(admin._id, 'admin');
    res.json({
      token,
      user: { id: admin._id, username: admin.username, role: 'admin' }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

/* ---------------- Student login ---------------- */
// Students log in with roll number + password (matches the original UI's fields)
router.post('/student/login', async (req, res) => {
  try {
    const { rollNo, password } = req.body;
    if (!rollNo || !password) {
      return res.status(400).json({ message: 'Roll number and password are required.' });
    }

    const student = await Student.findOne({ rollNo: rollNo.trim() });
    if (!student) {
      return res.status(401).json({ message: 'Invalid roll number or password.' });
    }

    const ok = await student.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid roll number or password.' });
    }

    const token = signToken(student._id, 'student');
    res.json({
      token,
      user: { id: student._id, name: student.name, rollNo: student.rollNo, role: 'student' }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

/* ---------------- Who am I (used by frontend to restore session) ---------------- */
router.get('/me', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    const admin = await Admin.findById(req.user.id).select('-passwordHash');
    if (!admin) return res.status(404).json({ message: 'Account not found.' });
    return res.json({ id: admin._id, username: admin.username, role: 'admin' });
  }

  const student = await Student.findById(req.user.id).select('-passwordHash');
  if (!student) return res.status(404).json({ message: 'Account not found.' });

  // If this student has an ID document on record, double-check it still
  // actually exists on Cloudinary (it may have been removed manually from
  // the Cloudinary dashboard, outside our app). If it's gone, clear the
  // stale fields here so the student correctly sees "not uploaded" instead
  // of a false "uploaded" status.
  if (student.idDocument) {
    try {
      await cloudinary.api.resource(student.idDocument, {
        resource_type: student.idDocumentResourceType || 'image',
        type: 'authenticated'
      });
    } catch (err) {
      // Cloudinary throws (404) when the resource doesn't exist
      if (err.http_code === 404) {
        student.idDocument = '';
        student.idDocumentResourceType = 'image';
        student.idDocumentOriginalName = '';
        student.idDocumentUploadedAt = null;
        await student.save();
      }
      // any other error (network hiccup, etc.) — leave the record as-is,
      // don't wrongly wipe a valid document over a temporary failure
    }
  }

  res.json({ ...student.toObject(), role: 'student' });
});

module.exports = router;