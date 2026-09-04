const express = require('express');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin only — payments for a given class (dashboard's class-wise payments tab)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  const payments = await Payment.find(filter).sort({ month: -1 });
  res.json(payments);
});

// Student only — a student can see their OWN payment history, nothing else.
// This is the important part real auth buys you: req.user.id comes from the
// verified token, not from a query param the client could tamper with.
router.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  const payments = await Payment.find({ studentId: req.user.id }).sort({ month: -1 });
  res.json(payments);
});

// Admin only — add a payment entry
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { studentId, month, amount, status } = req.body;
    if (!studentId || !month || amount === undefined) {
      return res.status(400).json({ message: 'Student, month and amount are required.' });
    }
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const payment = await Payment.create({
      studentId,
      classId: student.classId,
      month,
      amount,
      status: status === 'Paid' ? 'Paid' : 'Unpaid',
      paidDate: status === 'Paid' ? new Date().toISOString().slice(0, 10) : ''
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Could not add payment entry.' });
  }
});

// Student only — student pays their own pending fee entry.
// NOTE: this marks the entry Paid directly and notifies the admin. It is a
// stand-in for a real gateway checkout — once Razorpay Key ID/Secret are
// added, this handler is where the "verify payment signature" step goes,
// right before the payment.status = 'Paid' line.
router.put('/:id/pay', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, studentId: req.user.id });
    if (!payment) return res.status(404).json({ message: 'Payment entry not found.' });
    if (payment.status === 'Paid') {
      return res.status(400).json({ message: 'This payment has already been marked as paid.' });
    }

    payment.status = 'Paid';
    payment.paidDate = new Date().toISOString().slice(0, 10);
    await payment.save();

    const student = await Student.findById(req.user.id);
    await Notification.create({
      type: 'payment',
      studentId: req.user.id,
      message: `${student ? student.name : 'A student'} paid the ${payment.month} fee (₹${payment.amount}).`
    });

    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Could not process payment.' });
  }
});

// Admin only — toggle Paid/Unpaid
router.put('/:id/toggle', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment entry not found.' });

    if (payment.status === 'Paid') {
      payment.status = 'Unpaid';
      payment.paidDate = '';
    } else {
      payment.status = 'Paid';
      payment.paidDate = new Date().toISOString().slice(0, 10);
    }
    await payment.save();
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Could not update payment status.' });
  }
});

// Admin only — delete a payment entry
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment entry not found.' });
    res.json({ message: 'Payment entry deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete payment entry.' });
  }
});

module.exports = router;
