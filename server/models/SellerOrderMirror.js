const mongoose = require('mongoose');

const sellerOrderItemSchema = new mongoose.Schema(
  {
    productId: String,
    name: String,
    quantity: Number,
    price: Number,
    brandId: String,
    brandName: String,
  },
  { _id: false }
);

const sellerOrderMirrorSchema = new mongoose.Schema(
  {
    railwayOrderId: { type: String, index: true },
    customerUserId: { type: String, index: true },
    customerEmail: { type: String, lowercase: true, trim: true },
    customerName: { type: String, trim: true },
    brandIds: [{ type: String, index: true }],
    items: [sellerOrderItemSchema],
    subtotal: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, default: 'cod' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'confirmed', 'paid', 'shipped', 'delivered', 'canceled', 'cancelled'],
      default: 'pending',
    },
    shippingAddress: {
      fullName: String,
      phone: String,
      street: String,
      city: String,
      governorate: String,
      country: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SellerOrderMirror', sellerOrderMirrorSchema);
