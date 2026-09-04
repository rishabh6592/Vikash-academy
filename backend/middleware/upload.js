const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Files ab local disk pe nahi, seedha Cloudinary pe (private mode me) jaayengi.
// "type: authenticated" ka matlab hai koi bhi direct link se file nahi khol sakta,
// sirf signed URL se hi access milega (jo hum admin route me banayenge).
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'id-documents',
    resource_type: 'auto',
    type: 'authenticated',
    public_id: `${req.user.id}-${Date.now()}`,
  }),
});

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function fileFilter(req, file, cb) {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, WEBP or PDF files are allowed.'));
  }
}

const uploadIdDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

module.exports = { uploadIdDocument };