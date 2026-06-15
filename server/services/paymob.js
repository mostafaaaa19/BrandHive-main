const PAYMOB_BASE = 'https://accept.paymob.com/api';

const uniqueMerchantOrderId = (brandhiveOrderId) => {
  const base = String(brandhiveOrderId || '').trim();
  if (!base) return undefined;
  return `${base}-r${Date.now()}`;
};

const parseBrandhiveOrderId = (merchantOrderId) => {
  const raw = String(merchantOrderId || '').trim();
  const match = raw.match(/^([a-f\d]{24})/i);
  if (match) return match[1];
  const suffix = raw.indexOf('-r');
  if (suffix > 0) return raw.slice(0, suffix);
  return raw;
};

const isPaymobReturnSuccess = (params = {}) => {
  const success = params.success;
  if (success === true || success === 'true' || success === '1') return true;

  const code = String(params.txn_response_code || params.txn_response || '').toUpperCase();
  if (code === 'APPROVED') return true;

  const message = String(params.data_message || params.message || '').toLowerCase();
  if (message.includes('approved') || message.includes('success')) return true;

  if (params.paid === true || params.paid === 'true') return true;
  if (params.pending === true || params.pending === 'true') return false;

  return false;
};

const getConfig = (paymentMethod = 'paymob') => {
  const apiKey = process.env.PAYMOB_API_KEY;
  const iframeId = process.env.PAYMOB_IFRAME_ID;
  const integrationId =
    paymentMethod === 'fawry'
      ? process.env.PAYMOB_FAWRY_INTEGRATION_ID || process.env.PAYMOB_INTEGRATION_ID
      : process.env.PAYMOB_INTEGRATION_ID;

  return { apiKey, iframeId, integrationId };
};

const isPaymobConfigured = (paymentMethod = 'paymob') => {
  const { apiKey, iframeId, integrationId } = getConfig(paymentMethod);
  return Boolean(apiKey && iframeId && integrationId);
};

const paymobRequest = async (path, body) => {
  const res = await fetch(`${PAYMOB_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.detail ||
      data?.message ||
      (typeof data === 'string' ? data : null) ||
      `Paymob request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
};

const splitName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || 'Customer',
    last_name: parts.slice(1).join(' ') || 'BrandHive',
  };
};

const buildBillingData = ({ billing = {}, customerEmail = '' }) => {
  const names = splitName(billing.fullName || billing.name);
  const phone = String(billing.phone || '01000000000').replace(/\s+/g, '');

  return {
    apartment: 'NA',
    email: customerEmail || billing.email || 'customer@brandhive.com',
    floor: 'NA',
    first_name: names.first_name,
    last_name: names.last_name,
    street: billing.street || 'NA',
    building: 'NA',
    phone_number: phone,
    shipping_method: 'PKG',
    postal_code: billing.postalCode || 'NA',
    city: billing.city || billing.governorate || 'Cairo',
    country: 'EG',
    state: billing.governorate || billing.city || 'Cairo',
  };
};

const createPaymobCheckout = async ({
  amount,
  paymentMethod = 'paymob',
  billing = {},
  customerEmail = '',
  merchantOrderId = '',
  returnUrl = '',
}) => {
  if (!isPaymobConfigured(paymentMethod)) {
    throw new Error(
      'Paymob is not configured. Set PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, and PAYMOB_IFRAME_ID on the server.'
    );
  }

  const { apiKey, iframeId, integrationId } = getConfig(paymentMethod);
  const amountCents = Math.max(100, Math.round(Number(amount) * 100));

  const auth = await paymobRequest('/auth/tokens', { api_key: apiKey });
  const authToken = auth.token;
  if (!authToken) throw new Error('Paymob authentication failed');

  const merchantOrderRef = uniqueMerchantOrderId(merchantOrderId);
  const order = await paymobRequest('/ecommerce/orders', {
    auth_token: authToken,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: 'EGP',
    merchant_order_id: merchantOrderRef,
    items: [],
  });

  const paymobOrderId = order.id;
  if (!paymobOrderId) throw new Error('Paymob order registration failed');

  const paymentKeyBody = {
    auth_token: authToken,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: paymobOrderId,
    billing_data: buildBillingData({ billing, customerEmail }),
    currency: 'EGP',
    integration_id: Number(integrationId),
    lock_order_when_paid: true,
  };

  if (returnUrl) {
    paymentKeyBody.redirection_url = returnUrl;
  }

  const paymentKey = await paymobRequest('/acceptance/payment_keys', paymentKeyBody);
  const paymentToken = paymentKey.token;
  if (!paymentToken) throw new Error('Paymob payment key failed');

  const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`;

  return {
    paymentUrl,
    paymobOrderId,
    amountCents,
    paymentToken,
    merchantOrderRef,
  };
};

module.exports = {
  isPaymobConfigured,
  createPaymobCheckout,
  parseBrandhiveOrderId,
  isPaymobReturnSuccess,
};
