const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const storageService = require('../services/storageService');
const metadataExtractor = require('../services/metadataExtractor');
const { AccessControlService, PERMISSIONS } = require('../services/accessControlService');
const { Document: DocumentModel } = require('../models');

const router = express.Router();
const accessControl = new AccessControlService();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for a document management system
    cb(null, true);
  }
});

// Upload a document
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer || require('fs').readFileSync(req.file.path);
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;

    // Extract metadata
    const metadata = await metadataExtractor.extractMetadata(fileBuffer, originalName);

    // Upload to storage
    const filePath = await storageService.upload(fileBuffer, metadata.contentHash, mimeType);

    // Create document record
    const document = new DocumentModel({
      name: originalName,
      path: filePath,
      size: req.file.size,
      mimeType: mimeType,
      contentHash: metadata.contentHash,
      metadata: metadata,
      uploadedBy: req.userId
    });

    await document.save();

    // Grant the uploader full permissions
    await accessControl.grantPermission(
      'document', 
      document._id, 
      'user', 
      req.userId, 
      null, 
      PERMISSIONS.ADMIN, 
      req.userId
    );

    // Clean up temp file if it was saved to disk
    if (req.file.path) {
      require('fs').unlinkSync(req.file.path);
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      documentId: document._id,
      fileName: document.name,
      size: document.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get document by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.id;
    
    // Check if user has read permission
    const hasPermission = await accessControl.hasPermission(
      req.userId, 
      'document', 
      documentId, 
      PERMISSIONS.READ
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const document = await DocumentModel.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Update last accessed time
    document.lastAccessed = new Date();
    await document.save();

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download document by ID
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.id;
    
    // Check if user has read permission
    const hasPermission = await accessControl.hasPermission(
      req.userId, 
      'document', 
      documentId, 
      PERMISSIONS.READ
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const document = await DocumentModel.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get file from storage
    const fileBuffer = await storageService.download(document.path);

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', document.size);

    res.send(fileBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// List documents with access control
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get all documents user has read access to
    const accessibleDocIds = await accessControl.getUserAccessibleResources(
      req.userId, 
      'document', 
      PERMISSIONS.READ
    );

    const documents = await DocumentModel.find({
      _id: { $in: accessibleDocIds },
      status: 'active'
    }).select('name size mimeType uploadedAt lastAccessed uploadedBy tags').lean();

    res.json(documents);
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update document permissions
router.put('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { granteeType, granteeId, granteeName, permission } = req.body;

    // Check if user has admin permission on the document
    const hasPermission = await accessControl.hasPermission(
      req.userId, 
      'document', 
      id, 
      PERMISSIONS.ADMIN
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied. Admin permission required to manage permissions.' });
    }

    // Grant the new permission
    await accessControl.grantPermission(
      'document',
      id,
      granteeType,
      granteeId,
      granteeName,
      permission,
      req.userId
    );

    res.json({ message: 'Permission granted successfully' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Get document permissions
router.get('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has read permission on the document
    const hasReadPermission = await accessControl.hasPermission(
      req.userId, 
      'document', 
      id, 
      PERMISSIONS.READ
    );
    
    if (!hasReadPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const permissions = await accessControl.getResourcePermissions('document', id);
    res.json(permissions);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has delete permission
    const hasDeletePermission = await accessControl.hasPermission(
      req.userId, 
      'document', 
      id, 
      PERMISSIONS.DELETE
    );
    
    if (!hasDeletePermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const document = await DocumentModel.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from storage
    await storageService.delete(document.path);

    // Soft delete from database
    document.status = 'deleted';
    await document.save();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Search documents
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const { query, tags, uploadedBy, dateFrom, dateTo } = req.body;

    // Get accessible documents for the user
    const accessibleDocIds = await accessControl.getUserAccessibleResources(
      req.userId, 
      'document', 
      PERMISSIONS.READ
    );

    const filter = {
      _id: { $in: accessibleDocIds },
      status: 'active'
    };

    if (query) {
      // Search in extracted text and document name
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { 'metadata.extractedText': { $regex: query, $options: 'i' } }
      ];
    }

    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    if (uploadedBy) {
      filter.uploadedBy = uploadedBy;
    }

    if (dateFrom || dateTo) {
      filter.uploadedAt = {};
      if (dateFrom) {
        filter.uploadedAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.uploadedAt.$lte = new Date(dateTo);
      }
    }

    const documents = await DocumentModel.find(filter)
      .select('name size mimeType uploadedAt lastAccessed uploadedBy tags metadata')
      .limit(50); // Limit results

    res.json(documents);
  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
});

module.exports = router;