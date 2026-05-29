const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET } = require('../middleware/auth');

// In-memory users for demo (when no DB)
const demoUsers = [
  { _id: 'u1', name: 'Nadia Mohamed', email: 'nadia@example.com', password: '$2a$10$demo_hash_customer', role: 'customer' },
  { _id: 'u2', name: 'Ahmed Hassan', email: 'ahmed@luxorcrafts.com', password: '$2a$10$demo_hash_seller', role: 'seller', brandName: 'Luxor Crafts' },
  { _id: 'u3', name: 'Admin', email: 'admin@brandhive.com', password: '$2a$10$demo_hash_admin', role: 'admin' },
];

let User;
try {
  User = require('../models/User');
} catch {
  User = null;
}

const signToken = (user) => jwt.sign(
  { id: user._id, email: user.email, role: user.role, name: user.name },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, governorate } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (User) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });

      const user = await User.create({ name, email, password, phone, role: role || 'customer', governorate });
      const token = signToken(user);
      return res.status(201).json({ success: true, token, user });
    }

    // Demo fallback
    const token = signToken({ _id: `u_${Date.now()}`, email, role: role || 'customer', name });
    res.status(201).json({ success: true, token, user: { name, email, role: role || 'customer', phone } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    if (User) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const token = signToken(user);
      return res.json({ success: true, token, user });
    }

    // Demo accounts fallback
    const demoPasswords = {
      'nadia@example.com': 'password123',
      'ahmed@luxorcrafts.com': 'password123',
      'admin@brandhive.com': 'admin123',
    };

    const demoUser = demoUsers.find(u => u.email === email.toLowerCase());
    if (!demoUser || demoPasswords[email.toLowerCase()] !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(demoUser);
    const { password: _, ...userWithoutPw } = demoUser;
    res.json({ success: true, token, user: userWithoutPw });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get current user
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    if (User) {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, user });
    }
    res.json({ success: true, user: req.user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
