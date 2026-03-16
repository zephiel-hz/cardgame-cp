import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api, WS_EVENTS, type WsMessage } from "@shared/routes";
import type { Message } from "@shared/schema";

// Custom event untuk WebSocket messages
const WS_MESSAGE_EVENT = 'ws-message-received';

export function useAppWebSocket(userId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const connect = () => {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log("[WebSocket] Connected. Identifying user:", userId);
        // Send user identification
        wsRef.current?.send(JSON.stringify({ 
          type: 'IDENTIFY_USER', 
          userId 
        }));
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsMessage<any>;
          console.log('[WebSocket] Message received from server:', data.type, data.payload);
          
          if (data.type === WS_EVENTS.CARD_USED) {
            const { cardName, userName } = data.payload;
            
            toast({
              title: "🌟 Kartu Digunakan!",
              description: `${userName} baru saja menggunakan kartu: ${cardName}`,
              className: "bg-primary text-primary-foreground border-none rounded-2xl shadow-xl",
            });
            
            // Invalidate ALL active cards queries to ensure everyone sees the update
            queryClient.invalidateQueries({ queryKey: [api.activeCards.list.path] });
          } else if (data.type === WS_EVENTS.MESSAGE_RECEIVED) {
            // Emit custom event untuk chat
            const messageData: Message & { senderUsername?: string } = {
              id: data.payload.id,
              senderId: data.payload.senderId,
              recipientId: data.payload.recipientId,
              content: data.payload.content,
              isRead: false,
              createdAt: new Date(data.payload.createdAt),
              readAt: null,
              senderUsername: data.payload.senderUsername,
            };

            console.log('[WebSocket] About to dispatch MESSAGE_RECEIVED event:', messageData);

            // Dispatch custom event
            const event = new CustomEvent(WS_MESSAGE_EVENT, {
              detail: messageData,
            });
            window.dispatchEvent(event);

            console.log('[WebSocket] MESSAGE_RECEIVED event dispatched successfully');
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      wsRef.current.onclose = () => {
        console.log("[WebSocket] Disconnected. wsRef.current is:", wsRef.current !== null);
        // Only reconnect if socket wasn't intentionally cleared
        if (wsRef.current) {
          console.log("[WebSocket] Scheduling reconnection in 3s...");
          setTimeout(connect, 3000);
        } else {
          console.log("[WebSocket] Socket was intentionally closed, not reconnecting");
        }
      };

      wsRef.current.onerror = (err) => {
        console.error("[WebSocket] Error:", err);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        socket.close();
      }
    };
  }, [queryClient, toast, userId]);

  return wsRef.current;
}

// Hook untuk subscribe ke WebSocket messages
export function useWebSocketMessages(callback: (message: Message & { senderUsername?: string }) => void) {
  useEffect(() => {
    console.log('[useWebSocketMessages] Setting up listener');
    
    const handleMessage = (event: Event) => {
      console.log('[useWebSocketMessages] Event received:', event.type);
      
      if (event instanceof CustomEvent) {
        console.log('[useWebSocketMessages] CustomEvent detail:', event.detail);
        callback(event.detail);
      } else {
        console.warn('[useWebSocketMessages] Event is not a CustomEvent:', event);
      }
    };

    window.addEventListener(WS_MESSAGE_EVENT, handleMessage);
    console.log(`[useWebSocketMessages] Listener attached to ${WS_MESSAGE_EVENT}`);
    
    return () => {
      console.log(`[useWebSocketMessages] Removing listener from ${WS_MESSAGE_EVENT}`);
      window.removeEventListener(WS_MESSAGE_EVENT, handleMessage);
    };
  }, [callback]);
}
