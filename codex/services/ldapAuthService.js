const ldap = require('ldapjs');
const config = require('../config');

class LdapAuthService {
  constructor() {
    this.client = null;
    this.options = config.ldap;
  }

  /**
   * Initialize the LDAP client
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.client = ldap.createClient({
        url: this.options.url
      });

      this.client.on('connect', () => {
        console.log('LDAP client connected');
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('LDAP client error:', err);
        reject(err);
      });
    });
  }

  /**
   * Authenticate a user against LDAP
   * @param {string} username - The username to authenticate
   * @param {string} password - The password to authenticate with
   * @returns {Promise<Object>} User information if authentication succeeds
   */
  async authenticate(username, password) {
    if (!this.client) {
      throw new Error('LDAP client not initialized');
    }

    // First, search for the user
    const searchFilter = this.options.searchFilter.replace('{{username}}', username);
    const opts = {
      filter: searchFilter,
      scope: 'sub',
      attributes: this.options.attributes
    };

    return new Promise((resolve, reject) => {
      this.client.search(this.options.searchBase, opts, (err, searchResult) => {
        if (err) {
          return reject(err);
        }

        let userEntry = null;
        let userDN = null;

        searchResult.on('searchEntry', (entry) => {
          userEntry = entry.object;
          userDN = entry.dn.toString();
        });

        searchResult.on('error', (err) => {
          reject(err);
        });

        searchResult.on('end', async (result) => {
          if (!userDN) {
            return reject(new Error('User not found'));
          }

          // Now try to bind with the user's DN and provided password
          try {
            await this.bindUser(userDN, password);
            resolve(userEntry);
          } catch (bindErr) {
            reject(bindErr);
          }
        });
      });
    });
  }

  /**
   * Bind with user credentials to verify password
   * @param {string} userDN - The user's distinguished name
   * @param {string} password - The password to verify
   * @returns {Promise<void>}
   */
  bindUser(userDN, password) {
    return new Promise((resolve, reject) => {
      // Create a temporary client to bind with user credentials
      const tempClient = ldap.createClient({
        url: this.options.url
      });

      tempClient.bind(userDN, password, (err) => {
        tempClient.destroy(); // Close the temporary connection
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Search for users in LDAP
   * @param {string} filter - The search filter
   * @param {Array} attributes - Attributes to return
   * @returns {Promise<Array>} Array of user objects
   */
  async searchUsers(filter, attributes = this.options.attributes) {
    if (!this.client) {
      throw new Error('LDAP client not initialized');
    }

    const opts = {
      filter: filter,
      scope: 'sub',
      attributes: attributes
    };

    return new Promise((resolve, reject) => {
      const users = [];
      
      this.client.search(this.options.searchBase, opts, (err, searchResult) => {
        if (err) {
          return reject(err);
        }

        searchResult.on('searchEntry', (entry) => {
          users.push(entry.object);
        });

        searchResult.on('error', (err) => {
          reject(err);
        });

        searchResult.on('end', () => {
          resolve(users);
        });
      });
    });
  }

  /**
   * Close the LDAP client connection
   */
  close() {
    if (this.client) {
      this.client.unbind(() => {
        console.log('LDAP client disconnected');
      });
    }
  }
}

module.exports = LdapAuthService;