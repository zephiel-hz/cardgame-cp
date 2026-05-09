import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api, WS_EVENTS, type WsMessage } from "@shared/routes";
import type { Message } from "@shared/schema";

// Custom events for WebSocket messages
const WS_MESSAGE_EVENT = 'ws-message-received';
const WS_REACTION_ADDED_EVENT = 'ws-reaction-added';
const WS_REACTION_REMOVED_EVENT = 'ws-reaction-removed';
const WS_MESSAGE_READ_EVENT = 'ws-message-read';
const WS_TRADE_COMPLETED_EVENT = 'ws-trade-completed';
const WS_TRADE_CANCELLED_EVENT = 'ws-trade-cancelled';
const WS_PARTNERSHIP_REQUEST_EVENT = 'ws-partnership-request-received';
const WS_PARTNERSHIP_REQUEST_ACCEPTED_EVENT = 'ws-partnership-request-accepted';
const WS_PARTNERSHIP_REQUEST_REJECTED_EVENT = 'ws-partnership-request-rejected';
const WS_PARTNERSHIP_REMOVAL_EVENT = 'ws-partnership-removal-request-received';
const WS_PARTNERSHIP_REMOVAL_RESPONDED_EVENT = 'ws-partnership-removal-request-responded';

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
          } else if (data.type === WS_EVENTS.REACTION_ADDED) {
            console.log('[WebSocket] REACTION_ADDED received:', data.payload);
            const event = new CustomEvent(WS_REACTION_ADDED_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
          } else if (data.type === WS_EVENTS.REACTION_REMOVED) {
            console.log('[WebSocket] REACTION_REMOVED received:', data.payload);
            const event = new CustomEvent(WS_REACTION_REMOVED_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
          } else if (data.type === WS_EVENTS.MESSAGE_READ) {
            console.log('[WebSocket] MESSAGE_READ received:', data.payload);
            const event = new CustomEvent(WS_MESSAGE_READ_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
          } else if (data.type === WS_EVENTS.TRADE_COMPLETED) {
            console.log('[WebSocket] TRADE_COMPLETED received:', data.payload);
            const event = new CustomEvent(WS_TRADE_COMPLETED_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
            
            // Invalidate all relevant queries to refresh UI
            queryClient.invalidateQueries({ queryKey: ['trades', 'history'] });
            queryClient.invalidateQueries({ queryKey: ['/api/inventory/:userId'], exact: false }); // Invalidate all inventory queries
            queryClient.invalidateQueries({ queryKey: ['trades', 'pending'], exact: false }); // Invalidate pending trades
          } else if (data.type === WS_EVENTS.TRADE_CANCELLED || data.type === WS_EVENTS.TRADE_REJECTED) {
            console.log('[WebSocket] TRADE_CANCELLED/REJECTED received:', data.payload);
            const event = new CustomEvent(WS_TRADE_CANCELLED_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
            
            // Invalidate all relevant queries to refresh UI
            queryClient.invalidateQueries({ queryKey: ['trades', 'history'] });
            queryClient.invalidateQueries({ queryKey: ['trades', 'pending'], exact: false }); // Refresh pending trades list
          } else if (data.type === WS_EVENTS.PARTNERSHIP_REQUEST_RECEIVED) {
            console.log('[WebSocket] PARTNERSHIP_REQUEST_RECEIVED:', data.payload);
            const event = new CustomEvent(WS_PARTNERSHIP_REQUEST_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
          } else if (data.type === WS_EVENTS.PARTNERSHIP_REMOVAL_REQUEST_RECEIVED) {
            console.log('[WebSocket] PARTNERSHIP_REMOVAL_REQUEST_RECEIVED:', data.payload);
            const event = new CustomEvent(WS_PARTNERSHIP_REMOVAL_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
          } else if (data.type === WS_EVENTS.PARTNERSHIP_REMOVAL_REQUEST_RESPONDED) {
            console.log('[WebSocket] PARTNERSHIP_REMOVAL_REQUEST_RESPONDED:', data.payload);
            const event = new CustomEvent(WS_PARTNERSHIP_REMOVAL_RESPONDED_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
          } else if (data.type === WS_EVENTS.PARTNERSHIP_REQUEST_ACCEPTED) {
            console.log('[WebSocket] PARTNERSHIP_REQUEST_ACCEPTED:', data.payload);
            const event = new CustomEvent(WS_PARTNERSHIP_REQUEST_ACCEPTED_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
          } else if (data.type === WS_EVENTS.PARTNERSHIP_REQUEST_REJECTED) {
            console.log('[WebSocket] PARTNERSHIP_REQUEST_REJECTED:', data.payload);
            const event = new CustomEvent(WS_PARTNERSHIP_REQUEST_REJECTED_EVENT, {
              detail: data.payload,
            });
            window.dispatchEvent(event);
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

// Hook untuk subscribe ke reaction events
export function useWebSocketReactions(
  onReactionAdded?: (payload: { messageId: number; userId: number; emoji: string }) => void,
  onReactionRemoved?: (payload: { messageId: number; userId: number }) => void
) {
  useEffect(() => {
    const handleReactionAdded = (event: Event) => {
      if (event instanceof CustomEvent && onReactionAdded) {
        console.log('[useWebSocketReactions] REACTION_ADDED:', event.detail);
        onReactionAdded(event.detail);
      }
    };

    const handleReactionRemoved = (event: Event) => {
      if (event instanceof CustomEvent && onReactionRemoved) {
        console.log('[useWebSocketReactions] REACTION_REMOVED:', event.detail);
        onReactionRemoved(event.detail);
      }
    };

    window.addEventListener(WS_REACTION_ADDED_EVENT, handleReactionAdded);
    window.addEventListener(WS_REACTION_REMOVED_EVENT, handleReactionRemoved);
    
    return () => {
      window.removeEventListener(WS_REACTION_ADDED_EVENT, handleReactionAdded);
      window.removeEventListener(WS_REACTION_REMOVED_EVENT, handleReactionRemoved);
    };
  }, [onReactionAdded, onReactionRemoved]);
}

// Hook untuk subscribe ke message read events
export function useWebSocketMessageRead(
  onMessageRead?: (payload: { messageId: number; readBy: number; readAt: string }) => void
) {
  useEffect(() => {
    const handleMessageRead = (event: Event) => {
      if (event instanceof CustomEvent && onMessageRead) {
        console.log('[useWebSocketMessageRead] MESSAGE_READ:', event.detail);
        onMessageRead(event.detail);
      }
    };

    window.addEventListener(WS_MESSAGE_READ_EVENT, handleMessageRead);
    
    return () => {
      window.removeEventListener(WS_MESSAGE_READ_EVENT, handleMessageRead);
    };
  }, [onMessageRead]);
}

// Hook untuk subscribe ke trade events
export function useWebSocketTrades(
  onTradeCompleted?: (payload: any) => void,
  onTradeCancelled?: (payload: any) => void
) {
  useEffect(() => {
    const handleTradeCompleted = (event: Event) => {
      if (event instanceof CustomEvent && onTradeCompleted) {
        console.log('[useWebSocketTrades] TRADE_COMPLETED:', event.detail);
        onTradeCompleted(event.detail);
      }
    };

    const handleTradeCancelled = (event: Event) => {
      if (event instanceof CustomEvent && onTradeCancelled) {
        console.log('[useWebSocketTrades] TRADE_CANCELLED:', event.detail);
        onTradeCancelled(event.detail);
      }
    };

    window.addEventListener(WS_TRADE_COMPLETED_EVENT, handleTradeCompleted);
    window.addEventListener(WS_TRADE_CANCELLED_EVENT, handleTradeCancelled);
    
    return () => {
      window.removeEventListener(WS_TRADE_COMPLETED_EVENT, handleTradeCompleted);
      window.removeEventListener(WS_TRADE_CANCELLED_EVENT, handleTradeCancelled);
    };
  }, [onTradeCompleted, onTradeCancelled]);
}

// Hook untuk subscribe ke partnership events
export function useWebSocketPartnership(
  onPartnershipRequest?: (payload: any) => void,
  onPartnershipRemovalRequest?: (payload: any) => void,
  onPartnershipRemovalResponded?: (payload: any) => void
) {
  useEffect(() => {
    const handlePartnershipRequest = (event: Event) => {
      if (event instanceof CustomEvent && onPartnershipRequest) {
        console.log('[useWebSocketPartnership] PARTNERSHIP_REQUEST:', event.detail);
        onPartnershipRequest(event.detail);
      }
    };

    const handleRemovalRequest = (event: Event) => {
      if (event instanceof CustomEvent && onPartnershipRemovalRequest) {
        console.log('[useWebSocketPartnership] PARTNERSHIP_REMOVAL_REQUEST:', event.detail);
        onPartnershipRemovalRequest(event.detail);
      }
    };

    const handleRemovalResponded = (event: Event) => {
      if (event instanceof CustomEvent && onPartnershipRemovalResponded) {
        console.log('[useWebSocketPartnership] PARTNERSHIP_REMOVAL_RESPONDED:', event.detail);
        onPartnershipRemovalResponded(event.detail);
      }
    };

    window.addEventListener(WS_PARTNERSHIP_REQUEST_EVENT, handlePartnershipRequest);
    window.addEventListener(WS_PARTNERSHIP_REMOVAL_EVENT, handleRemovalRequest);
    window.addEventListener(WS_PARTNERSHIP_REMOVAL_RESPONDED_EVENT, handleRemovalResponded);
    
    return () => {
      window.removeEventListener(WS_PARTNERSHIP_REQUEST_EVENT, handlePartnershipRequest);
      window.removeEventListener(WS_PARTNERSHIP_REMOVAL_EVENT, handleRemovalRequest);
      window.removeEventListener(WS_PARTNERSHIP_REMOVAL_RESPONDED_EVENT, handleRemovalResponded);
    };
  }, [onPartnershipRequest, onPartnershipRemovalRequest, onPartnershipRemovalResponded]);
}

// Hook untuk subscribe ke partnership request response events (accepted/rejected)
export function useWebSocketPartnershipResponses(
  onPartnershipAccepted?: (payload: any) => void,
  onPartnershipRejected?: (payload: any) => void
) {
  useEffect(() => {
    const handlePartnershipAccepted = (event: Event) => {
      if (event instanceof CustomEvent && onPartnershipAccepted) {
        console.log('[useWebSocketPartnershipResponses] PARTNERSHIP_REQUEST_ACCEPTED:', event.detail);
        onPartnershipAccepted(event.detail);
      }
    };

    const handlePartnershipRejected = (event: Event) => {
      if (event instanceof CustomEvent && onPartnershipRejected) {
        console.log('[useWebSocketPartnershipResponses] PARTNERSHIP_REQUEST_REJECTED:', event.detail);
        onPartnershipRejected(event.detail);
      }
    };

    window.addEventListener(WS_PARTNERSHIP_REQUEST_ACCEPTED_EVENT, handlePartnershipAccepted);
    window.addEventListener(WS_PARTNERSHIP_REQUEST_REJECTED_EVENT, handlePartnershipRejected);
    
    return () => {
      window.removeEventListener(WS_PARTNERSHIP_REQUEST_ACCEPTED_EVENT, handlePartnershipAccepted);
      window.removeEventListener(WS_PARTNERSHIP_REQUEST_REJECTED_EVENT, handlePartnershipRejected);
    };
  }, [onPartnershipAccepted, onPartnershipRejected]);
}
