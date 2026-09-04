const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    reason: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Holiday', holidaySchema);
