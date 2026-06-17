const express = require('express');
const mongoose = require('mongoose');
const SellerOrderMirror = require('../models/SellerOrderMirror');
const SellerStoreSettings = require('../models/SellerStoreSettings');

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

router.get('/by-railway', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Order storage unavailable (database offline)' });
  }

  const ids = String(req.query.ids || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return res.status(400).json({ message: 'ids query param is required' });
  }

  try {
    const orders = await SellerOrderMirror.find({
      railwayOrderId: { $in: ids.map(String) },
    })
      .select('railwayOrderId items.brandName items.productId items.name')
      .lean();

    return res.json({ data: orders });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load mirror orders' });
  }
});

router.get('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Order storage unavailable (database offline)' });
  }

  const { brandId, brandIds, sellerId } = req.query;
  const ids = [
    ...(brandId ? [String(brandId)] : []),
    ...(brandIds ? String(brandIds).split(',').map((id) => id.trim()).filter(Boolean) : []),
  ];

  if (ids.length === 0 && sellerId) {
    try {
      const settings = await SellerStoreSettings.findOne({
        userId: String(sellerId),
      }).lean();
      if (settings?.brandId) {
        ids.push(String(settings.brandId));
      }
    } catch {
      // fall through to validation
    }
  }

  if (ids.length === 0 && !sellerId) {
    return res.status(400).json({ message: 'brandId or sellerId is required' });
  }

  try {
    const filters = [];
    if (ids.length > 0) {
      filters.push({ brandIds: { $in: ids } });
    }

    if (sellerId) {
      const settings = await SellerStoreSettings.findOne({
        userId: String(sellerId),
      }).lean();
      const brandName =
        settings?.shop?.storeName || settings?.bazaar?.name || null;
      if (brandName) {
        filters.push({
          'items.brandName': {
            $regex: new RegExp(
              `^${String(brandName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
              'i'
            ),
          },
        });
      }
    }

    if (filters.length === 0) {
      return res.json({ data: [] });
    }

    const query = filters.length > 1 ? { $or: filters } : filters[0];
    const orders = await SellerOrderMirror.find(query).sort({ createdAt: -1 });

    return res.json({ data: orders });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load seller orders' });
  }
});

router.patch('/:id/status', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Order storage unavailable (database offline)' });
  }

  const { status, note } = req.body || {};
  const normalized = normalizeMirrorStatus(status);
  if (!status) {
    return res.status(400).json({ message: 'status is required' });
  }

  const lookupId = String(req.params.id || '').trim();
  if (!lookupId) {
    return res.status(400).json({ message: 'order id is required' });
  }

  try {
    let order = null;

    if (mongoose.Types.ObjectId.isValid(lookupId)) {
      order = await SellerOrderMirror.findById(lookupId);
    }

    if (!order) {
      order = await SellerOrderMirror.findOne({ railwayOrderId: lookupId });
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = normalized;
    if (note) order.statusNote = String(note).trim();
    await order.save();

    return res.json({ data: order });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to update order status' });
  }
});

module.exports = router;
