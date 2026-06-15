const mongoose = require('mongoose');

const savedCardSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    label: { type: String, default: '' },
    brand: { type: String, default: 'Card' },
    last4: { type: String, required: true },
    expMonth: { type: String, default: '' },
    expYear: { type: String, default: '' },
    holderName: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SavedCard', savedCardSchema);
