const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminUserId: { type: String, index: true },
    adminEmail: { type: String, lowercase: true, trim: true },
    adminName: { type: String, trim: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, index: true },
    targetId: { type: String, index: true },
    targetLabel: { type: String, trim: true },
    details: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
