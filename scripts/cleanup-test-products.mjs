/**
 * Remove test / image-less products from the live BrandHive catalog.
 *
 * Usage:
 *   node scripts/cleanup-test-products.mjs              # dry-run (default)
 *   node scripts/cleanup-test-products.mjs --execute    # delete via admin API
 *
 * Auth (one of):
 *   BRANDHIVE_ADMIN_TOKEN=...
 *   BRANDHIVE_ADMIN_EMAIL=... BRANDHIVE_ADMIN_PASSWORD=...
 *
 * Optional:
 *   BRANDHIVE_API_URL=https://brandhive-apis-production.up.railway.app
 *   --include-no-image   also target published products without images
 */

const BASE_URL =
  process.env.BRANDHIVE_API_URL ||
  'https://brandhive-apis-production.up.railway.app';

const TEST_NAME_PATTERNS = [
  /^test\b/i,
  /testt/i,
  /^mmmm+$/i,
  /^xxx+$/i,
  /^demo$/i,
  /^sample$/i,
  /^asdf/i,
  /^foo+$/i,
  /^bar+$/i,
];

const isTestProductName = (name) => {
  const value = String(name || '').trim();
  if (!value || value.length < 2) return true;
  return TEST_NAME_PATTERNS.some((pattern) => pattern.test(value));
};

const hasProductImage = (product) => {
  if (!product) return false;
  const mainImage = product.mainImage;
  if (typeof mainImage === 'string' && mainImage.trim()) return true;
  if (mainImage?.url) return true;
  const images = product.images;
  if (!Array.isArray(images) || images.length === 0) return false;
  const first = images[0];
  return Boolean(typeof first === 'string' ? first.trim() : first?.url);
};

const execute = process.argv.includes('--execute');
const includeNoImage = process.argv.includes('--include-no-image');

async function getAdminToken() {
  if (process.env.BRANDHIVE_ADMIN_TOKEN) {
    return process.env.BRANDHIVE_ADMIN_TOKEN;
  }

  const email = process.env.BRANDHIVE_ADMIN_EMAIL;
  const password = process.env.BRANDHIVE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set BRANDHIVE_ADMIN_TOKEN or BRANDHIVE_ADMIN_EMAIL + BRANDHIVE_ADMIN_PASSWORD'
    );
  }

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || body.error || `Login failed (${res.status})`);
  }

  const token =
    body.data?.accessToken ||
    body.data?.token ||
    body.accessToken ||
    body.token;
  if (!token) throw new Error('Login succeeded but no access token in response');
  return token;
}

async function fetchAllProducts() {
  const res = await fetch(`${BASE_URL}/search/products?limit=100`);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || body.error || `Fetch failed (${res.status})`);
  }
  return Array.isArray(body.data) ? body.data : [];
}

async function deleteProduct(token, id) {
  const res = await fetch(`${BASE_URL}/product/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || body.error || `Delete failed (${res.status})`);
  }
  return body;
}

async function main() {
  const products = await fetchAllProducts();
  const targets = products.filter((product) => {
    const testName = isTestProductName(product.name);
    const noImage = !hasProductImage(product);
    if (testName) return true;
    return includeNoImage && noImage;
  });

  console.log(`API: ${BASE_URL}`);
  console.log(`Catalog scanned: ${products.length}`);
  console.log(`Targets: ${targets.length}`);

  if (targets.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  targets.forEach((product) => {
    console.log(
      `- ${product.name} (${product.id || product._id})` +
        `${hasProductImage(product) ? '' : ' [no image]'}`
    );
  });

  if (!execute) {
    console.log('\nDry run only. Re-run with --execute to delete.');
    return;
  }

  const token = await getAdminToken();
  let deleted = 0;

  for (const product of targets) {
    const id = product.id || product._id;
    try {
      await deleteProduct(token, id);
      deleted += 1;
      console.log(`Deleted: ${product.name} (${id})`);
    } catch (err) {
      console.error(`Failed ${product.name} (${id}): ${err.message}`);
    }
  }

  console.log(`\nDone. Deleted ${deleted}/${targets.length}.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
