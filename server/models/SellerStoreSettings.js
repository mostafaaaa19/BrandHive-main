const mongoose = require('mongoose');

const sellerStoreSettingsSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    brandId: { type: String, index: true },
    bazaar: {
      description: { type: String, default: '' },
      whatsappLink: { type: String, default: '' },
      instagramLink: { type: String, default: '' },
      facebookLink: { type: String, default: '' },
    },
    shop: {
      storeName: { type: String, default: '' },
      storeDescription: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
      acceptsCOD: { type: Boolean, default: true },
      autoConfirm: { type: Boolean, default: false },
      lowStockAlert: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
);

sellerStoreSettingsSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('SellerStoreSettings', sellerStoreSettingsSchema);
