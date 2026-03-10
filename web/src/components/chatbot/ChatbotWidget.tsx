import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ChatbotButton from './ChatbotButton';
import ChatWindow from './ChatWindow';
import type { ChatMsg } from './ChatWindow';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const QUICK_COMMANDS: Record<string, string[]> = {
  admin: ['Show Assets', 'Show Maintenance Requests', 'Carbon Footprint'],
  lab_technician: ['Show Lab Assets', 'Report Issue', 'Digital Twin Status'],
  service_staff: ['Show My Tasks', 'Complete Task', 'Repair History'],
};

function backendRole(role: string | null): string {
  if (role === 'lab' || role === 'lab_technician') return 'lab_technician';
  if (role === 'service' || role === 'service_staff') return 'service_staff';
  return 'admin';
}

const WELCOME: ChatMsg = {
  id: 0,
  text: "Hi! I'm your Campus Asset Assistant 🤖\nAsk me anything about assets, maintenance, or tasks.",
  sender: 'bot',
};

export default function ChatbotWidget() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [loading, setLoading] = useState(false);

  /* Focus input when window opens */
  useEffect(() => {
    if (open) {
      const el = document.querySelector<HTMLInputElement>('[placeholder*="Ask about"]');
      el?.focus();
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setMessages((prev) => [...prev, { id: Date.now(), text: trimmed, sender: 'user' }]);
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
            user_id: user?.id ?? '',
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
    },
    [role, user],
  );

  const quickCmds = QUICK_COMMANDS[backendRole(role)] ?? QUICK_COMMANDS.admin;

  return (
    <>
      {!open && <ChatbotButton onClick={() => setOpen(true)} />}
      {open && (
        <ChatWindow
          messages={messages}
          loading={loading}
          input={input}
          onInputChange={setInput}
          onSend={() => sendMessage(input)}
          onClose={() => setOpen(false)}
          quickCommands={quickCmds}
          onQuickCommand={(cmd) => sendMessage(cmd)}
        />
      )}
    </>
  );
}
