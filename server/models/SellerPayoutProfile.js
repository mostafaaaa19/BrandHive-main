const mongoose = require('mongoose');

const sellerPayoutProfileSchema = new mongoose.Schema(
  {
    sellerUserId: { type: String, required: true, unique: true, index: true },
    sellerEmail: { type: String, lowercase: true, trim: true },
    method: {
      type: String,
      enum: ['vodafone_cash', 'instapay', 'bank_transfer'],
      default: 'vodafone_cash',
    },
    walletNumber: { type: String, trim: true },
    instapayId: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    accountHolder: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SellerPayoutProfile', sellerPayoutProfileSchema);
