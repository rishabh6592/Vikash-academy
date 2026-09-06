// One-time seed script. Run once with: node scripts/seedQuizQuestions.js
// Adds sample Maths/Science/Current Affairs questions to your MongoDB.
// Safe to edit the questions array below and re-run — it clears old
// sample questions with the same subjects before re-inserting.

require('dotenv').config();
const connectDB = require('../config/db');
const QuizQuestion = require('../models/QuizQuestion');

const questions = [
  // ---- Maths ----
  { subject: 'Maths', question: '7 x 8 = ?', options: ['54', '56', '58', '64'], correctIndex: 1 },
  { subject: 'Maths', question: 'Square root of 144 is?', options: ['10', '11', '12', '14'], correctIndex: 2 },
  { subject: 'Maths', question: '15% of 200 is?', options: ['20', '25', '30', '35'], correctIndex: 2 },
  { subject: 'Maths', question: 'Sum of angles in a triangle is?', options: ['90°', '180°', '270°', '360°'], correctIndex: 1 },
  { subject: 'Maths', question: 'HCF of 12 and 18 is?', options: ['2', '3', '6', '9'], correctIndex: 2 },
  { subject: 'Maths', question: 'Next prime number after 7 is?', options: ['8', '9', '10', '11'], correctIndex: 3 },
  { subject: 'Maths', question: 'Perimeter of a square with side 5cm?', options: ['10cm', '15cm', '20cm', '25cm'], correctIndex: 2 },
  { subject: 'Maths', question: '12 ÷ 4 x 2 = ?', options: ['6', '1.5', '3', '24'], correctIndex: 0 },
  { subject: 'Maths', question: 'Value of pi (approx)?', options: ['3.10', '3.14', '3.41', '3.44'], correctIndex: 1 },
  { subject: 'Maths', question: '9 squared is?', options: ['18', '72', '81', '99'], correctIndex: 2 },

  // ---- Science ----
  { subject: 'Science', question: 'Which gas do plants release during photosynthesis?', options: ['CO2', 'Oxygen', 'Nitrogen', 'Hydrogen'], correctIndex: 1 },
  { subject: 'Science', question: 'The powerhouse of the cell is?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Cytoplasm'], correctIndex: 2 },
  { subject: 'Science', question: 'Water boils at what temperature (°C)?', options: ['90', '100', '110', '120'], correctIndex: 1 },
  { subject: 'Science', question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1 },
  { subject: 'Science', question: 'Sound travels fastest in?', options: ['Air', 'Water', 'Vacuum', 'Steel'], correctIndex: 3 },
  { subject: 'Science', question: 'Which organ pumps blood in the human body?', options: ['Lungs', 'Heart', 'Liver', 'Kidney'], correctIndex: 1 },
  { subject: 'Science', question: 'The chemical symbol for Gold is?', options: ['Gd', 'Go', 'Au', 'Ag'], correctIndex: 2 },
  { subject: 'Science', question: 'Which force keeps us on the ground?', options: ['Magnetism', 'Friction', 'Gravity', 'Tension'], correctIndex: 2 },
  { subject: 'Science', question: 'Humans have how many pairs of chromosomes?', options: ['21', '23', '25', '46'], correctIndex: 1 },
  { subject: 'Science', question: 'Which is the largest organ of the human body?', options: ['Liver', 'Skin', 'Heart', 'Brain'], correctIndex: 1 },

  // ---- Current Affairs ----
  { subject: 'Current Affairs', question: 'Which is the national bird of India?', options: ['Parrot', 'Peacock', 'Sparrow', 'Crow'], correctIndex: 1 },
  { subject: 'Current Affairs', question: 'How many states are there in India?', options: ['26', '27', '28', '29'], correctIndex: 2 },
  { subject: 'Current Affairs', question: 'Who is known as the Father of the Nation in India?', options: ['Nehru', 'Gandhi', 'Bose', 'Patel'], correctIndex: 1 },
  { subject: 'Current Affairs', question: 'National sport of India is?', options: ['Cricket', 'Hockey', 'Football', 'Kabaddi'], correctIndex: 1 },
  { subject: 'Current Affairs', question: 'Which is the longest river in India?', options: ['Yamuna', 'Godavari', 'Ganga', 'Narmada'], correctIndex: 2 },
  { subject: 'Current Affairs', question: 'Capital of India is?', options: ['Mumbai', 'Kolkata', 'Delhi', 'Chennai'], correctIndex: 2 },
  { subject: 'Current Affairs', question: 'India got independence in which year?', options: ['1945', '1946', '1947', '1950'], correctIndex: 2 },
  { subject: 'Current Affairs', question: 'Which is the smallest state of India by area?', options: ['Sikkim', 'Goa', 'Tripura', 'Nagaland'], correctIndex: 1 },
  { subject: 'Current Affairs', question: 'National currency symbol of India is?', options: ['Rs', '₹', 'INR', 'Re'], correctIndex: 1 },
  { subject: 'Current Affairs', question: 'Who is the current PM of India?', options: ['Narendra Modi', 'Rahul Gandhi', 'Amit Shah', 'Yogi Adityanath'], correctIndex: 0 }
];

(async () => {
  try {
    await connectDB();
    const subjects = [...new Set(questions.map((q) => q.subject))];
    await QuizQuestion.deleteMany({ subject: { $in: subjects } });
    await QuizQuestion.insertMany(questions);
    console.log(`Seeded ${questions.length} questions across: ${subjects.join(', ')}`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
})();
