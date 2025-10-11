const path = require('path');
require('dotenv').config();

// Default configuration
let config = require('./default.json');

// Load environment-specific configuration
const envConfigPath = path.join(__dirname, `${process.env.NODE_ENV || 'default'}.json`);
try {
  const envConfig = require(envConfigPath);
  config = { ...config, ...envConfig };
} catch (error) {
  // Environment-specific config file doesn't exist, using default
  console.log(`No configuration file found for environment: ${process.env.NODE_ENV || 'default'}`);
}

// Override with environment variables if they exist
config.app.port = process.env.PORT || config.app.port;
config.app.jwtSecret = process.env.JWT_SECRET || config.app.jwtSecret;
config.database.uri = process.env.MONGODB_URI || config.database.uri;

// Storage configuration
config.storage.type = process.env.STORAGE_TYPE || config.storage.type;
if (config.storage.type === 's3') {
  config.storage.s3.accessKeyId = process.env.S3_ACCESS_KEY_ID || config.storage.s3.accessKeyId;
  config.storage.s3.secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || config.storage.s3.secretAccessKey;
  config.storage.s3.region = process.env.S3_REGION || config.storage.s3.region;
  config.storage.s3.bucket = process.env.S3_BUCKET || config.storage.s3.bucket;
  config.storage.s3.endpoint = process.env.S3_ENDPOINT || config.storage.s3.endpoint;
} else {
  config.storage.disk.uploadDir = process.env.UPLOAD_DIR || config.storage.disk.uploadDir;
}

// LDAP configuration
if (process.env.LDAP_URL) config.ldap.url = process.env.LDAP_URL;
if (process.env.LDAP_BIND_DN) config.ldap.bindDN = process.env.LDAP_BIND_DN;
if (process.env.LDAP_BIND_CREDENTIALS) config.ldap.bindCredentials = process.env.LDAP_BIND_CREDENTIALS;
if (process.env.LDAP_SEARCH_BASE) config.ldap.searchBase = process.env.LDAP_SEARCH_BASE;
if (process.env.LDAP_SEARCH_FILTER) config.ldap.searchFilter = process.env.LDAP_SEARCH_FILTER;

module.exports = config;