const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    question: { type: String, required: true, trim: true },
    options: {
      type: [String],
      required: true,
      validate: (v) => Array.isArray(v) && v.length >= 2
    },
    // index into `options` array that is correct — never sent to the client
    correctIndex: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('QuizQuestion', quizQuestionSchema);
