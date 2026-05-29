const router = require('express').Router();

// Mock data - replace with DB queries
const { brands, products } = (() => {
  try {
    return { brands: [], products: [] };
  } catch { return { brands: [], products: [] }; }
})();

router.get('/', (req, res) => {
  res.json({ success: true, data: [], message: 'Use frontend mock data for now' });
});

router.get('/:slug', (req, res) => {
  res.json({ success: true, data: null, message: 'Use frontend mock data for now' });
});

module.exports = router;
