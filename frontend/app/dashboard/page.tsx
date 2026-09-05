"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useRef } from 'react';

function DashboardContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  
  // Updated to handle custom folder IDs as views
  const [activeView, setActiveView] = useState<string>('inbox');
const [emails, setEmails] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  // Chat & Compose State
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // --- NEW: Folder State ---
  const [folders, setFolders] = useState<any[]>([]);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const folderColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6']; // Blue, Red, Green, Yellow, Purple

  useEffect(() => {
    if (activeView === 'agent') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, activeView, isProcessing]);

  const fetchData = async () => {
    if (!userId) return;
    try {
      const [emailRes, folderRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/email/list/${userId}`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/folder/list/${userId}`)
      ]);
      if (emailRes.ok) setEmails(await emailRes.json());
      if (folderRes.ok) setFolders(await folderRes.json());
    } catch (error) {
      console.error("Failed to fetch data");
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/email/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setTimeout(fetchData, 6000);
    setIsSyncing(false);
  };

  useEffect(() => { fetchData(); }, [userId]);

  const handleAiSubmit = async () => {
    if (!prompt.trim()) return;
    const userMessage = prompt;
    setPrompt(''); 
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsProcessing(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskInstruction: userMessage, userId: userId }),
      });
      if (response.ok) {
        const data = await response.json();
        setChatHistory(prev => [...prev, { role: 'ai', text: data.result }]);
        fetchData(); // Refresh emails after AI processing
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', text: '❌ Failed to get a response.' }]);
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', text: '❌ Server error.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAiAssist = async (action: string) => {
    if (!composeBody.trim()) return;
    setIsWriting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: composeBody, action })
      });
      if (res.ok) {
        const data = await res.json();
        setComposeBody(data.result);
      }
    } catch (error) {
      console.error("AI assist failed");
    } finally {
      setIsWriting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) return alert("Please fill all fields.");
    setIsSending(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, to: composeTo, subject: composeSubject, body: composeBody })
      });
      if (res.ok) {
        setIsComposeOpen(false);
        setComposeTo(''); setComposeSubject(''); setComposeBody('');
        alert("✅ Email sent successfully!");
      }
    } catch (error) {
      console.error("Send failed", error);
    } finally {
      setIsSending(false);
    }
  };

  // --- NEW: Create Folder Handler ---
