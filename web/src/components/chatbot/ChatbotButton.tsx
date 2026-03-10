import React from 'react';
import { MessageCircle } from 'lucide-react';

interface Props {
  onClick: () => void;
}

export default function ChatbotButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="chatbot-btn"
      aria-label="Open Campus Assistant"
    >
      <MessageCircle size={24} />
    </button>
  );
}
