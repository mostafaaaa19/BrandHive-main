const mongoose = require('mongoose');

const adInquirySchema = new mongoose.Schema(
  {
    sellerId: { type: String, index: true },
    sellerEmail: { type: String, lowercase: true, trim: true },
    brandId: { type: String, index: true },
    brandName: { type: String, trim: true },
    adType: { type: String, required: true, index: true },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'closed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdInquiry', adInquirySchema);
