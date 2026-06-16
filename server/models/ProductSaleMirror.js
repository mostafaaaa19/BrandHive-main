const mongoose = require('mongoose');

const productSaleMirrorSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    brandId: { type: String, required: true, index: true },
    originalPrice: { type: Number, required: true },
    discountPrice: { type: Number, required: true },
    discountPercent: { type: Number },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductSaleMirror', productSaleMirrorSchema);
