const express = require('express');
const mongoose = require('mongoose');
const SellerOrderMirror = require('../models/SellerOrderMirror');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

const dbReady = () => mongoose.connection.readyState === 1;

const normalizeMirrorStatus = (status) => {
  const value = String(status || 'pending').toLowerCase();
  const allowed = new Set([
    'pending',
    'processing',
    'confirmed',
    'paid',
    'shipped',
    'delivered',
    'canceled',
    'cancelled',
  ]);
  if (allowed.has(value)) return value;
  if (['completed'].includes(value)) return 'delivered';
  return 'pending';
};

router.post('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Order storage unavailable (database offline)' });
  }

  const {
    railwayOrderId,
    customerUserId,
    customerEmail,
    customerName,
    brandIds,
    items,
    subtotal,
    totalAmount,
    paymentMethod,
    status,
    shippingAddress,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items are required' });
  }

  const normalizedBrandIds = [
    ...new Set(
      [
        ...(Array.isArray(brandIds) ? brandIds : []),
        ...items.map((item) => item?.brandId).filter(Boolean),
      ].map(String)
    ),
  ];

  if (normalizedBrandIds.length === 0) {
    return res.status(400).json({ message: 'brandIds are required' });
  }

  try {
    if (railwayOrderId) {
      const existing = await SellerOrderMirror.findOne({ railwayOrderId: String(railwayOrderId) });
      if (existing) {
        return res.status(200).json({ data: existing });
      }
    }

    const order = await SellerOrderMirror.create({
      railwayOrderId: railwayOrderId ? String(railwayOrderId) : undefined,
      customerUserId: customerUserId ? String(customerUserId) : undefined,
      customerEmail: customerEmail ? String(customerEmail).toLowerCase().trim() : undefined,
      customerName: customerName || shippingAddress?.fullName || 'Customer',
      brandIds: normalizedBrandIds,
      items: items.map((item) => ({
        productId: item.productId ? String(item.productId) : undefined,
        name: item.name || 'Product',
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        brandId: item.brandId ? String(item.brandId) : undefined,
        brandName: item.brandName || '',
      })),
      subtotal: Number(subtotal) || 0,
      totalAmount: Number(totalAmount) || Number(subtotal) || 0,
      paymentMethod: paymentMethod || 'cod',
      status: normalizeMirrorStatus(status),
      shippingAddress: shippingAddress || undefined,
    });

    return res.status(201).json({ data: order });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save seller order' });
  }
});

router.get('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Order storage unavailable (database offline)' });
  }

  const { brandId, brandIds } = req.query;
  const ids = [
    ...(brandId ? [String(brandId)] : []),
    ...(brandIds ? String(brandIds).split(',').map((id) => id.trim()).filter(Boolean) : []),
  ];

  if (ids.length === 0) {
    return res.status(400).json({ message: 'brandId is required' });
  }

  try {
    const orders = await SellerOrderMirror.find({
      brandIds: { $in: ids },
    }).sort({ createdAt: -1 });

    return res.json({ data: orders });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load seller orders' });
  }
});

module.exports = router;
