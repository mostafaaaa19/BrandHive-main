const mongoose = require('mongoose');

const sellerWithdrawalSchema = new mongoose.Schema(
  {
    sellerUserId: { type: String, required: true, index: true },
    sellerEmail: { type: String, lowercase: true, trim: true },
    sellerName: { type: String, trim: true },
    brandId: { type: String, index: true },
    brandName: { type: String, trim: true },
    amount: { type: Number, required: true, min: 1 },
    platformFee: { type: Number, default: 0 },
    netAmount: { type: Number, required: true, min: 1 },
    method: {
      type: String,
      enum: ['vodafone_cash', 'instapay', 'bank_transfer'],
      required: true,
    },
    accountDetails: {
      walletNumber: String,
      instapayId: String,
      bankName: String,
      accountNumber: String,
      accountHolder: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String, trim: true },
    availableBalanceAtRequest: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SellerWithdrawal', sellerWithdrawalSchema);
