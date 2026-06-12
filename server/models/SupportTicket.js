const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
  {
    railwayTicketId: { type: String, index: true },
    userId: { type: String, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, trim: true },
    message: { type: String, required: true },
    reply: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
