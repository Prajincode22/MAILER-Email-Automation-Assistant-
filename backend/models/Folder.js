const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  color: { type: String, default: '#3B82F6' }, // Default blue
  gmailLabelId: { type: String } // Links local folder to the official Gmail Label
}, { timestamps: true });

module.exports = mongoose.model('Folder', FolderSchema);