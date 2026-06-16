const mongoose = require('mongoose');

const brandPromoSchema = new mongoose.Schema(
  {
    brandId: { type: String, required: true, index: true },
    sellerId: { type: String, index: true },
    type: {
      type: String,
      enum: ['free_shipping', 'buy_x_get_y', 'flash', 'custom'],
      required: true,
    },
    label: { type: String, default: '' },
    minOrder: { type: Number, default: 0 },
    buyQty: { type: Number },
    buyX: { type: Number },
    discount: { type: Number },
    getY: { type: Number },
    productId: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

brandPromoSchema.index({ brandId: 1, type: 1 });

module.exports = mongoose.model('BrandPromo', brandPromoSchema);
