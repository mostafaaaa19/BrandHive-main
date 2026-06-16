const mongoose = require('mongoose');

const brandFollowMirrorSchema = new mongoose.Schema(
  {
    brandId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String },
  },
  { timestamps: true }
);

brandFollowMirrorSchema.index({ brandId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('BrandFollowMirror', brandFollowMirrorSchema);
