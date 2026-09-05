const mongoose = require('mongoose');

const EmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gmailId: { type: String, required: true, unique: true },
  subject: { type: String },
  sender: { type: String },
  snippet: { type: String },
  body: { type: String },
  folders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Folder' }],
  date: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Email', EmailSchema);