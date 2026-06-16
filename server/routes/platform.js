const express = require('express');
const mongoose = require('mongoose');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const SiteSettings = require('../models/SiteSettings');
const AdInquiry = require('../models/AdInquiry');
const BrandCoupon = require('../models/BrandCoupon');
const BrandPromo = require('../models/BrandPromo');
const SavedCard = require('../models/SavedCard');
const SellerStoreSettings = require('../models/SellerStoreSettings');
const PlatformCoupon = require('../models/PlatformCoupon');

let User;
try {
  User = require('../models/User');
} catch {
  User = null;
}

const router = express.Router();
const FEATURED_SLOTS_KEY = 'featured_product_ids';
const PUBLIC_STATS_KEY = 'public_homepage_stats';
const EGYPT_GOVERNORATES_COUNT = 27;

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

const dbReady = () => mongoose.connection.readyState === 1;

router.post('/newsletter', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Valid email is required' });
  }

  if (!dbReady()) {
    return res.status(503).json({ message: 'Newsletter storage unavailable (database offline)' });
  }

  try {
    const entry = await NewsletterSubscriber.findOneAndUpdate(
      { email },
      { email, subscribedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ data: { email: entry.email, subscribed: true } });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to subscribe' });
  }
});

router.get('/featured-slots', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Featured slots unavailable (database offline)' });
  }

  try {
    const doc = await SiteSettings.findOne({ key: FEATURED_SLOTS_KEY }).lean();
    const productIds = Array.isArray(doc?.value) ? doc.value.map(String) : [];
    return res.json({ data: { productIds } });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load featured slots' });
  }
});

