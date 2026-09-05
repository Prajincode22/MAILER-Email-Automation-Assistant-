const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String },
  picture: { type: String },
  tokens: {
    access_token: { type: String, required: true },
    refresh_token: { type: String },
    scope: { type: String },
    token_type: { type: String },
    expiry_date: { type: Number }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);