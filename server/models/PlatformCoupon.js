const mongoose = require('mongoose');

const platformCouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, unique: true },
    type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    value: { type: Number, required: true },
    expiresAt: { type: Date },
    minOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    railwayId: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformCoupon', platformCouponSchema);
