const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { google } = require('googleapis');
const User = require('../models/User');
const Email = require('../models/Email');

const redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

// Helper function to decode Google's Base64Url format
function decodeGmailBody(data) {
  if (!data) return '';
  const buff = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return buff.toString('utf-8');
}

// Helper to find the text content in the payload tree
function extractText(payload) {
  if (!payload) return '';
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain') return decodeGmailBody(part.body.data);
      if (part.mimeType === 'text/html') return decodeGmailBody(part.body.data);
      if (part.parts) return extractText(part); // Recursively check nested parts
    }
  }
  return decodeGmailBody(payload.body?.data);
}

const emailWorker = new Worker('email-queue', async (job) => {
  console.log(`⏳ Fetching batch of 50 emails...`);
  
  const user = await User.findById(job.data.userId);
  if (!user) throw new Error('User not found');

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials(user.tokens);
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Increased from 3 to 50 emails
  const response = await gmail.users.messages.list({ userId: 'me', maxResults: 50 });
  const messages = response.data.messages || [];

  let savedCount = 0;

  for (const msg of messages) {
    // Fetching format: 'full' to get the body payload instead of just metadata
    const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    
    const headers = msgData.data.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const sender = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
    const date = headers.find(h => h.name === 'Date')?.value;
    
    const fullBody = extractText(msgData.data.payload);

    await Email.findOneAndUpdate(
      { gmailId: msg.id },
      {
        userId: user._id,
        gmailId: msg.id,
        subject: subject,
        sender: sender,
        snippet: msgData.data.snippet,
        body: fullBody,
        date: date ? new Date(date) : new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );
    savedCount++;
  }

  return savedCount;
}, { connection: redisClient });

emailWorker.on('completed', (job, returnvalue) => console.log(`🎉 Job completed! Saved ${returnvalue} emails.`));
emailWorker.on('failed', (job, err) => console.error(`❌ Job failed:`, err));

module.exports = emailWorker;