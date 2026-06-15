const mongoose = require('mongoose');

const paymentSessionSchema = new mongoose.Schema(
  {
    brandhiveOrderId: { type: String, required: true, index: true },
    paymobOrderId: { type: Number },
    amountCents: { type: Number, required: true },
    currency: { type: String, default: 'EGP' },
    paymentMethod: { type: String, default: 'paymob' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired'],
      default: 'pending',
    },
    userId: { type: String, index: true },
    customerEmail: { type: String, lowercase: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentSession', paymentSessionSchema);
