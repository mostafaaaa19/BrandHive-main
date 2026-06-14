const mongoose = require('mongoose');

const productImageMirrorSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    mainImage: { type: String },
    images: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductImageMirror', productImageMirrorSchema);
