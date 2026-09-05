const express = require('express');
const router = express.Router();
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { google } = require('googleapis');
const User = require('../models/User');
const Folder = require('../models/Folder');

const redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const emailQueue = new Queue('email-queue', { connection: redisClient });

router.post('/sync', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  // Add task to Redis queue and immediately respond to frontend
  await emailQueue.add('fetch-emails', { userId });
  
  res.status(202).json({ message: 'Email sync started in the background' });
});
const Email = require('../models/Email');

// Fetch saved emails for a specific user
router.get('/list/:userId', async (req, res) => {
  try {
    const emails = await Email.find({ userId: req.params.userId }).sort({ date: -1 });
    res.status(200).json(emails);
  } catch (error) {
    console.error('Database fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});
// --- NEW ROUTE: SEND EMAIL ---
router.post('/send', async (req, res) => {
  const { userId, to, subject, body } = req.body;

  if (!userId || !to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields (userId, to, subject, body)' });
  }

  try {
    // 1. Fetch the user's OAuth tokens from MongoDB
    const user = await User.findById(userId);
    if (!user || !user.tokens) {
      return res.status(404).json({ error: 'User or OAuth tokens not found' });
    }

    // 2. Initialize the Google API client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials(user.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 3. Construct the raw RFC 2822 email string
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      body,
    ];
    const rawMessage = messageParts.join('\n');

    // 4. Encode to URL-safe Base64 (Google's strict requirement)
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 5. Fire it off via the Gmail API
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    res.status(200).json({ success: true, messageId: response.data.id });
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    res.status(500).json({ error: 'Failed to send email via Gmail API' });
  }
});
// --- NEW ROUTE: ASSIGN EMAIL TO FOLDER ---
router.post('/assign', async (req, res) => {
  const { userId, emailId, folderId } = req.body;

  try {
    const user = await User.findById(userId);
    const folder = await Folder.findById(folderId);
    const email = await Email.findById(emailId);

    if (!user || !folder || !email) return res.status(404).json({ error: 'Data not found' });

    // 1. Sync the label to Gmail's native servers if the label exists
    if (folder.gmailLabelId && user.tokens) {
      try {
        const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
        oauth2Client.setCredentials(user.tokens);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        await gmail.users.messages.modify({
          userId: 'me',
          id: email.gmailId,
          requestBody: { addLabelIds: [folder.gmailLabelId] }
        });
      } catch (gmailErr) {
        console.warn('⚠️ Could not sync label to Gmail:', gmailErr.message);
      }
    }

    // 2. Update the local MongoDB array safely (prevents duplicate tags)
    await Email.findByIdAndUpdate(emailId, { $addToSet: { folders: folderId } });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Folder Assignment Error:', error);
    res.status(500).json({ error: 'Failed to assign folder' });
  }
});
module.exports = router;