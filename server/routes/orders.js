const router = require('express').Router();
const { auth } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json({ success: true, data: [] });
});

router.post('/', auth, (req, res) => {
  const order = { _id: `ORD-${Date.now()}`, ...req.body, userId: req.user.id, status: 'pending', createdAt: new Date() };
  res.status(201).json({ success: true, data: order });
});

module.exports = router;
