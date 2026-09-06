const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    // null for guest attempts — only registered students get this set
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    guestName: { type: String, default: null },
    subject: { type: String, required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true }
  },
  { timestamps: true }
);

// Speeds up "this student's history" and "this week's leaderboard" queries
quizAttemptSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
