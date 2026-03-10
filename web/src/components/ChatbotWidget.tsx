import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const QUICK_COMMANDS: Record<string, string[]> = {
  admin: ['Show Assets', 'Show Damaged Assets', 'Show Maintenance Requests', 'Carbon Footprint', 'Device Monitoring'],
  lab_technician: ['Show Lab Assets', 'Show Pending Issues', 'Report Issue', 'Device Monitoring'],
  service_staff: ['Show My Tasks', 'Start Task', 'Complete Task'],
};

/* Map frontend role names to backend role names */
function backendRole(role: string | null): string {
  if (role === 'lab' || role === 'lab_technician') return 'lab_technician';
  if (role === 'service' || role === 'service_staff') return 'service_staff';
  return 'admin';
}

export default function ChatbotWidget() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, text: "Hi! I'm your Campus Asset Assistant 🤖\nAsk me anything about assets, maintenance, or tasks.", sender: 'bot' },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { id: Date.now(), text: trimmed, sender: 'user' };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${BASE_URL}/chatbot/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          user_role: backendRole(role),
          user_id: (user as Record<string, unknown>)?.id ?? '',
        }),
      });
      const data = await res.json();
      const botText = data.response ?? 'Sorry, I could not process that request.';
      setMessages((prev) => [...prev, { id: Date.now() + 1, text: botText, sender: 'bot' }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: 'Unable to reach the server. Please try again later.', sender: 'bot' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const quickCmds = QUICK_COMMANDS[backendRole(role)] ?? QUICK_COMMANDS.admin;

  return (
    <>
      {/* Floating toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors"
          aria-label="Open chat assistant"
        >
          <MessageCircle size={26} />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
          style={{ height: '32rem' }}>

          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Zap size={18} />
              <span className="font-semibold text-sm">CampusLedger Assistant 🤖</span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-indigo-700 transition-colors" aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          {/* Quick commands */}
          <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
            {quickCmds.map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendMessage(cmd)}
                disabled={loading}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900 disabled:opacity-50"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400 animate-pulse">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
