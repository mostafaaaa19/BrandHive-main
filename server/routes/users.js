const router = require('express').Router();
const { auth, adminOnly } = require('../middleware/auth');

router.get('/profile', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.put('/profile', auth, (req, res) => {
  res.json({ success: true, message: 'Profile updated', user: { ...req.user, ...req.body } });
});

module.exports = router;
