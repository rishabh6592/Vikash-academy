const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    timing: { type: String, required: true, trim: true },
    days: { type: String, required: true, trim: true },
    fee: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClassModel', classSchema, 'classes');