router.get('/public-stats', async (req, res) => {
  if (!dbReady()) {
    return res.json({
      data: {
        buyers: 0,
        governorates: EGYPT_GOVERNORATES_COUNT,
        newsletterCount: 0,
        registeredUsers: 0,
      },
    });
  }

  try {
    const [doc, newsletterCount, registeredUsers] = await Promise.all([
      SiteSettings.findOne({ key: PUBLIC_STATS_KEY }).lean(),
      NewsletterSubscriber.countDocuments(),
      User
        ? User.countDocuments({ role: 'customer', isActive: { $ne: false } })
        : Promise.resolve(0),
    ]);

    const value = doc?.value && typeof doc.value === 'object' ? doc.value : {};
    const cachedBuyers = Number(value.buyers) || 0;
    const buyers = Math.max(cachedBuyers, newsletterCount, registeredUsers);

    return res.json({
      data: {
        buyers,
        governorates: Number(value.governorates) || EGYPT_GOVERNORATES_COUNT,
        newsletterCount,
        registeredUsers,
        updatedAt: value.updatedAt || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load public stats' });
  }
});

router.put('/public-stats', async (req, res) => {
  const buyers = Number(req.body?.buyers);
  const governorates = Number(req.body?.governorates);

  if (!dbReady()) {
    return res.status(503).json({ message: 'Public stats unavailable (database offline)' });
  }

  try {
    const value = {
      buyers: Number.isFinite(buyers) ? Math.max(0, buyers) : 0,
      governorates: Number.isFinite(governorates)
        ? Math.max(0, governorates)
        : EGYPT_GOVERNORATES_COUNT,
      updatedAt: new Date().toISOString(),
    };

    await SiteSettings.findOneAndUpdate(
      { key: PUBLIC_STATS_KEY },
      { value },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ data: value });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save public stats' });
  }
});

router.put('/featured-slots', async (req, res) => {
  const { productIds } = req.body || {};
  if (!Array.isArray(productIds)) {
    return res.status(400).json({ message: 'productIds array is required' });
  }

  if (!dbReady()) {
    return res.status(503).json({ message: 'Featured slots unavailable (database offline)' });
  }

  try {
    const ids = productIds.slice(0, 4).map(String);
    await SiteSettings.findOneAndUpdate(
      { key: FEATURED_SLOTS_KEY },
      { value: ids },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ data: { productIds: ids } });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save featured slots' });
  }
});

router.post('/ad-inquiries', async (req, res) => {
  const { sellerId, sellerEmail, brandId, brandName, adType, message } = req.body || {};
  if (!adType) {
    return res.status(400).json({ message: 'adType is required' });
  }

  if (!dbReady()) {
    return res.status(503).json({ message: 'Ad inquiry storage unavailable (database offline)' });
  }

  try {
    const entry = await AdInquiry.create({
      sellerId: sellerId ? String(sellerId) : undefined,
      sellerEmail: sellerEmail ? String(sellerEmail).toLowerCase().trim() : undefined,
      brandId: brandId ? String(brandId) : undefined,
      brandName: brandName || undefined,
      adType: String(adType),
      message: message || undefined,
      status: 'pending',
    });
    return res.status(201).json({ data: entry });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to submit ad inquiry' });
  }
});

const toPlatformCouponDto = (doc) => ({
  _id: String(doc._id),
  id: String(doc._id),
  code: doc.code,
  type: doc.type,
  value: doc.value,
  expiresAt: doc.expiresAt,
  minOrder: doc.minOrder || 0,
  active: doc.active !== false,
  railwayId: doc.railwayId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const computeCouponDiscount = (coupon, subtotal = 0) => {
  const base = Math.max(0, Number(subtotal) || 0);
  if (!coupon || base <= 0) return 0;

  const minOrder = Number(coupon.minOrder) || 0;
  if (minOrder > 0 && base < minOrder) return 0;

  if (coupon.type === 'percentage') {
    return Math.round(base * (Number(coupon.value) || 0) / 100);
  }

  return Math.min(base, Number(coupon.value) || 0);
};

const isCouponExpired = (expiresAt) => {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() < Date.now();
};

router.post('/coupons/validate', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Coupon validation unavailable (database offline)' });
  }

  const code = String(req.body?.code || '').toUpperCase().trim();
  const subtotal = Number(req.body?.subtotal) || 0;

  if (!code) {
    return res.status(400).json({ message: 'code is required', valid: false });
  }

  try {
    const coupon = await PlatformCoupon.findOne({ code, active: { $ne: false } }).lean();
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found', valid: false });
    }
    if (isCouponExpired(coupon.expiresAt)) {
      return res.status(400).json({ message: 'Coupon expired', valid: false });
    }

    const discount = computeCouponDiscount(coupon, subtotal);
    if (discount <= 0) {
      return res.status(400).json({
        message: 'Coupon does not apply to this order',
        valid: false,
      });
    }

    return res.json({
      data: {
        valid: true,
        code,
        discount,
        coupon: toPlatformCouponDto(coupon),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to validate coupon', valid: false });
  }
});

router.get('/coupons', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Coupons unavailable (database offline)' });
  }

  try {
    const coupons = await PlatformCoupon.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ data: coupons.map(toPlatformCouponDto) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load coupons' });
  }
});

router.post('/coupons', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Coupons unavailable (database offline)' });
  }

  const { code, type, value, expiresAt, minOrder, railwayId } = req.body || {};
  const normalizedCode = String(code || '').toUpperCase().trim();

  if (!normalizedCode || value == null) {
    return res.status(400).json({ message: 'code and value are required' });
  }

  try {
    const entry = await PlatformCoupon.findOneAndUpdate(
      { code: normalizedCode },
      {
        code: normalizedCode,
        type: type === 'fixed' ? 'fixed' : 'percentage',
        value: Number(value),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        minOrder: Number(minOrder) || 0,
        railwayId: railwayId ? String(railwayId) : undefined,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ data: toPlatformCouponDto(entry) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save coupon' });
  }
});

router.delete('/coupons/:couponId', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Coupons unavailable (database offline)' });
  }

  const { couponId } = req.params;
  const { code } = req.query;

  try {
    const filter = {};
    if (couponId && couponId !== 'by-code') {
      filter._id = couponId;
    } else if (code) {
      filter.code = String(code).toUpperCase().trim();
    } else {
      return res.status(400).json({ message: 'couponId or code is required' });
    }

    await PlatformCoupon.deleteOne(filter);
    return res.json({ data: { deleted: true } });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to delete coupon' });
  }
});

