import { useState, useCallback } from "react";

export interface ChatMessage {
  id: number;
  senderId: number;
  recipientId: number;
  content: string;
  createdAt: Date;
  senderUsername?: string;
}

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const onMessageReceived = useCallback((msgHandler: any) => {
    msgHandler((msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });
  }, []);

  return {
    messages,
    onMessageReceived,
  };
}
