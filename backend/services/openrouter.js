const { Groq } = require('groq-sdk');
const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');
const Email = require('../models/Email');
const Folder = require('../models/Folder');

// Initialize providers safely
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const openRouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function getLiveFreeModels() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    const data = await response.json();
    const freeModels = data.data
      .filter(m => m.pricing && m.pricing.prompt === "0" && m.pricing.completion === "0")
      .map(m => m.id);
    return freeModels.length > 0 ? freeModels : ['meta-llama/llama-3.1-8b-instruct:free'];
  } catch (error) {
    return ['meta-llama/llama-3.1-8b-instruct:free'];
  }
}

async function searchDatabase(query, userId) {
  const cleanQuery = query.replace(/["']/g, "").trim();
  console.log(`🔍 Orchestrator DB Search: "${cleanQuery}"`);
  
  const regex = new RegExp(cleanQuery, 'i'); // 'i' makes it case-insensitive
  
  const results = await Email.find({
    userId: userId,
    $or: [
      { subject: regex }, 
      { snippet: regex }, 
      { sender: regex },
      { body: regex } // <--- Now it searches the full email content!
    ]
  }).limit(5);

  if (results.length === 0) return "No matching emails found in database.";
  
  return results.map(e => `From: ${e.sender}\nDate: ${e.date}\nSubject: ${e.subject}\nSnippet: ${e.snippet}\nBody: ${e.body.substring(0, 500)}...`).join('\n\n---\n\n');
}

// 1. GROQ INFERENCE (Switched to highly stable legacy ID)
async function callGroq(messages) {
  const completion = await groqClient.chat.completions.create({
    model: 'openai/gpt-oss-20b', 
    messages: messages,
    temperature: 0.3,
  });
  return completion.choices[0].message.content;
}

// 2. GEMINI INFERENCE 
async function callGemini(systemPrompt, userPrompt) {
  const response = await geminiClient.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
    },
  });
  // FIXED: No parentheses. It is a getter property in the new SDK.
  return response.text; 
}

// 3. OPENROUTER INFERENCE 
async function callOpenRouter(messages) {
  const freeModels = await getLiveFreeModels();
  const primaryModel = freeModels[0];
  const fallbackArray = freeModels.slice(1, 5);
  
  const completion = await openRouterClient.chat.completions.create({
    model: primaryModel,
    extra_body: {
      models: fallbackArray
    },
    messages: messages,
  });
  return completion.choices[0].message.content;
}

