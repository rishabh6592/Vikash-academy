const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassModel', required: true },
    month: { type: String, required: true }, // YYYY-MM
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' },
    paidDate: { type: String, default: '' } // YYYY-MM-DD
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
