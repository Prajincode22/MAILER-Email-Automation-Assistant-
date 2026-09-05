const express = require('express');
const router = express.Router();
const { processAIRequest, processDraftAssist } = require('../services/openrouter');

// --- RESTORED ROUTE: MAIN AGENT & SEARCH PROCESSOR ---
router.post('/process', async (req, res) => {
  const { taskInstruction, userId } = req.body;

  console.log(`🤖 AI Request Received - User: ${userId}, Task: ${taskInstruction}`);

  if (!taskInstruction || !userId) {
    console.warn("⚠️ AI Request Rejected: Missing instruction or userId");
    return res.status(400).json({ error: 'Missing taskInstruction or userId.' });
  }

  try {
    const aiResult = await processAIRequest(taskInstruction, userId);
    res.status(200).json({ result: aiResult });
  } catch (error) {
    console.error('❌ AI Process Route Error:', error.message || error);
    res.status(500).json({ error: 'Failed to process AI request.' });
  }
});

// --- ROUTE: AI WRITING ASSISTANT ---
router.post('/assist', async (req, res) => {
  const { draft, action } = req.body;

  if (!draft || !action) {
    return res.status(400).json({ error: 'Missing draft or action command.' });
  }

  try {
    const revisedText = await processDraftAssist(draft, action);
    res.status(200).json({ result: revisedText });
  } catch (error) {
    console.error('❌ AI Assist Route Error:', error.message || error);
    res.status(500).json({ error: 'Failed to process draft with AI.' });
  }
});

module.exports = router;