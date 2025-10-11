const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const LdapAuthService = require('../services/ldapAuthService');
const { User } = require('../models');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const ldapAuthService = new LdapAuthService();

// Initialize LDAP service on startup
ldapAuthService.initialize()
  .catch(err => {
    console.error('Failed to initialize LDAP service:', err);
  });

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let user;
    
    // Try LDAP authentication first if configured
    if (config.ldap && config.ldap.url) {
      try {
        const ldapUser = await ldapAuthService.authenticate(username, password);
        
        // Create or update user in our database
        user = await User.findOneAndUpdate(
          { username: username },
          { 
            ldapDn: ldapUser.dn,
            email: ldapUser.mail || ldapUser.email || '',
            displayName: ldapUser.cn || ldapUser.displayName || username,
            groups: Array.isArray(ldapUser.memberOf) ? ldapUser.memberOf : [ldapUser.memberOf || '']
          },
          { upsert: true, new: true }
        );
      } catch (ldapErr) {
        console.log('LDAP authentication failed, trying local auth:', ldapErr.message);
        // Fallback to local authentication if LDAP fails
        user = await User.findOne({ username });
        if (!user || !await bcrypt.compare(password, user.password)) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }
    } else {
      // Only local authentication
      user = await User.findOne({ username });
      if (!user || !user.password || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      config.app.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      groups: user.groups
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token invalidation)
router.post('/logout', authenticateToken, (req, res) => {
  // In a real implementation, you might want to maintain a blacklist of tokens
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;