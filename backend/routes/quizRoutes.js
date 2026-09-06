const express = require('express');
const jwt = require('jsonwebtoken');
const QuizQuestion = require('../models/QuizQuestion');
const QuizAttempt = require('../models/QuizAttempt');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/*
  In-memory store of active quiz sessions.
  Keeps the correct answer indices server-side only, so they never reach
  the browser until after submit — this is what stops answers being read
  from the network tab or shared between students.
  NOTE: this resets if the server restarts (fine — a session only needs to
  live for the few minutes someone is taking that one quiz).
*/
const quizSessions = {};

// Clear sessions older than 30 minutes so this map doesn't grow forever
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  Object.keys(quizSessions).forEach((token) => {
    if (quizSessions[token].createdAt < cutoff) delete quizSessions[token];
  });
}, 10 * 60 * 1000);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Like requireAuth, but doesn't reject the request if there's no/invalid
// token — a guest hitting /submit should still go through. If a valid
// token IS present, req.user gets set just like requireAuth would.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch (err) {
      // expired/invalid token — proceed as guest rather than blocking
    }
  }
  next();
}

/* ---------------- List subjects ---------------- */
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await QuizQuestion.distinct('subject');
    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ message: 'Could not load subjects.' });
  }
});

/* ---------------- Fetch a quiz set (answers stripped, options shuffled) ---------------- */
router.get('/questions', async (req, res) => {
  try {
    const { subject, count } = req.query;
    if (!subject) return res.status(400).json({ message: 'Subject is required.' });

    const pool = await QuizQuestion.find({ subject });
    if (!pool.length) {
      return res.status(404).json({ message: 'No questions found for this subject.' });
    }

    const n = Math.min(parseInt(count, 10) || 5, pool.length);
    const picked = shuffle(pool).slice(0, n);

    const clientQuestions = [];
    const correctAnswers = [];

    picked.forEach((q) => {
      const optionsWithIndex = q.options.map((text, idx) => ({ text, idx }));
      const shuffledOptions = shuffle(optionsWithIndex);
      const correctPositionInShuffled = shuffledOptions.findIndex(
        (o) => o.idx === q.correctIndex
      );

      clientQuestions.push({
        id: q._id.toString(),
        q: q.question,
        options: shuffledOptions.map((o) => o.text)
      });
      correctAnswers.push({ id: q._id.toString(), correctIndex: correctPositionInShuffled });
    });

    const sessionToken = `qz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    quizSessions[sessionToken] = { subject, correctAnswers, createdAt: Date.now() };

    res.json({ sessionToken, subject, questions: clientQuestions });
  } catch (err) {
    res.status(500).json({ message: 'Could not load quiz.' });
  }
});

/* ---------------- Submit answers — score computed server-side ---------------- */
router.post('/submit', optionalAuth, async (req, res) => {
  try {
    const { sessionToken, guestName, answers } = req.body;
    const session = quizSessions[sessionToken];
    if (!session) {
      return res.status(400).json({ message: 'Quiz session expired. Please restart.' });
    }

    let score = 0;
    const review = session.correctAnswers.map((correct) => {
      const given = (answers || []).find((a) => a.id === correct.id);
      const isCorrect = !!given && given.selectedIndex === correct.correctIndex;
      if (isCorrect) score++;
      return { id: correct.id, correct: isCorrect };
    });

    const total = session.correctAnswers.length;

    await QuizAttempt.create({
      student: req.user ? req.user.id : null,
      guestName: req.user ? null : (guestName || 'Guest'),
      subject: session.subject,
      score,
      total
    });

    delete quizSessions[sessionToken];

    res.json({ score, total, review });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit quiz.' });
  }
});

/* ---------------- Logged-in student's own quiz history ---------------- */
router.get('/history', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students have quiz history.' });
    }
    const history = await QuizAttempt.find({ student: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: 'Could not load history.' });
  }
});

/* ---------------- This week's top 5 (registered students only) ---------------- */
router.get('/leaderboard', async (req, res) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const attempts = await QuizAttempt.find({
      student: { $ne: null },
      createdAt: { $gte: oneWeekAgo }
    }).populate('student', 'name rollNo');

    const bestByStudent = {};
    attempts.forEach((a) => {
      if (!a.student) return; // student account may have been deleted since
      const pct = a.score / a.total;
      const key = a.student._id.toString();
      if (!bestByStudent[key] || pct > bestByStudent[key].pct) {
        bestByStudent[key] = {
          pct,
          score: a.score,
          total: a.total,
          name: a.student.name,
          rollNo: a.student.rollNo
        };
      }
    });

    const leaderboard = Object.values(bestByStudent)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5)
      .map(({ pct, ...rest }) => rest);

    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ message: 'Could not load leaderboard.' });
  }
});

module.exports = router;
