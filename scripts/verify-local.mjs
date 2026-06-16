#!/usr/bin/env node
/**
 * Quick check: companion server + Paymob config (run after npm run dev:all).
 * Usage: node scripts/verify-local.mjs
 */

const BASE = process.env.COMPANION_URL || 'http://127.0.0.1:5000';

async function check(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log(`Checking companion server at ${BASE}\n`);

  try {
    const health = await check('/health');
    console.log(health.ok ? '✅ Health OK' : `❌ Health failed (${health.status})`);
    if (health.body?.message) console.log(`   ${health.body.message}`);
  } catch (err) {
    console.log('❌ Server not reachable — run: npm run dev:all');
    console.log(`   ${err.message}`);
    process.exit(1);
  }

  try {
    const paymob = await check('/payment/paymob/status');
    const data = paymob.body?.data || paymob.body || {};
    if (data.configured) {
      console.log('✅ Paymob configured (card)');
    } else {
      console.log('⚠️  Paymob card not configured — add keys to server/.env');
    }
    if (data.fawryConfigured) {
      console.log('✅ Fawry configured');
    }
  } catch {
    console.log('⚠️  Could not read Paymob status');
  }

  try {
    const slots = await check('/platform/featured-slots');
    const ids = slots.body?.data?.productIds || [];
    console.log(`✅ Featured slots API (${ids.length} products)`);
  } catch {
    console.log('⚠️  Featured slots unavailable (MongoDB offline?)');
  }

  try {
    const profile = await check('/platform/users/verify-local-test/profile');
    console.log(profile.status === 200 ? '✅ Profile storage API' : '⚠️  Profile storage API');
  } catch {
    console.log('⚠️  Profile storage unavailable');
  }

  console.log('\nClient: http://localhost:5173');
  console.log('Run: npm run dev   (starts client + server)');
  console.log('Paymob test card: 4111 1111 1111 1111 | CVV 123 | Exp 01/39');
}

main();
