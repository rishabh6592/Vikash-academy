const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, unique: true, trim: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassModel', required: true },
    fatherName: { type: String, trim: true, default: '' },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    address: { type: String, trim: true, default: '' },
    joinDate: { type: String, required: true }, // stored as YYYY-MM-DD to match the <input type="date"> the frontend sends

    // ID document (Aadhar card, etc.) the student uploads from their dashboard.
    // idDocument stores the Cloudinary public_id (not a local filename).
    // The actual file lives on Cloudinary under type: 'authenticated', so it's
    // never publicly accessible — only fetched through the protected admin
    // route, which generates a short-lived signed URL from this public_id.
    idDocument: { type: String, default: '' },
    idDocumentResourceType: { type: String, enum: ['image', 'raw'], default: 'image' }, // 'raw' for PDFs
    idDocumentOriginalName: { type: String, default: '' },
    idDocumentUploadedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

studentSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

studentSchema.statics.hashPassword = function (plainPassword) {
  return bcrypt.hash(plainPassword, 10);
};

module.exports = mongoose.model('Student', studentSchema);