require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const folderRoutes = require('./routes/folder');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/email', require('./routes/email'));
require('./workers/emailWorker'); 
app.use('/api/ai', require('./routes/ai'));
app.use('/api/folder', folderRoutes);// Starts the background listener

// Redis Queue Setup
const redisClient = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});
const emailQueue = new Queue('email-queue', { connection: redisClient });

redisClient.on('connect', () => console.log('✅ Redis Queue Connected'));
redisClient.on('error', (err) => console.error('❌ Redis Error:', err));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Health Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Agentflow_AI Backend is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});