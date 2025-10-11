const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const config = require('../config');

class StorageService {
  constructor() {
    this.type = config.storage.type;
    
    if (this.type === 's3') {
      this.s3 = new AWS.S3({
        accessKeyId: config.storage.s3.accessKeyId,
        secretAccessKey: config.storage.s3.secretAccessKey,
        region: config.storage.s3.region,
        endpoint: config.storage.s3.endpoint || undefined,
        s3ForcePathStyle: !!config.storage.s3.endpoint // for minio or other S3-compatible services
      });
      this.bucket = config.storage.s3.bucket;
    } else if (this.type === 'disk') {
      this.uploadDir = config.storage.disk.uploadDir;
      // Create upload directory if it doesn't exist
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } else {
      throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  /**
   * Upload a file to the configured storage
   * @param {Buffer} fileBuffer - The file buffer to upload
   * @param {string} fileName - The name of the file
   * @param {string} mimeType - The MIME type of the file
   * @returns {Promise<string>} The path or key of the uploaded file
   */
  async upload(fileBuffer, fileName, mimeType) {
    if (this.type === 's3') {
      const params = {
        Bucket: this.bucket,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType
      };

      const result = await this.s3.upload(params).promise();
      return result.Key; // Return the S3 key
    } else {
      const filePath = path.join(this.uploadDir, fileName);
      await fs.promises.writeFile(filePath, fileBuffer);
      return fileName; // Return the relative file path
    }
  }

  /**
   * Download a file from the configured storage
   * @param {string} filePath - The path or key of the file to download
   * @returns {Promise<Buffer>} The file buffer
   */
  async download(filePath) {
    if (this.type === 's3') {
      const params = {
        Bucket: this.bucket,
        Key: filePath
      };

      const result = await this.s3.getObject(params).promise();
      return result.Body;
    } else {
      const fullPath = path.join(this.uploadDir, filePath);
      return await fs.promises.readFile(fullPath);
    }
  }

  /**
   * Delete a file from the configured storage
   * @param {string} filePath - The path or key of the file to delete
   * @returns {Promise<void>}
   */
  async delete(filePath) {
    if (this.type === 's3') {
      const params = {
        Bucket: this.bucket,
        Key: filePath
      };

      await this.s3.deleteObject(params).promise();
    } else {
      const fullPath = path.join(this.uploadDir, filePath);
      await fs.promises.unlink(fullPath);
    }
  }

  /**
   * Get metadata for a file
   * @param {string} filePath - The path or key of the file
   * @returns {Promise<Object>} File metadata
   */
  async getMetadata(filePath) {
    if (this.type === 's3') {
      const params = {
        Bucket: this.bucket,
        Key: filePath
      };

      const head = await this.s3.headObject(params).promise();
      return {
        size: head.ContentLength,
        lastModified: head.LastModified,
        mimeType: head.ContentType,
        etag: head.ETag
      };
    } else {
      const fullPath = path.join(this.uploadDir, filePath);
      const stats = await fs.promises.stat(fullPath);
      
      return {
        size: stats.size,
        lastModified: stats.mtime,
        mimeType: 'application/octet-stream' // We'd need to determine this differently in a real implementation
      };
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - The path or key of the file
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    try {
      if (this.type === 's3') {
        const params = {
          Bucket: this.bucket,
          Key: filePath
        };
        
        await this.s3.headObject(params).promise();
        return true;
      } else {
        const fullPath = path.join(this.uploadDir, filePath);
        return await fs.promises.access(fullPath, fs.constants.F_OK)
          .then(() => true)
          .catch(() => false);
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the URL for accessing a file (if applicable)
   * @param {string} filePath - The path or key of the file
   * @returns {string} The URL to access the file
   */
  getFileUrl(filePath) {
    if (this.type === 's3') {
      // Generate a pre-signed URL for the file (valid for 1 hour by default)
      const params = {
        Bucket: this.bucket,
        Key: filePath,
        Expires: 3600
      };
      
      return this.s3.getSignedUrl('getObject', params);
    } else {
      // For disk storage, return a relative path that can be served by the web server
      return `/uploads/${filePath}`;
    }
  }
}

module.exports = new StorageService();