const toCouponDto = (doc) => ({
  _id: String(doc._id),
  id: String(doc._id),
  code: doc.code,
  type: doc.type,
  value: doc.value,
  expiresAt: doc.expiresAt,
  brandId: doc.brandId,
  sellerId: doc.sellerId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const toPromoDto = (doc) => ({
  _id: String(doc._id),
  id: String(doc._id),
  type: doc.type,
  label: doc.label || '',
  minOrder: doc.minOrder || 0,
  buyQty: doc.buyQty,
  buyX: doc.buyX,
  discount: doc.discount,
  getY: doc.getY,
  brandId: doc.brandId,
  sellerId: doc.sellerId,
  active: doc.active !== false,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const toCardDto = (doc) => ({
  _id: String(doc._id),
  id: String(doc._id),
  label: doc.label || '',
  brand: doc.brand || 'Card',
  type: doc.brand || 'Card',
  last4: doc.last4,
  expMonth: doc.expMonth || '',
  expYear: doc.expYear || '',
  expiry: doc.expMonth && doc.expYear ? `${doc.expMonth}/${doc.expYear}` : '',
  name: doc.holderName || '',
  holderName: doc.holderName || '',
  isDefault: Boolean(doc.isDefault),
  createdAt: doc.createdAt,
});

router.get('/brands/:brandId/offers', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Brand offers unavailable (database offline)' });
  }

  const brandId = String(req.params.brandId || '');
  if (!brandId) return res.status(400).json({ message: 'brandId is required' });

  try {
    const now = new Date();
    const [coupons, promos] = await Promise.all([
      BrandCoupon.find({
        brandId,
        active: { $ne: false },
        $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }],
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      BrandPromo.find({ brandId, active: { $ne: false } })
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return res.json({
      data: {
        coupons: coupons.map(toCouponDto),
        promos: promos.map(toPromoDto).filter((entry) => entry.label),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load brand offers' });
  }
});

router.get('/sellers/:userId/coupons', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Coupons unavailable (database offline)' });
  }

  const sellerId = String(req.params.userId || '');
  const { brandId } = req.query;
  const filter = { sellerId };
  if (brandId) filter.brandId = String(brandId);

  try {
    const coupons = await BrandCoupon.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    return res.json({ data: coupons.map(toCouponDto) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load coupons' });
  }
});

router.post('/sellers/:userId/coupons', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Coupons unavailable (database offline)' });
  }

  const sellerId = String(req.params.userId || '');
  const { brandId, code, type, value, expiresAt } = req.body || {};
  const normalizedCode = String(code || '').toUpperCase().trim();

  if (!sellerId || !normalizedCode || !value) {
    return res.status(400).json({ message: 'code and value are required' });
  }

  try {
    const entry = await BrandCoupon.findOneAndUpdate(
      { brandId: brandId ? String(brandId) : undefined, code: normalizedCode },
      {
        sellerId,
        brandId: brandId ? String(brandId) : undefined,
        code: normalizedCode,
        type: type === 'fixed' ? 'fixed' : 'percentage',
        value: Number(value),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ data: toCouponDto(entry) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save coupon' });
  }
});

router.delete('/sellers/:userId/coupons/:couponId', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Coupons unavailable (database offline)' });
  }

  const sellerId = String(req.params.userId || '');
  const { couponId } = req.params;
  const { code, brandId } = req.query;

  try {
    const filter = { sellerId };
    if (couponId && couponId !== 'by-code') {
      filter._id = couponId;
    } else if (code) {
      filter.code = String(code).toUpperCase().trim();
      if (brandId) filter.brandId = String(brandId);
    } else {
      return res.status(400).json({ message: 'couponId or code is required' });
    }

    await BrandCoupon.deleteOne(filter);
    return res.json({ data: { deleted: true } });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to delete coupon' });
  }
});

router.get('/sellers/:userId/promos', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Promotions unavailable (database offline)' });
  }

  const sellerId = String(req.params.userId || '');
  const { brandId } = req.query;
  const filter = { sellerId };
  if (brandId) filter.brandId = String(brandId);

  try {
    const promos = await BrandPromo.find(filter).sort({ updatedAt: -1 }).limit(20).lean();
    return res.json({ data: promos.map(toPromoDto) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load promotions' });
  }
});

router.post('/sellers/:userId/promos', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Promotions unavailable (database offline)' });
  }

  const sellerId = String(req.params.userId || '');
  const { brandId, type, label, minOrder, buyQty, buyX, discount, getY } = req.body || {};

  if (!sellerId || !type) {
    return res.status(400).json({ message: 'type is required' });
  }

  try {
    const filter = { sellerId, type: String(type) };
    if (brandId) filter.brandId = String(brandId);

    const entry = await BrandPromo.findOneAndUpdate(
      filter,
      {
        sellerId,
        brandId: brandId ? String(brandId) : undefined,
        type: String(type),
        label: label || '',
        minOrder: Number(minOrder) || 0,
        buyQty: buyQty != null ? Number(buyQty) : undefined,
        buyX: buyX != null ? Number(buyX) : buyQty != null ? Number(buyQty) : undefined,
        discount: discount != null ? Number(discount) : undefined,
        getY: getY != null ? Number(getY) : undefined,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ data: toPromoDto(entry) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save promotion' });
  }
});

router.delete('/sellers/:userId/promos/:promoId', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Promotions unavailable (database offline)' });
  }

  try {
    await BrandPromo.deleteOne({
      _id: req.params.promoId,
      sellerId: String(req.params.userId || ''),
    });
    return res.json({ data: { deleted: true } });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to delete promotion' });
  }
});

router.get('/users/:userId/saved-cards', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Saved cards unavailable (database offline)' });
  }

  const userId = String(req.params.userId || '');
  if (!userId) return res.status(400).json({ message: 'userId is required' });

  try {
    const cards = await SavedCard.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).lean();
    return res.json({ data: cards.map(toCardDto) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load saved cards' });
  }
});

router.post('/users/:userId/saved-cards', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Saved cards unavailable (database offline)' });
  }

  const userId = String(req.params.userId || '');
  const { last4, brand, type, expMonth, expYear, expiry, name, holderName, isDefault } = req.body || {};
  const digits = String(last4 || '').replace(/\D/g, '').slice(-4);

  if (!userId || digits.length !== 4) {
    return res.status(400).json({ message: 'last4 is required' });
  }

  let month = String(expMonth || '').padStart(2, '0');
  let year = String(expYear || '');
  if (expiry && expiry.includes('/')) {
    const [m, y] = String(expiry).split('/');
    month = String(m || '').padStart(2, '0');
    year = String(y || '');
  }

  try {
    const count = await SavedCard.countDocuments({ userId });
    const makeDefault = Boolean(isDefault) || count === 0;

    if (makeDefault) {
      await SavedCard.updateMany({ userId }, { $set: { isDefault: false } });
    }

    const card = await SavedCard.create({
      userId,
      last4: digits,
      brand: brand || type || 'Card',
      expMonth: month,
      expYear: year,
      holderName: holderName || name || '',
      isDefault: makeDefault,
    });

    return res.status(201).json({ data: toCardDto(card) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save card' });
  }
});

router.delete('/users/:userId/saved-cards/:cardId', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Saved cards unavailable (database offline)' });
  }

  const userId = String(req.params.userId || '');
  const { cardId } = req.params;

  try {
    const removed = await SavedCard.findOneAndDelete({ _id: cardId, userId }).lean();
    if (!removed) {
      return res.status(404).json({ message: 'Card not found' });
    }

    const nextDefault = await SavedCard.findOne({ userId }).sort({ createdAt: -1 });
    if (nextDefault && removed.isDefault) {
      await SavedCard.updateOne({ _id: nextDefault._id }, { $set: { isDefault: true } });
    }

    return res.json({ data: { deleted: true } });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to delete card' });
  }
});

