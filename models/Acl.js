const mongoose = require('mongoose');

const aclSchema = new mongoose.Schema({
  resourceType: { 
    type: String, 
    required: true, 
    enum: ['document', 'folder', 'system'] // Can be extended
  },
  resourceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    refPath: 'resourceType' 
  },
  granteeType: { 
    type: String, 
    required: true, 
    enum: ['user', 'group', 'role', 'public'] 
  },
  granteeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  granteeName: { type: String }, // For public permissions or when ref is not applicable
  permission: { 
    type: String, 
    required: true, 
    enum: ['read', 'write', 'delete', 'admin'] 
  },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  grantedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // Optional expiration date for the permission
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes for efficient queries
aclSchema.index({ resourceType: 1, resourceId: 1 });
aclSchema.index({ granteeType: 1, granteeId: 1 });
aclSchema.index({ resourceType: 1, resourceId: 1, granteeType: 1, granteeId: 1, permission: 1 });

module.exports = mongoose.model('Acl', aclSchema);