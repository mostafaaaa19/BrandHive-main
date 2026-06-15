const mongoose = require('mongoose');

const brandCouponSchema = new mongoose.Schema(
  {
    brandId: { type: String, required: true, index: true },
    sellerId: { type: String, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    value: { type: Number, required: true },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

brandCouponSchema.index({ brandId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('BrandCoupon', brandCouponSchema);
