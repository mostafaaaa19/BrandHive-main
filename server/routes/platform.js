const express = require('express');
const mongoose = require('mongoose');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const SiteSettings = require('../models/SiteSettings');
const AdInquiry = require('../models/AdInquiry');

const router = express.Router();
const FEATURED_SLOTS_KEY = 'featured_product_ids';

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

module.exports = router;
