const express = require('express');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

const dbReady = () => mongoose.connection.readyState === 1;

router.post('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Audit log storage unavailable (database offline)' });
  }

  const {
    adminUserId,
    adminEmail,
    adminName,
    action,
    targetType,
    targetId,
    targetLabel,
    details,
    status,
  } = req.body;

  if (!action) {
    return res.status(400).json({ message: 'action is required' });
  }

  try {
    const entry = await AuditLog.create({
      adminUserId: adminUserId ? String(adminUserId) : undefined,
      adminEmail: adminEmail ? String(adminEmail).toLowerCase().trim() : undefined,
      adminName: adminName || 'Admin',
      action: String(action),
      targetType: targetType || undefined,
      targetId: targetId ? String(targetId) : undefined,
      targetLabel: targetLabel || undefined,
      details: details || undefined,
      status: status || 'success',
    });

    return res.status(201).json({ data: entry });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to save audit log' });
  }
});

router.get('/', async (req, res) => {
  if (!dbReady()) {
    return res.status(503).json({ message: 'Audit log storage unavailable (database offline)' });
  }

  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const action = req.query.action;

  try {
    const query = action ? { action: String(action) } : {};
    const entries = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({ data: entries });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load audit logs' });
  }
});

module.exports = router;