// --- NEW: Create Folder Handler ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/folder/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: newFolderName, color: newFolderColor })
      });
      if (res.ok) {
        const newFolder = await res.json();
        setFolders(prev => [...prev, newFolder]);
        setIsFolderModalOpen(false);
        setNewFolderName('');
      } else {
        alert("Failed to create folder");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- NEW: Assign Folder Handler ---
  const handleAssignFolder = async (emailId: string, folderId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/email/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, emailId, folderId })
      });
      if (res.ok) {
        // Instantly update the UI state so the pill turns active
        setEmails(prev => prev.map((e: any) => e._id === emailId ? { ...e, folders: [...(e.folders || []), folderId] } : e));
      }
    } catch (error) {
      console.error("Assignment failed", error);
    }
  };

  // Filter emails based on the active view
  const displayedEmails = activeView === 'inbox' 
    ? emails 
    : emails.filter((e: any) => e.folders && e.folders.includes(activeView));

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden relative">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white flex flex-col p-4 z-10 overflow-y-auto">
        <h2 className="text-xl font-bold mb-8">Mailer</h2>
        
        <button onClick={() => setIsComposeOpen(true)} className="w-full bg-white text-gray-900 font-bold py-3 rounded-lg mb-6 shadow-sm hover:bg-gray-100 transition">
          + Compose Email
        </button>

        <nav className="space-y-2 mb-8">
          <button onClick={() => { setActiveView('inbox'); setSelectedEmail(null); }} className={`w-full text-left px-4 py-2 rounded ${activeView === 'inbox' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}> Inbox Mode</button>
          <button onClick={() => setActiveView('agent')} className={`w-full text-left px-4 py-2 rounded flex justify-between items-center ${activeView === 'agent' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}> Agent Mode</button>
        </nav>

        {/* --- NEW: Folders Section --- */}
        <div className="flex justify-between items-center mb-2 px-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Folders</span>
          <button onClick={() => setIsFolderModalOpen(true)} className="text-gray-400 hover:text-white text-lg leading-none">+</button>
        </div>
        <nav className="space-y-1">
          {folders.map(folder => (
            <button 
              key={folder._id} 
              onClick={() => { setActiveView(folder._id); setSelectedEmail(null); }} 
              className={`w-full text-left px-4 py-2 rounded flex items-center gap-3 ${activeView === folder._id ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }}></div>
              <span className="truncate text-sm">{folder.name}</span>
            </button>
          ))}
          {folders.length === 0 && <p className="text-xs text-gray-500 px-2 mt-2">No folders created yet.</p>}
        </nav>
      </div>

{/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col bg-white h-screen z-0">
        <div className="h-16 border-b flex items-center justify-between px-6 bg-white shrink-0">
          <h1 className="text-lg font-semibold text-gray-800">
            {activeView === 'inbox' ? 'Your Inbox' : activeView === 'agent' ? 'Omniroute AI Workspace' : folders.find(f => f._id === activeView)?.name || 'Folder'}
          </h1>
          <button onClick={handleSync} disabled={isSyncing} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md transition disabled:opacity-50">
            {isSyncing ? 'Syncing...' : 'Sync Gmail'}
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* Inbox / Folder View */}
          {activeView !== 'agent' && (
            <div className="h-full overflow-y-auto p-6 bg-gray-50">
              {selectedEmail ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm max-w-4xl mx-auto">
                  <button onClick={() => setSelectedEmail(null)} className="mb-6 text-sm font-medium text-blue-600 hover:text-blue-800">&larr; Back to List</button>
                  
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedEmail.subject}</h2>
                  
                  {/* NEW: Folder Tags in Reading Pane */}
                  {folders.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {folders.map(f => {
                        const isAssigned = selectedEmail.folders?.includes(f._id) || emails.find((e: any) => e._id === selectedEmail._id)?.folders?.includes(f._id);
                        return (
                          <button
                            key={f._id}
                            onClick={() => handleAssignFolder(selectedEmail._id, f._id)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${isAssigned ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                          >
                            {isAssigned ? '✓ ' : '+ '}{f.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-between items-center border-b border-gray-100 pb-6 mb-6">
                    <span className="font-semibold text-gray-800">{selectedEmail.sender}</span>
                    <span className="text-sm text-gray-500">{new Date(selectedEmail.date).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedEmail.body || selectedEmail.snippet }} />
                </div>
              ) : (
                <div className="space-y-3 max-w-5xl mx-auto">
                  {displayedEmails.length === 0 ? <p className="text-gray-500 text-center mt-10">No emails here.</p> : 
                    displayedEmails.map((email: any) => (
                      <div key={email._id} onClick={() => setSelectedEmail(email)} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-gray-900">{email.sender.split('<')[0]}</span>
                          <span className="text-xs text-gray-400">{new Date(email.date).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-semibold text-gray-800 text-sm mb-1">{email.subject}</h3>
                        <p className="text-sm text-gray-500 truncate">{email.snippet}</p>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {/* AI Agent Mode */}
          {activeView === 'agent' && (
            <div className="flex-1 flex flex-col p-6 h-full max-w-4xl w-full mx-auto">
              {/* ... (Agent chat history code remains the same) ... */}
              <div className="flex-1 overflow-y-auto mb-4 pb-4 pr-2">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400"><p>No messages yet.</p></div>
                ) : (
                  chatHistory.map((msg, index) => (
                    <div key={index} className={`mb-6 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-4 rounded-xl max-w-3xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}>
                        {msg.role === 'ai' && <p className="text-xs font-bold mb-2 text-blue-600">Mailer</p>}
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                {isProcessing && <p className="text-gray-400 animate-pulse text-sm">Thinking...</p>}
                <div ref={chatEndRef} />
              </div>

              <div className="relative shrink-0">
                <textarea 
                  value={prompt} onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }}
                  className="w-full bg-white border border-gray-300 rounded-xl p-4 pr-16 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                  rows={2} placeholder="Ask the AI to search your inbox..."
                />
                <button onClick={handleAiSubmit} disabled={isProcessing || !prompt.trim()} className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- NEW: FOLDER CREATION MODAL --- */}
      {isFolderModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold">New Folder</h3>
              <button onClick={() => setIsFolderModalOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Folder Name</label>
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g. Hackathons" className="w-full border border-gray-300 rounded-lg p-2 outline-none text-gray-800 focus:border-blue-500" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">Accent Color</label>
                <div className="flex gap-3">
                  {folderColors.map(color => (
                    <button key={color} onClick={() => setNewFolderColor(color)} className={`w-8 h-8 rounded-full border-2 ${newFolderColor === color ? 'border-gray-900 shadow-md' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button onClick={() => setIsFolderModalOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm">Cancel</button>
              <button onClick={handleCreateFolder} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm text-sm">Create Folder</button>
            </div>
          </div>
        </div>
      )}

      {/* COMPOSE MODAL OVERLAY (Unchanged) */}
      {isComposeOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
           {/* ... Compose Modal Content ... */}
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold">New Message</h3>
              <button onClick={() => setIsComposeOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <input type="email" placeholder="To" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} className="border-b border-gray-200 py-2 outline-none text-gray-800" />
              <input type="text" placeholder="Subject" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} className="border-b border-gray-200 py-2 outline-none text-gray-800 font-semibold" />
              <div className="relative">
                <textarea 
                  value={composeBody} onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email here..." 
                  className={`w-full h-64 border border-gray-200 rounded-lg p-4 outline-none resize-none text-gray-800 ${isWriting ? 'opacity-50' : 'opacity-100'}`}
                />
                {isWriting && <div className="absolute inset-0 flex items-center justify-center"><span className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow animate-pulse">✨ AI is rewriting...</span></div>}
              </div>
              <div className="flex gap-2 border-t border-gray-100 pt-4 overflow-x-auto pb-2">
                <button onClick={() => handleAiAssist('Fix grammar and spelling')} disabled={!composeBody.trim() || isWriting} className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-100 disabled:opacity-50">✨ Fix Grammar</button>
                <button onClick={() => handleAiAssist('Rewrite in a highly professional and polite tone')} disabled={!composeBody.trim() || isWriting} className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-100 disabled:opacity-50">👔 Professional</button>
                <button onClick={() => handleAiAssist('Make it sound urgent and important')} disabled={!composeBody.trim() || isWriting} className="text-sm bg-red-50 text-red-700 px-3 py-1.5 rounded-full hover:bg-red-100 disabled:opacity-50">🚀 Urgent</button>
                <button onClick={() => handleAiAssist('Shorten this email to be extremely concise')} disabled={!composeBody.trim() || isWriting} className="text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-100 disabled:opacity-50">✂️ Shorten</button>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button onClick={() => setIsComposeOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={handleSendEmail} disabled={isSending} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium shadow-sm">
                {isSending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}