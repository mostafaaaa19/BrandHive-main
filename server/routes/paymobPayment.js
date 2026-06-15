const express = require('express');
const mongoose = require('mongoose');
const PaymentSession = require('../models/PaymentSession');
const { createPaymobCheckout, isPaymobConfigured, parseBrandhiveOrderId, isPaymobReturnSuccess } = require('../services/paymob');

const router = express.Router();
const RAILWAY_API =
  process.env.RAILWAY_API_URL ||
  'https://brandhive-apis-production.up.railway.app';

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

const dbReady = () => mongoose.connection.readyState === 1;

const fetchRailwayOrder = async (orderId, authHeader) => {
  if (!authHeader) return null;

  const res = await fetch(`${RAILWAY_API}/orders/my-orders/${orderId}`, {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) return null;

  const body = await res.json().catch(() => ({}));
  return body?.data || body?.order || body || null;
};

const resolveOrderAmount = (order, fallbackAmount) => {
  const candidates = [
    order?.totalAmount,
    order?.total,
    order?.amount,
    order?.grandTotal,
    fallbackAmount,
  ];

  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }

  return null;
};

const forwardPaymobWebhookToRailway = async (orderId, paymobParams = {}) => {
  let session = null;
  if (dbReady()) {
    session = await PaymentSession.findOne({
      brandhiveOrderId: String(orderId),
    }).lean();
  }

  const txnId =
    paymobParams.id ||
    paymobParams.transaction_id ||
    paymobParams.transaction_no ||
    session?.paymobTransactionId;

  if (!txnId) {
    return { ok: false, error: 'Missing Paymob transaction id' };
  }

  const merchantRef =
    paymobParams.merchant_order_id ||
    session?.paymobMerchantOrderId ||
    String(orderId);

  const amountCents =
    Number(paymobParams.amount_cents) ||
    Number(session?.amountCents) ||
    undefined;

  const body = {
    obj: {
      id: Number(txnId) || txnId,
      success: true,
      pending: false,
      amount_cents: amountCents,
      currency: paymobParams.currency || session?.currency || 'EGP',
      order: {
        id: session?.paymobOrderId,
        merchant_order_id: merchantRef,
      },
    },
  };

  try {
    const res = await fetch(`${RAILWAY_API}/payment/webhook/paymob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

router.get('/paymob/status', (req, res) => {
  res.json({
    data: {
      configured: isPaymobConfigured('paymob'),
      fawryConfigured: isPaymobConfigured('fawry'),
    },
  });
});

router.post('/paymob/initiate', async (req, res) => {
  const {
    orderId,
    amount,
    paymentMethod = 'paymob',
    billing = {},
    customerEmail = '',
  } = req.body || {};

  if (!orderId) {
    return res.status(400).json({ message: 'orderId is required' });
  }

  if (!isPaymobConfigured(paymentMethod)) {
    return res.status(503).json({
      message:
        'Paymob is not configured on the companion server. Add PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, and PAYMOB_IFRAME_ID.',
    });
  }

  try {
    const railwayOrder = await fetchRailwayOrder(
      String(orderId),
      req.headers.authorization
    );
    const resolvedAmount = resolveOrderAmount(railwayOrder, amount);

    if (!resolvedAmount) {
      return res.status(400).json({ message: 'Could not resolve order amount' });
    }

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(
      /\/$/,
      ''
    );
    const returnUrl = `${clientUrl}/payment/return?orderId=${encodeURIComponent(
      String(orderId)
    )}`;

    const checkout = await createPaymobCheckout({
      amount: resolvedAmount,
      paymentMethod,
      billing: billing.shippingAddress || billing,
      customerEmail,
      merchantOrderId: String(orderId),
      returnUrl,
    });

    if (dbReady()) {
      await PaymentSession.findOneAndUpdate(
        { brandhiveOrderId: String(orderId) },
        {
          brandhiveOrderId: String(orderId),
          paymobOrderId: checkout.paymobOrderId,
          paymobMerchantOrderId: checkout.merchantOrderRef,
          amountCents: checkout.amountCents,
          paymentMethod,
          status: 'pending',
          customerEmail: customerEmail || undefined,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return res.json({
      data: {
        paymentUrl: checkout.paymentUrl,
        paymobOrderId: checkout.paymobOrderId,
        amount: resolvedAmount,
      },
    });
  } catch (err) {
    return res.status(502).json({
      message: err.message || 'Failed to initiate Paymob checkout',
    });
  }
});

router.get('/paymob/order/:orderId/status', async (req, res) => {
  const orderId = String(req.params.orderId || '');
  if (!orderId) {
    return res.status(400).json({ message: 'orderId is required' });
  }

  if (!dbReady()) {
    return res.json({ data: { orderId, status: 'unknown' } });
  }

  const session = await PaymentSession.findOne({ brandhiveOrderId: orderId }).lean();
  return res.json({
    data: {
      orderId,
      status: session?.status || 'unknown',
      paid: session?.status === 'paid',
    },
  });
});

router.post('/paymob/confirm', async (req, res) => {
  const { orderId, paymobParams = {} } = req.body || {};

  if (!orderId) {
    return res.status(400).json({ message: 'orderId is required' });
  }

  const success = isPaymobReturnSuccess(paymobParams);
  const txnId =
    paymobParams.id ||
    paymobParams.transaction_id ||
    paymobParams.transaction_no ||
    null;

  if (dbReady()) {
    await PaymentSession.findOneAndUpdate(
      { brandhiveOrderId: String(orderId) },
      {
        brandhiveOrderId: String(orderId),
        status: success ? 'paid' : 'failed',
        ...(txnId ? { paymobTransactionId: String(txnId) } : {}),
        ...(paymobParams.merchant_order_id
          ? { paymobMerchantOrderId: String(paymobParams.merchant_order_id) }
          : {}),
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  let railway = null;
  if (success) {
    railway = await forwardPaymobWebhookToRailway(String(orderId), paymobParams);
  }

  return res.json({
    data: {
      orderId: String(orderId),
      success,
      status: success ? 'paid' : 'pending',
      railwayUpdated: Boolean(railway?.ok),
      railwayMessage: railway?.data?.message || railway?.error || null,
    },
  });
});

router.get('/paymob/paid-orders', async (req, res) => {
  if (!dbReady()) {
    return res.json({ data: { orderIds: [] } });
  }

  const sessions = await PaymentSession.find({ status: 'paid' })
    .select('brandhiveOrderId')
    .lean();

  return res.json({
    data: {
      orderIds: sessions.map((entry) => entry.brandhiveOrderId).filter(Boolean),
    },
  });
});

router.post('/paymob/reconcile/:orderId', async (req, res) => {
  const orderId = String(req.params.orderId || '');
  if (!orderId) {
    return res.status(400).json({ message: 'orderId is required' });
  }

  if (!dbReady()) {
    return res.status(503).json({ message: 'Payment database unavailable' });
  }

  const session = await PaymentSession.findOne({ brandhiveOrderId: orderId }).lean();
  if (!session || session.status !== 'paid') {
    return res.status(404).json({ message: 'No paid payment session for this order' });
  }

  const railway = await forwardPaymobWebhookToRailway(orderId, {
    id: session.paymobTransactionId,
    merchant_order_id: session.paymobMerchantOrderId,
    amount_cents: session.amountCents,
    currency: session.currency,
  });

  return res.json({
    data: {
      orderId,
      railwayUpdated: Boolean(railway?.ok),
      railwayMessage: railway?.data?.message || railway?.error || null,
    },
  });
});

router.post('/paymob/webhook', async (req, res) => {
  const transaction = req.body?.obj || req.body?.transaction || req.body;
  const merchantRef =
    transaction?.order?.merchant_order_id ||
    transaction?.merchant_order_id ||
    transaction?.order?.id;
  const orderId = merchantRef ? parseBrandhiveOrderId(merchantRef) : null;

  if (dbReady() && orderId) {
    const success = Boolean(transaction?.success);
    await PaymentSession.findOneAndUpdate(
      { brandhiveOrderId: String(orderId) },
      {
        status: success ? 'paid' : 'failed',
        ...(transaction?.id ? { paymobTransactionId: String(transaction.id) } : {}),
        ...(merchantRef ? { paymobMerchantOrderId: String(merchantRef) } : {}),
      },
      { upsert: false }
    );

    if (success) {
      await forwardPaymobWebhookToRailway(String(orderId), {
        id: transaction?.id,
        merchant_order_id: merchantRef,
        amount_cents: transaction?.amount_cents,
        currency: transaction?.currency,
      });
    }
  }

  return res.status(200).json({ received: true });
});

module.exports = router;
