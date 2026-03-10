import React from 'react';
import { Bot, User } from 'lucide-react';

interface Props {
  text: string;
  sender: 'user' | 'bot';
}

export default function ChatMessage({ text, sender }: Props) {
  return (
    <div className={`chatbot-msg ${sender}`}>
      <div className={`chatbot-msg-avatar ${sender}`}>
        {sender === 'user' ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={`chatbot-msg-bubble ${sender}`}>{text}</div>
    </div>
  );
}
