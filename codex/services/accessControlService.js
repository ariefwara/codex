const mongoose = require('mongoose');
const { User, Document: DocumentModel } = require('../models');
const Acl = require('../models/Acl');

// Define permission types
const PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin'
};

class AccessControlService {
  /**
   * Check if a user has a specific permission on a resource
   * @param {string} userId - The ID of the user
   * @param {string} resourceType - Type of resource (document, folder, etc.)
   * @param {string} resourceId - The ID of the resource
   * @param {string} permission - The permission to check (read, write, etc.)
   * @returns {Promise<boolean>} Whether the user has the permission
   */
  async hasPermission(userId, resourceType, resourceId, permission) {
    // First, check if the user is an admin of the resource
    const adminPermission = await Acl.findOne({
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      granteeType: 'user',
      granteeId: new mongoose.Types.ObjectId(userId),
      permission: PERMISSIONS.ADMIN,
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (adminPermission) return true;

    // Check for the specific permission
    const directPermission = await Acl.findOne({
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      granteeType: 'user',
      granteeId: new mongoose.Types.ObjectId(userId),
      permission: permission,
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (directPermission) return true;

    // Check for group-based permissions
    const user = await User.findById(userId);
    if (user && user.groups && user.groups.length > 0) {
      const groupPermission = await Acl.findOne({
        resourceType,
        resourceId: new mongoose.Types.ObjectId(resourceId),
        granteeType: 'group',
        granteeName: { $in: user.groups },
        permission: permission,
        active: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      if (groupPermission) return true;
    }

    // Check for public permissions
    const publicPermission = await Acl.findOne({
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      granteeType: 'public',
      permission: permission,
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    return !!publicPermission;
  }

  /**
   * Grant a permission to a user/group on a resource
   * @param {string} resourceType - Type of resource (document, folder, etc.)
   * @param {string} resourceId - The ID of the resource
   * @param {string} granteeType - Type of grantee (user, group, role, public)
   * @param {string} granteeId - The ID of the grantee (null for public)
   * @param {string} granteeName - Name of the grantee (for groups/public)
   * @param {string} permission - The permission to grant
   * @param {string} grantedById - ID of the user granting the permission
   * @param {Date} expiresAt - Optional expiration date
   * @returns {Promise<Object>} The created ACL entry
   */
  async grantPermission(resourceType, resourceId, granteeType, granteeId, granteeName, permission, grantedById, expiresAt = null) {
    // Validate permission
    if (!Object.values(PERMISSIONS).includes(permission)) {
      throw new Error(`Invalid permission: ${permission}`);
    }

    // Check if the grantee exists and is valid
    if (granteeType === 'user' && granteeId) {
      const userExists = await User.findById(granteeId);
      if (!userExists) {
        throw new Error(`User not found: ${granteeId}`);
      }
    }

    // Create the ACL entry
    const aclEntry = new Acl({
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      granteeType,
      granteeId: granteeId ? new mongoose.Types.ObjectId(granteeId) : null,
      granteeName,
      permission,
      grantedBy: new mongoose.Types.ObjectId(grantedById),
      expiresAt
    });

    return await aclEntry.save();
  }

  /**
   * Revoke a permission from a user/group on a resource
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - The ID of the resource
   * @param {string} granteeType - Type of grantee
   * @param {string} granteeId - The ID of the grantee
   * @param {string} permission - The permission to revoke
   * @returns {Promise<number>} Number of permissions revoked
   */
  async revokePermission(resourceType, resourceId, granteeType, granteeId, permission) {
    const result = await Acl.updateMany(
      {
        resourceType,
        resourceId: new mongoose.Types.ObjectId(resourceId),
        granteeType,
        granteeId: granteeId ? new mongoose.Types.ObjectId(granteeId) : null,
        permission,
        active: true
      },
      {
        active: false
      }
    );

    return result.modifiedCount;
  }

  /**
   * Get all permissions for a resource
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - The ID of the resource
   * @returns {Promise<Array>} Array of ACL entries
   */
  async getResourcePermissions(resourceType, resourceId) {
    return await Acl.find({
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    }).populate('grantedBy', 'username displayName');
  }

  /**
   * Get all resources a user has access to
   * @param {string} userId - The ID of the user
   * @param {string} resourceType - Type of resource
   * @param {string} permission - The minimum permission required
   * @returns {Promise<Array>} Array of resource IDs
   */
  async getUserAccessibleResources(userId, resourceType, permission = PERMISSIONS.READ) {
    const userIdObj = new mongoose.Types.ObjectId(userId);
    
    // Get direct permissions
    const directAcls = await Acl.find({
      resourceType,
      granteeType: 'user',
      granteeId: userIdObj,
      permission: { $in: this.getPermissionHierarchy(permission) },
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    // Get group-based permissions
    const user = await User.findById(userId);
    let groupResourceIds = [];
    if (user && user.groups && user.groups.length > 0) {
      const groupAcls = await Acl.find({
        resourceType,
        granteeType: 'group',
        granteeName: { $in: user.groups },
        permission: { $in: this.getPermissionHierarchy(permission) },
        active: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });
      
      groupResourceIds = groupAcls.map(acl => acl.resourceId);
    }

    // Get public permissions
    const publicAcls = await Acl.find({
      resourceType,
      granteeType: 'public',
      permission: { $in: this.getPermissionHierarchy(permission) },
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    // Combine all resource IDs
    const directResourceIds = directAcls.map(acl => acl.resourceId);
    const publicResourceIds = publicAcls.map(acl => acl.resourceId);
    
    const allResourceIds = [...new Set([
      ...directResourceIds,
      ...groupResourceIds,
      ...publicResourceIds
    ])];

    return allResourceIds;
  }

  /**
   * Get the hierarchy of permissions (higher permissions include lower ones)
   * @param {string} permission - Base permission
   * @returns {Array} Array of permissions that include the base permission
   */
  getPermissionHierarchy(permission) {
    switch (permission) {
      case PERMISSIONS.ADMIN:
        return [PERMISSIONS.ADMIN, PERMISSIONS.DELETE, PERMISSIONS.WRITE, PERMISSIONS.READ];
      case PERMISSIONS.DELETE:
        return [PERMISSIONS.DELETE, PERMISSIONS.WRITE, PERMISSIONS.READ];
      case PERMISSIONS.WRITE:
        return [PERMISSIONS.WRITE, PERMISSIONS.READ];
      case PERMISSIONS.READ:
        return [PERMISSIONS.READ];
      default:
        return [];
    }
  }
}

module.exports = {
  AccessControlService,
  PERMISSIONS
};