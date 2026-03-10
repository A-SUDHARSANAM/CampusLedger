import React, { useEffect, useRef } from 'react';
import { Bot, X } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

export interface ChatMsg {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}

interface Props {
  messages: ChatMsg[];
  loading: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
  quickCommands: string[];
  onQuickCommand: (cmd: string) => void;
}

export default function ChatWindow({
  messages,
  loading,
  input,
  onInputChange,
  onSend,
  onClose,
  quickCommands,
  onQuickCommand,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="chatbot-window">
      {/* Header */}
      <div className="chatbot-header">
        <div className="chatbot-header-info">
          <div className="chatbot-header-avatar">
            <Bot size={16} />
          </div>
          <div>
            <p className="chatbot-header-title">CampusLedger Assistant</p>
            <p className="chatbot-header-sub">Always online · Ask anything</p>
          </div>
        </div>
        <button onClick={onClose} className="chatbot-close-btn" aria-label="Close chat">
          <X size={18} />
        </button>
      </div>

      {/* Quick commands */}
      <div className="chatbot-quick-cmds">
        {quickCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => onQuickCommand(cmd)}
            disabled={loading}
            className="chatbot-quick-cmd"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chatbot-messages">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} text={msg.text} sender={msg.sender} />
        ))}

        {loading && (
          <div className="chatbot-typing">
            <div className="chatbot-msg-avatar bot">
              <Bot size={13} />
            </div>
            <div className="chatbot-typing-dots">
              <span className="chatbot-typing-dot" />
              <span className="chatbot-typing-dot" />
              <span className="chatbot-typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput value={input} onChange={onInputChange} onSend={onSend} disabled={loading} />
    </div>
  );
}
