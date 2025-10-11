const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true }, // Path in storage system
  size: { type: Number },
  mimeType: { type: String },
  contentHash: { type: String, unique: true }, // For deduplication
  metadata: { type: mongoose.Schema.Types.Mixed }, // Extracted metadata
  uploadedBy: { type: String, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  lastAccessed: { type: Date },
  tags: [{ type: String }],
  status: { type: String, default: 'active' } // active, archived, deleted
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);