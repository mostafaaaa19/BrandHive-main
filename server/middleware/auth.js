const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'brandhive_secret_key_2024';

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token is not valid' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const sellerOnly = (req, res, next) => {
  if (!['admin', 'seller'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Seller access required' });
  }
  next();
};

module.exports = { auth, adminOnly, sellerOnly, JWT_SECRET };