// UNIFIED INTELLIGENT ROUTING & FAILOVER LAYER 
async function processAIRequest(taskInstruction, userId) {
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  // CAREFULLY UPDATED: Added the CATEGORIZE rule without altering the others
  const systemPrompt = `You are Mailer, an autonomous email management agent. Today's date is ${currentDate}. 
You have access to the user's local database of synced emails.

CRITICAL RULES:
1. If the user asks to find, check, read, or summarize an email (e.g., "is there an email from NxtWave", "what did they say today"), you MUST trigger a search by outputting ONLY this line:
SEARCH: [keyword]
2. To sort, group, or move emails into a folder, output ONLY this line:
CATEGORIZE: [keyword] >>> [folder name]
3. NEVER draft or invent fake emails unless the user explicitly commands you to "write", "draft", or "compose" a new email.

Example: "Sort my Hackathon emails into the Tech folder" -> CATEGORIZE: Hackathon >>> Tech
If it is a general greeting, reply conversationally.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: taskInstruction }
  ];

  let rawResponse = '';

  // Phase 1: Determine intent (Search vs Chat)
  try {
    console.log(`⚡ Phase 1: Routing to Groq...`);
    rawResponse = await callGroq(messages);
  } catch (groqError) {
    console.error('❌ Phase 1 Groq Error:', groqError.message || groqError);
    try {
      console.log(`⚡ Phase 1: Failing over to Gemini...`);
      rawResponse = await callGemini(systemPrompt, taskInstruction);
    } catch (geminiError) {
      console.error('❌ Phase 1 Gemini Error:', geminiError.message || geminiError);
      try {
        console.log(`⚡ Phase 1: Failing over to OpenRouter...`);
        rawResponse = await callOpenRouter(messages);
      } catch (openRouterError) {
        console.error('❌ Phase 1 OpenRouter Error:', openRouterError.message || openRouterError);
        throw new Error('All AI providers failed. Check API keys.');
      }
    }
  }

  // --- NEW: Phase 2a: Intercept CATEGORIZE Command ---
  // --- Phase 2a: Intercept CATEGORIZE Command (With Auto-Creation) ---
  if (rawResponse && rawResponse.includes('CATEGORIZE:')) {
    const match = rawResponse.match(/CATEGORIZE:\s*(.+)\s*>>>\s*(.+)/);
    if (match) {
      const keyword = match[1].trim().replace(/["']/g, "");
      const folderName = match[2].trim();
      
      // 1. Check if folder exists; if not, CREATE IT AUTOMATICALLY
      let folder = await Folder.findOne({ userId, name: new RegExp('^' + folderName + '$', 'i') });
      if (!folder) {
        console.log(`📂 Folder "${folderName}" not found. Auto-creating it now...`);
        folder = new Folder({ 
          userId, 
          name: folderName, 
          color: '#3B82F6' // Default blue accent
        });
        await folder.save();
      }

      // 2. Find matching emails
      const regex = new RegExp(keyword, 'i');
      const emails = await Email.find({ userId, $or: [{ subject: regex }, { snippet: regex }, { sender: regex }, { body: regex }] });

      if (emails.length === 0) return `I auto-created the "${folder.name}" folder, but no emails were found matching "${keyword}".`;

      // 3. Bulk update all matching emails in MongoDB
      await Email.updateMany(
        { _id: { $in: emails.map(e => e._id) } },
        { $addToSet: { folders: folder._id } }
      );

      return `✅ Created the "${folder.name}" folder and successfully moved ${emails.length} emails regarding "${keyword}" into it!`;
    }
  }

  // Phase 2b: Search and Synthesis (If triggered)
  if (rawResponse && rawResponse.includes('SEARCH:')) {
    const match = rawResponse.match(/SEARCH:\s*(.+)/);
    if (match && match[1]) {
      const searchQuery = match[1].trim();
      const dbResults = await searchDatabase(searchQuery, userId);

      const followupMessages = [
        ...messages,
        { role: 'assistant', content: rawResponse },
        { role: 'user', content: `Here are matching database search results:\n\n${dbResults}\n\nProvide a final clear response to the user.` }
      ];

      try {
        console.log(`⚡ Phase 2 (Synthesis): Routing to Groq...`);
        return await callGroq(followupMessages);
      } catch (followupGroqErr) {
        console.error('❌ Phase 2 Groq Error:', followupGroqErr.message || followupGroqErr);
        try {
          console.log(`⚡ Phase 2 (Synthesis): Failing over to Gemini...`);
          return await callGemini(systemPrompt, `User Request: ${taskInstruction}\n\nData:\n${dbResults}`);
        } catch (followupGeminiErr) {
          console.error('❌ Phase 2 Gemini Error:', followupGeminiErr.message || followupGeminiErr);
          console.log(`⚡ Phase 2 (Synthesis): Failing over to OpenRouter...`);
          return await callOpenRouter(followupMessages);
        }
      }
    }
  }

  return rawResponse;
}

// --- NEW: DEDICATED WRITING ASSISTANT ---
async function processDraftAssist(draft, action) {
  const systemPrompt = `You are an expert email copywriter. Rewrite the user's draft based on the requested action.
CRITICAL RULES:
- Output ONLY the revised email text.
- Do not include conversational filler like "Here is the rewritten email:" or quotes.
- Keep the formatting clean.`;

  const userPrompt = `Action requested: ${action}\n\nOriginal Draft:\n${draft}`;

  try {
    // We strictly use Groq here because we need instant, sub-second UI feedback
    const completion = await groqClient.chat.completions.create({
      model: 'openai/gpt-oss-20b', 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5, // Slightly higher for creativity in writing
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Draft Assist Error:', error.message || error);
    throw new Error('Failed to rewrite draft');
  }
}
module.exports = { processAIRequest, processDraftAssist };