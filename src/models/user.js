const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  googleId: String,
  sub: String,
  name: String,
  given_name: String,
  family_name: String,
  picture: String,
  email_verified: Boolean,
  accessToken: String,
  refreshToken: String
}, {
  timestamps: true  
});

module.exports = mongoose.model('User', userSchema);