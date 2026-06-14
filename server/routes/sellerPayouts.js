const express = require('express');
const mongoose = require('mongoose');
const SellerWithdrawal = require('../models/SellerWithdrawal');
const SellerPayoutProfile = require('../models/SellerPayoutProfile');
const SellerOrderMirror = require('../models/SellerOrderMirror');

const router = express.Router();
const PLATFORM_FEE_RATE = 0.05;

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

const dbReady = () => mongoose.connection.readyState === 1;

const activeOrderTotal = (orders = []) =>
  orders
    .filter((order) => !['canceled', 'cancelled'].includes(String(order.status || '').toLowerCase()))
    .reduce((sum, order) => sum + (Number(order.totalAmount) || Number(order.subtotal) || 0), 0);

const computePayoutSummary = async (sellerUserId, brandId) => {
  const orderQuery = brandId ? { brandIds: String(brandId) } : { sellerUserId: String(sellerUserId) };
  const orders = await SellerOrderMirror.find(orderQuery);
  const grossRevenue = activeOrderTotal(orders);
  const platformFee = Math.round(grossRevenue * PLATFORM_FEE_RATE);
  const netEarnings = grossRevenue - platformFee;

  const withdrawals = await SellerWithdrawal.find({ sellerUserId: String(sellerUserId) }).sort({
    createdAt: -1,
  });

  const pendingWithdrawal = withdrawals
    .filter((entry) => ['pending', 'approved'].includes(entry.status))
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

  const totalWithdrawn = withdrawals
    .filter((entry) => entry.status === 'paid')
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

  const availableBalance = Math.max(0, netEarnings - pendingWithdrawal - totalWithdrawn);

  return {
    grossRevenue,
    platformFee,
    netEarnings,
    availableBalance,
    pendingWithdrawal,
    totalWithdrawn,
    withdrawals,
  };
};

router.get('/summary', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Payout storage unavailable (database offline)' });
  }

  const { sellerUserId, brandId } = req.query;
  if (!sellerUserId) {
    return res.status(400).json({ message: 'sellerUserId is required' });
  }

  try {
    const summary = await computePayoutSummary(sellerUserId, brandId);
    const profile = await SellerPayoutProfile.findOne({ sellerUserId: String(sellerUserId) });
    return res.json({ data: { ...summary, profile } });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load payout summary' });
  }
});

router.get('/profile', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Payout storage unavailable (database offline)' });
  }

  const { sellerUserId } = req.query;
  if (!sellerUserId) {
    return res.status(400).json({ message: 'sellerUserId is required' });
  }

  try {
    const profile = await SellerPayoutProfile.findOne({ sellerUserId: String(sellerUserId) });
    return res.json({ data: profile });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load payout profile' });
  }
});

router.post('/profile', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Payout storage unavailable (database offline)' });
  }

  const {
    sellerUserId,
    sellerEmail,
    method,
    walletNumber,
    instapayId,
    bankName,
    accountNumber,
    accountHolder,
  } = req.body;

  if (!sellerUserId || !method) {
    return res.status(400).json({ message: 'sellerUserId and method are required' });
  }

  try {
    const profile = await SellerPayoutProfile.findOneAndUpdate(
      { sellerUserId: String(sellerUserId) },
      {
        sellerUserId: String(sellerUserId),
        sellerEmail: sellerEmail ? String(sellerEmail).toLowerCase().trim() : undefined,
        method,
        walletNumber: walletNumber || undefined,
        instapayId: instapayId || undefined,
        bankName: bankName || undefined,
        accountNumber: accountNumber || undefined,
        accountHolder: accountHolder || undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ data: profile });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save payout profile' });
  }
});

router.post('/withdrawals', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Payout storage unavailable (database offline)' });
  }

  const {
    sellerUserId,
    sellerEmail,
    sellerName,
    brandId,
    brandName,
    amount,
    method,
    accountDetails,
  } = req.body;

  if (!sellerUserId || !amount || !method) {
    return res.status(400).json({ message: 'sellerUserId, amount, and method are required' });
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 50) {
    return res.status(400).json({ message: 'Minimum withdrawal amount is 50 EGP' });
  }

  try {
    const summary = await computePayoutSummary(sellerUserId, brandId);
    if (parsedAmount > summary.availableBalance) {
      return res.status(400).json({
        message: `Amount exceeds available balance (${summary.availableBalance} EGP)`,
      });
    }

    const withdrawal = await SellerWithdrawal.create({
      sellerUserId: String(sellerUserId),
      sellerEmail: sellerEmail ? String(sellerEmail).toLowerCase().trim() : undefined,
      sellerName: sellerName || 'Seller',
      brandId: brandId ? String(brandId) : undefined,
      brandName: brandName || undefined,
      amount: parsedAmount,
      platformFee: 0,
      netAmount: parsedAmount,
      method,
      accountDetails: accountDetails || {},
      availableBalanceAtRequest: summary.availableBalance,
      status: 'pending',
    });

    return res.status(201).json({ data: withdrawal });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to create withdrawal request' });
  }
});

router.get('/withdrawals', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Payout storage unavailable (database offline)' });
  }

  const { sellerUserId } = req.query;
  if (!sellerUserId) {
    return res.status(400).json({ message: 'sellerUserId is required' });
  }

  try {
    const withdrawals = await SellerWithdrawal.find({
      sellerUserId: String(sellerUserId),
    }).sort({ createdAt: -1 });
    return res.json({ data: withdrawals });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load withdrawals' });
  }
});

router.get('/admin/withdrawals', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Payout storage unavailable (database offline)' });
  }

  try {
    const withdrawals = await SellerWithdrawal.find().sort({ createdAt: -1 });
    return res.json({ data: withdrawals });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load admin withdrawals' });
  }
});

router.patch('/admin/withdrawals/:id', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Payout storage unavailable (database offline)' });
  }

  const { status, adminNote } = req.body;
  const allowed = ['pending', 'approved', 'paid', 'rejected'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ message: 'Valid status is required' });
  }

  try {
    const withdrawal = await SellerWithdrawal.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(adminNote !== undefined ? { adminNote: String(adminNote).trim() } : {}),
      },
      { new: true }
    );

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    return res.json({ data: withdrawal });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to update withdrawal' });
  }
});

module.exports = router;
