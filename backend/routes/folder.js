const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/User');
const Folder = require('../models/Folder');

// Create a new folder & sync with Gmail Native Labels
router.post('/create', async (req, res) => {
  const { userId, name, color } = req.body;
  if (!userId || !name) return res.status(400).json({ error: 'Missing userId or name' });

  try {
    const user = await User.findById(userId);
    let gmailLabelId = null;

    // Try creating the native Gmail Label first
    try {
      const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
      oauth2Client.setCredentials(user.tokens);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const labelRes = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      gmailLabelId = labelRes.data.id;
      console.log(`✅ Created Gmail Label: ${name} (${gmailLabelId})`);
    } catch (gmailErr) {
      console.warn('⚠️ Could not create Gmail label, creating local-only folder:', gmailErr.message);
    }

    // Save to MongoDB
    const folder = new Folder({ userId, name, color: color || '#3B82F6', gmailLabelId });
    await folder.save();

    res.status(201).json(folder);
  } catch (error) {
    console.error('❌ Folder Creation Error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Get all custom folders for the user
router.get('/list/:userId', async (req, res) => {
  try {
    const folders = await Folder.find({ userId: req.params.userId });
    res.status(200).json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

module.exports = router;