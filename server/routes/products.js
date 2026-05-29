const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({ success: true, data: [], message: 'Use frontend mock data for now' });
});

router.get('/:slug', (req, res) => {
  res.json({ success: true, data: null });
});

module.exports = router;