router.patch('/users/:userId/saved-cards/:cardId/default', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Saved cards unavailable (database offline)' });
  }

  const userId = String(req.params.userId || '');
  const { cardId } = req.params;

  try {
    await SavedCard.updateMany({ userId }, { $set: { isDefault: false } });
    const card = await SavedCard.findOneAndUpdate(
      { _id: cardId, userId },
      { $set: { isDefault: true } },
      { new: true }
    ).lean();

    if (!card) return res.status(404).json({ message: 'Card not found' });
    return res.json({ data: toCardDto(card) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to update default card' });
  }
});

router.get('/users/:userId/store-settings', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Store settings unavailable (database offline)' });
  }

  const userId = String(req.params.userId || '');
  if (!userId) return res.status(400).json({ message: 'userId is required' });

  try {
    const doc = await SellerStoreSettings.findOne({ userId }).lean();
    return res.json({
      data: {
        bazaar: doc?.bazaar || {},
        shop: doc?.shop || {},
        brandId: doc?.brandId || req.query.brandId || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load store settings' });
  }
});

router.put('/users/:userId/store-settings', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Store settings unavailable (database offline)' });
  }

  const userId = String(req.params.userId || '');
  const { brandId, bazaar, shop } = req.body || {};

  if (!userId) return res.status(400).json({ message: 'userId is required' });

  try {
    const update = {};
    if (bazaar && typeof bazaar === 'object') update.bazaar = bazaar;
    if (shop && typeof shop === 'object') update.shop = shop;
    if (brandId) update.brandId = String(brandId);

    const doc = await SellerStoreSettings.findOneAndUpdate(
      { userId },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      data: {
        bazaar: doc.bazaar || {},
        shop: doc.shop || {},
        brandId: doc.brandId || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save store settings' });
  }
});

const userProfileKey = (userId) => `user_profile:${String(userId)}`;

router.get('/users/:userId/profile', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Profile storage unavailable (database offline)' });
  }

  const userId = String(req.params.userId || '');
  if (!userId) return res.status(400).json({ message: 'userId is required' });

  try {
    const doc = await SiteSettings.findOne({ key: userProfileKey(userId) }).lean();
    return res.json({ data: doc?.value || null });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load profile' });
  }
});

router.put('/users/:userId/profile', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Profile storage unavailable (database offline)' });
  }

  const userId = String(req.params.userId || '');
  const { name, phone, email } = req.body || {};
  if (!userId) return res.status(400).json({ message: 'userId is required' });
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }

  try {
    const value = {
      userId,
      name: String(name).trim(),
      phone: phone != null ? String(phone).trim() : '',
      email: email ? String(email).toLowerCase().trim() : undefined,
      updatedAt: new Date().toISOString(),
    };

    await SiteSettings.findOneAndUpdate(
      { key: userProfileKey(userId) },
      { key: userProfileKey(userId), value },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ data: value });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save profile' });
  }
});

module.exports = router;
