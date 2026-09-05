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
      // Coaching center ke students kai tarah ki files bhej sakte hain
      // (PDF, image, doc, zip, etc.) — images ko 'image' type se store
      // karte hain (preview milta hai), baaki sab kuch 'raw' se.
      resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
      type: 'authenticated',
      public_id: `${req.user.id}-${Date.now()}`,
    };
  },
});

// Ab koi bhi file type allowed hai — sirf size limit restrict karega.
function fileFilter(req, file, cb) {
  cb(null, true);
}

const uploadIdDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
});

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File 15MB se badi hai. Chhoti file try karein.' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
}

module.exports = { uploadIdDocument, handleUploadError };