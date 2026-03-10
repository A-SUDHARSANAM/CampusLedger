import React from 'react';
import { Send } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled }: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="chatbot-input-area">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about assets, maintenance..."
        disabled={disabled}
        className="chatbot-input"
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="chatbot-send-btn"
        aria-label="Send message"
      >
        <Send size={15} />
      </button>
    </div>
  );
}
