const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    if (!req.user || !req.user.id) {
      throw new Error('User not authenticated — cannot upload file.');
    }
    return {
      folder: 'id-documents',
      resource_type: 'auto',
      type: 'authenticated', // koi direct link se nahi khulega, sirf signed URL se
      public_id: `${req.user.id}-${Date.now()}`,
    };
  },
});

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function fileFilter(req, file, cb) {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPG, PNG, WEBP or PDF files are allowed.'));
  }
}

const uploadIdDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — phone camera photos ke liye
});

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File 10MB se badi hai. Chhoti file try karein.' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
}

module.exports = { uploadIdDocument, handleUploadError };