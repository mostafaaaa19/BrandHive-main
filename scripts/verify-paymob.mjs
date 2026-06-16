#!/usr/bin/env node
/**
 * Paymob companion-server checks (run after npm run dev).
 * Full checkout still needs a logged-in user + pending order in the browser.
 */

const BASE = process.env.COMPANION_URL || 'http://127.0.0.1:5000';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  console.log(`Paymob checks @ ${BASE}\n`);

  try {
    await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.log('❌ Companion server offline — run: npm run dev');
    console.log(`   ${err.message}`);
    process.exit(1);
  }

  const status = await request('GET', '/payment/paymob/status');
  const cfg = status.json?.data || status.json || {};
  if (!cfg.configured) {
    console.log('❌ Paymob card keys missing in server/.env');
    process.exit(1);
  }
  console.log('✅ Paymob card configured');
  if (cfg.fawryConfigured) console.log('✅ Fawry configured');

  const missingOrder = await request('POST', '/payment/paymob/initiate', {});
  if (missingOrder.status === 400) {
    console.log('✅ Initiate endpoint validates orderId');
  } else {
    console.log(`⚠️  Initiate without orderId → HTTP ${missingOrder.status}`);
  }

  const fakeOrder = await request('POST', '/payment/paymob/initiate', {
    orderId: '000000000000000000000000',
    amount: 100,
  });
  if (fakeOrder.status === 400) {
    console.log('✅ Initiate rejects unknown order (needs real pending order + JWT)');
  } else if (fakeOrder.status === 502) {
    console.log('⚠️  Paymob API error — check PAYMOB_* keys are TEST keys');
    console.log(`   ${fakeOrder.json?.message || 'unknown'}`);
  } else {
    console.log(`ℹ️  Initiate test order → HTTP ${fakeOrder.status}`);
  }

  console.log('\n--- Manual test in browser ---');
  console.log('1. Login as customer');
  console.log('2. Add product → Cart → Checkout → Pay with card');
  console.log('3. Card: 4111 1111 1111 1111 | CVV 123 | Exp 01/39');
  console.log('4. OTP if asked: 123456');
  console.log('5. Return URL: /payment/return?orderId=...');
}

main();
