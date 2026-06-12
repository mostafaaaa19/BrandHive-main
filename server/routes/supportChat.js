const express = require('express');
const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');

const router = express.Router();

const dbReady = () => mongoose.connection.readyState === 1;

router.post('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Support storage unavailable (database offline)' });
  }

  const { userId, email, fullName, message, railwayTicketId } = req.body;
  if (!email || !message?.trim()) {
    return res.status(400).json({ message: 'email and message are required' });
  }

  try {
    const ticket = await SupportTicket.create({
      userId: userId || undefined,
      email: String(email).toLowerCase().trim(),
      fullName: fullName || 'Guest',
      message: message.trim(),
      railwayTicketId: railwayTicketId || undefined,
    });

    return res.status(201).json({ data: ticket });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save support ticket' });
  }
});

router.get('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Support storage unavailable (database offline)' });
  }

  const { userId, email } = req.query;
  if (!userId && !email) {
    return res.status(400).json({ message: 'userId or email is required' });
  }

  try {
    const query = userId
      ? { userId: String(userId) }
      : { email: String(email).toLowerCase().trim() };

    const tickets = await SupportTicket.find(query).sort({ createdAt: 1 });
    return res.json({ data: tickets });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load support tickets' });
  }
});

router.post('/:railwayTicketId/reply', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Support storage unavailable (database offline)' });
  }

  const { reply, status, email, fullName, message, userId } = req.body;
  if (!reply?.trim()) {
    return res.status(400).json({ message: 'reply is required' });
  }

  try {
    let ticket = await SupportTicket.findOneAndUpdate(
      { railwayTicketId: req.params.railwayTicketId },
      {
        reply: reply.trim(),
        status: status || 'resolved',
      },
      { new: true }
    );

    if (!ticket && email && message?.trim()) {
      ticket = await SupportTicket.create({
        railwayTicketId: req.params.railwayTicketId,
        userId: userId || undefined,
        email: String(email).toLowerCase().trim(),
        fullName: fullName || 'Customer',
        message: message.trim(),
        reply: reply.trim(),
        status: status || 'resolved',
      });
    }

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found locally' });
    }

    return res.json({ data: ticket });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save reply' });
  }
});

module.exports = router;
