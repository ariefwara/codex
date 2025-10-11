const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String },
  displayName: { type: String },
  ldapDn: { type: String }, // LDAP distinguished name
  groups: [{ type: String }] // LDAP groups user belongs to
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);