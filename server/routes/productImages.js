const express = require('express');
const mongoose = require('mongoose');
const ProductImageMirror = require('../models/ProductImageMirror');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

const dbReady = () => mongoose.connection.readyState === 1;

router.post('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Image storage unavailable (database offline)' });
  }

  const { productId, mainImage, images } = req.body;
  if (!productId) {
    return res.status(400).json({ message: 'productId is required' });
  }

  const normalizedImages = [
    ...new Set(
      [
        ...(Array.isArray(images) ? images : []),
        ...(mainImage ? [mainImage] : []),
      ].filter(Boolean)
    ),
  ];

  if (normalizedImages.length === 0) {
    return res.status(400).json({ message: 'At least one image is required' });
  }

  try {
    const entry = await ProductImageMirror.findOneAndUpdate(
      { productId: String(productId) },
      {
        productId: String(productId),
        mainImage: mainImage || normalizedImages[0],
        images: normalizedImages,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ data: entry });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save product images' });
  }
});

router.get('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Image storage unavailable (database offline)' });
  }

  const { productId, productIds } = req.query;
  const ids = [
    ...(productId ? [String(productId)] : []),
    ...(productIds
      ? String(productIds).split(',').map((id) => id.trim()).filter(Boolean)
      : []),
  ];

  if (ids.length === 0) {
    return res.status(400).json({ message: 'productId or productIds is required' });
  }

  try {
    const entries = await ProductImageMirror.find({ productId: { $in: ids } });
    return res.json({ data: entries });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load product images' });
  }
});

module.exports = router;
