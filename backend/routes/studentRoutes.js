const express = require('express');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadIdDocument } = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

// Admin only — list all students (with optional ?classId= filter)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  const students = await Student.find(filter).select('-passwordHash').sort({ createdAt: -1 });
  res.json(students);
});

// Admin only — add a student. Roll number must be unique.
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, rollNo, classId, fatherName, phone, password, address, joinDate } = req.body;
    if (!name || !rollNo || !classId || !phone || !password || !joinDate) {
      return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    const existing = await Student.findOne({ rollNo: rollNo.trim() });
    if (existing) {
      return res.status(409).json({ message: 'A student with this roll number already exists.' });
    }

    const passwordHash = await Student.hashPassword(password);
    const student = await Student.create({
      name, rollNo, classId, fatherName, phone, address, joinDate, passwordHash
    });

    const { passwordHash: _omit, ...safe } = student.toObject();
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ message: 'Could not add student.' });
  }
});

// Student only — upload their own ID document (Aadhar card, etc.).
// Re-uploading replaces the old file on Cloudinary so we don't pile up copies.
router.post(
  '/me/id-document',
  requireAuth,
  requireRole('student'),
  uploadIdDocument.single('idDocument'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Please choose a file to upload.' });
      }

      const student = await Student.findById(req.user.id);
      if (!student) return res.status(404).json({ message: 'Student not found.' });

      // Remove the previous file from Cloudinary, if there was one
      if (student.idDocument) {
        const oldResourceType = student.idDocumentResourceType || 'image';
        cloudinary.uploader
          .destroy(student.idDocument, { resource_type: oldResourceType, type: 'authenticated' })
          .catch(() => {}); // best-effort — ignore if it's already gone
      }

      // req.file.filename = Cloudinary public_id
      // req.file.format = Cloudinary-detected format (e.g. "pdf", "jpg") —
      // required later to build a working signed URL for 'raw' files.
      // req.file.version = Cloudinary asset version — required alongside
      // format/public_id to reliably resolve a signed URL later. Without it,
      // Cloudinary intermittently fails to locate 'authenticated' resources.
      //
      // Must match the same logic used in middleware/upload.js when deciding
      // resource_type at upload time — otherwise the admin's "View ID" will
      // build a signed URL with the wrong resource_type and 404.
      student.idDocument = req.file.filename;
      student.idDocumentResourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
      student.idDocumentFormat = req.file.format || '';
      student.idDocumentVersion = req.file.version;
      student.idDocumentOriginalName = req.file.originalname;
      student.idDocumentUploadedAt = new Date();
      await student.save();

      res.json({
        message: 'Document uploaded.',
        idDocumentOriginalName: student.idDocumentOriginalName,
        idDocumentUploadedAt: student.idDocumentUploadedAt
      });
    } catch (err) {
      res.status(500).json({ message: 'Could not upload document.' });
    }
  },
  // Multer errors (wrong file type, too large) land here instead of the normal handler above
  (err, req, res, next) => {
    res.status(400).json({ message: err.message || 'Upload failed.' });
  }
);

// Admin only — stream a student's uploaded ID document.
// Deliberately NOT a static file route: this checks the admin's token first,
// generates a short-lived signed Cloudinary URL server-side, fetches the file,
// and streams it back — the signed URL itself is never exposed to the client.
router.get('/:id/id-document', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student || !student.idDocument) {
      return res.status(404).json({ message: 'No document uploaded for this student.' });
    }

    const resourceType = student.idDocumentResourceType || 'image';
    const signedUrl = cloudinary.url(student.idDocument, {
      resource_type: resourceType,
      type: 'authenticated',
      sign_url: true,
      secure: true,
      // Passing version makes URL resolution reliable — without it Cloudinary
      // can intermittently fail to locate 'authenticated' resources.
      version: student.idDocumentVersion,
      // 'raw' resource types need the exact format to resolve correctly —
      // without it, Cloudinary can't locate the file and the URL 404s.
      format: student.idDocumentFormat || undefined
    });

    const cloudRes = await fetch(signedUrl);
    if (!cloudRes.ok) {
      console.log('Cloudinary fetch failed:', cloudRes.status, await cloudRes.text());
      return res.status(404).json({ message: 'File is missing kindly contact student to upload it again.' });
    }

    res.setHeader('Content-Type', cloudRes.headers.get('content-type') || 'application/octet-stream');
    const buffer = Buffer.from(await cloudRes.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: 'Could not load document.' });
  }
});

// Admin only — edit a student. Password only changes if a new one is sent.
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, rollNo, classId, fatherName, phone, password, address, joinDate } = req.body;
    const update = { name, rollNo, classId, fatherName, phone, address, joinDate };

    if (password && password.trim()) {
      update.passwordHash = await Student.hashPassword(password);
    }

    const student = await Student.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    }).select('-passwordHash');

    if (!student) return res.status(404).json({ message: 'Student not found.' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: 'Could not update student.' });
  }
});

// Admin only — delete a student and their payment history
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    await Payment.deleteMany({ studentId: req.params.id });
    if (student.idDocument) {
      const resourceType = student.idDocumentResourceType || 'image';
      cloudinary.uploader
        .destroy(student.idDocument, { resource_type: resourceType, type: 'authenticated' })
        .catch(() => {});
    }
    res.json({ message: 'Student deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete student.' });
  }
});

module.exports = router;