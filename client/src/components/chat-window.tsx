import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useE2EE } from "@/hooks/use-e2ee";
import { useWebSocketMessages, useWebSocketReactions, useWebSocketMessageRead } from "@/hooks/use-websocket";
import { encryptMessage, decryptMessage, getStoredKeyPair } from "@shared/crypto-utils";
import { Smile, ArrowLeft, MoreVertical, ChevronLeft, ChevronRight, Copy, Trash2, CornerUpLeft } from "lucide-react";
import { EMOJI_CATEGORIES } from "@/data/emoji-categories";
import type { Message, User } from "@shared/schema";

interface ChatWindowProps {
  userId: number;
  partnerId: number;
  partnerName: string;
  partnerData?: User | null;
  onBack?: () => void;
}

// Quick emoji reactions like Instagram
const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

// Format date for message grouping
function formatMessageDate(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Hari ini";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Kemarin";
  }
  
  return date.toLocaleDateString("id-ID", { 
    month: "long", 
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined
  });
}

// Truncate text for reply preview - aggressive truncation to prevent layout breaking
function truncateReplyText(text: string, maxLength: number = 25): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Decrypt message content - symmetric decryption with shared secret
function decryptMessageContentSafely(
  content: string,
  messageFromUserId: number,
  currentUserId: number,
  partnerPublicKey: string | null,
  e2eeSetup: boolean,
  messageId?: number
): string | null {
  // For partner messages, decrypt using shared secret
  if (messageFromUserId !== currentUserId) {
    console.log(`[E2EE DISPLAY] Partner msg from user ${messageFromUserId}:`, {
      e2eeSetup,
      hasPartnerKey: !!partnerPublicKey,
      keyLength: partnerPublicKey?.length,
      messageId,
    });

    if (!e2eeSetup || !partnerPublicKey) {
      console.warn('[E2EE DISPLAY] ❌ HIDING - missing setup or key');
      return null;
    }

    try {
      const userKeyPair = getStoredKeyPair(currentUserId);
      if (!userKeyPair) {
        console.warn('[E2EE DISPLAY] ❌ HIDING - No user keypair found');
        return null;
      }

      // Decrypt using shared secret (user's own pub/sec + partner's pub)
      const plaintext = decryptMessage(
        content,
        userKeyPair.publicKey,  // Current user's public key
        partnerPublicKey,        // Partner's public key
        userKeyPair.secretKey    // Current user's secret key
      );
      console.log('[E2EE DISPLAY] ✓ Decrypted successfully, msg id:', messageId);
      return plaintext;
    } catch (err) {
      console.warn("[E2EE DISPLAY] ❌ HIDING - Decryption error:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  // For own messages, decrypt using shared secret too
  console.log('[E2EE DISPLAY] Own message (encrypted), msg id:', messageId);
  
  if (!e2eeSetup || !partnerPublicKey) {
    console.warn('[E2EE DISPLAY] ❌ HIDING own message - missing setup or key');
    return null;
  }

  try {
    const userKeyPair = getStoredKeyPair(currentUserId);
    if (!userKeyPair) {
      console.warn('[E2EE DISPLAY] ❌ HIDING - No user keypair found');
      return null;
    }

    // Decrypt using same shared secret (symmetric, so same key works)
    const plaintext = decryptMessage(
      content,
      userKeyPair.publicKey,   // User's own public key
      partnerPublicKey,         // Partner's public key
      userKeyPair.secretKey     // User's secret key
    );
    console.log('[E2EE DISPLAY] ✓ Own message decrypted, msg id:', messageId);
    return plaintext;
  } catch (err) {
    console.warn("[E2EE DISPLAY] ❌ HIDING - Own message decrypt error:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function ChatWindow({
  userId,
  partnerId,
  partnerName,
  partnerData,
  onBack,
}: ChatWindowProps) {
  const { t } = useTranslation();
  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>("smileys");
  const [longPressedMessageId, setLongPressedMessageId] = useState<number | null>(null);
  const [contextMenuId, setContextMenuId] = useState<number | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<number, Record<number, string>>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<{ isOnline: boolean; lastSeenText: string } | null>({ isOnline: false, lastSeenText: "Loading..." });
  const [isDecrypting, setIsDecrypting] = useState(true);
  const [swipingMessageId, setSwipingMessageId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDraggingMessage, setIsDraggingMessage] = useState(false);
  const [partnerPublicKey, setPartnerPublicKey] = useState<string | null>(null);
  const [menuPositionTop, setMenuPositionTop] = useState(true); // true for top, false for bottom
  const [emojiPosition, setEmojiPosition] = useState<'top' | 'bottom' | 'side'>('bottom'); // adaptive vertical position
  const [emojiHorizontalAlign, setEmojiHorizontalAlign] = useState<'left' | 'center' | 'right'>('center'); // horizontal alignment
  const [emojiOffsetX, setEmojiOffsetX] = useState(0); // horizontal offset for boundary safety
  const [contextMenuPosition, setContextMenuPosition] = useState<'top' | 'bottom' | 'side'>('bottom'); // context menu vertical position
  const [contextMenuHorizontalAlign, setContextMenuHorizontalAlign] = useState<'left' | 'center' | 'right'>('center'); // context menu horizontal alignment
  const [contextMenuOffsetX, setContextMenuOffsetX] = useState(0); // context menu horizontal offset
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiPickerMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const longPressMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const swipeStartXRef = useRef(0);
  const mouseDownXRef = useRef(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize E2EE
  const { isSetup: e2eeSetup, isLoading: e2eeLoading } = useE2EE({ userId, enabled: true });

  // Scroll emoji categories left/right
  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = 120;
      const newScroll = categoryScrollRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      categoryScrollRef.current.scrollTo({ left: newScroll, behavior: 'smooth' });
    }
  };

  // Close emoji picker and clear long press when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        if (emojiPickerMenuRef.current && !emojiPickerMenuRef.current.contains(event.target as Node)) {
          setShowEmojiPicker(false);
        }
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenuId(null);
      }
      // Close long-press menu when clicking outside
      if (longPressMenuRef.current && !longPressMenuRef.current.contains(event.target as Node)) {
        setLongPressedMessageId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Create stable query key - memoize to prevent recreation on every render
  const chatQueryKey = useMemo(() => [api.chat.getMessages.path, userId, partnerId], [userId, partnerId]);

  // Listen for incoming WebSocket messages and update cache in real-time
  useWebSocketMessages(
    useCallback((incomingMessage: Message & { senderUsername?: string }) => {
      // Only update if message is for this conversation
      if (incomingMessage.senderId === partnerId && incomingMessage.recipientId === userId) {
        console.log('[Chat] New message received from WebSocket:', incomingMessage.id);
        
        // Update cache immediately
        queryClient.setQueryData(chatQueryKey, (oldData: Message[] | undefined) => {
          // Check if message already exists to avoid duplicates
          if (oldData?.some(msg => msg.id === incomingMessage.id)) {
            console.log('[Chat] Message already exists in cache');
            return oldData;
          }
          
          const newData = oldData ? [...oldData, incomingMessage] : [incomingMessage];
          console.log('[Chat] Cache updated with new message:', { 
            messageIds: newData.map(m => m.id),
            count: newData.length 
          });
          return newData;
        });

        // ALSO invalidate the chat query to ensure fresh data is fetched
        // This ensures real-time updates even if setQueryData has issues
        queryClient.invalidateQueries({ queryKey: chatQueryKey });

        // Invalidate unread count when message arrives
        queryClient.invalidateQueries({ queryKey: ['unreadCount', userId] });
        
        // Auto-scroll is handled by useLayoutEffect on messages change
      }
    }, [partnerId, userId, queryClient, chatQueryKey])
  );

  // Listen for incoming reaction events
  useWebSocketReactions(
    useCallback((payload: { messageId: number; userId: number; emoji: string }) => {
      // Update reactions state when partner reacts
      setMessageReactions((prev) => ({
        ...prev,
        [payload.messageId]: {
          ...(prev[payload.messageId] || {}),
          [payload.userId]: payload.emoji,
        },
      }));
    }, []),
    useCallback((payload: { messageId: number; userId: number }) => {
      // Remove reaction when partner removes it
      setMessageReactions((prev) => {
        const updated = { ...prev };
        if (updated[payload.messageId]) {
          const messageReactions = { ...updated[payload.messageId] };
          delete messageReactions[payload.userId];
          if (Object.keys(messageReactions).length === 0) {
            delete updated[payload.messageId];
          } else {
            updated[payload.messageId] = messageReactions;
          }
        }
        return updated;
      });
    }, [])
  );

  // Listen for message read status updates
  useWebSocketMessageRead(
    useCallback((payload: { messageId: number; readBy: number; readAt: string }) => {
      console.log('[Chat] Message read event received:', payload);
      // Invalidate queries to refresh read status
      queryClient.invalidateQueries({ queryKey: chatQueryKey });
    }, [queryClient, chatQueryKey])
  );

  // Fetch and poll partner status
  useEffect(() => {
    let isMounted = true;

    const fetchPartnerStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const response = await fetch(buildUrl(api.chat.getUserStatus.path, { userId: partnerId }), {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok && isMounted) {
          const data = await response.json();
          setPartnerStatus({
            isOnline: data.isOnline,
            lastSeenText: data.lastSeenText,
          });
        } else if (!response.ok && isMounted) {
          console.warn("Failed to fetch partner status:", response.status);
          setPartnerStatus({ isOnline: false, lastSeenText: "Offline" });
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to fetch partner status:", err);
          setPartnerStatus({ isOnline: false, lastSeenText: "Offline" });
        }
      }
    };

    // Fetch immediately on mount with small delay to ensure component is ready
    const initialTimer = setTimeout(fetchPartnerStatus, 100);

    // Poll every 15 seconds
    const interval = setInterval(fetchPartnerStatus, 15000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [partnerId]);

  // Fetch partner's public key for E2EE
  useEffect(() => {
    let isMounted = true;

    const fetchPartnerPublicKey = async () => {
      try {
        console.log(`[E2EE KEY FETCH] Starting for partnerId: ${partnerId}, e2eeSetup: ${e2eeSetup}`);
        const response = await fetch(`/api/auth/public-key/${partnerId}`);
        
        console.log(`[E2EE KEY FETCH] Response status: ${response.status} for partnerId: ${partnerId}`);
        
        if (response.ok && isMounted) {
          const data = await response.json();
          console.log(`[E2EE KEY FETCH] ✓ Received public key for partner ${partnerId}, length: ${data.publicKey?.length || 0}`);
          setPartnerPublicKey(data.publicKey);
        } else if (!response.ok && isMounted) {
          const errorText = await response.text().catch(() => "");
          console.warn(`[E2EE KEY FETCH] ❌ Failed - Status ${response.status} for partnerId ${partnerId}. Response: ${errorText}`);
        }
      } catch (err) {
        console.error("[E2EE KEY FETCH] ❌ Exception:", err);
      }
    };

    if (e2eeSetup) {
      console.log(`[E2EE KEY FETCH] E2EE setup complete, fetching partner key for ${partnerId}`);
      fetchPartnerPublicKey();
    } else {
      console.log(`[E2EE KEY FETCH] E2EE not setup yet (e2eeSetup: ${e2eeSetup}), skipping partner key fetch`);
    }

    return () => {
      isMounted = false;
    };
  }, [partnerId, e2eeSetup]);

  // Fetch messages with proper caching
  const { data: messages = [], isLoading } = useQuery({
    queryKey: chatQueryKey,
    queryFn: async () => {
      const response = await fetch(
        buildUrl(api.chat.getMessages.path, { userId, partnerId })
      );
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Track when messages are ready to display (decrypted)
  useEffect(() => {
    // Show loading/decrypting if still loading messages OR E2EE not setup yet
    // Once both are ready, show the chat
    const shouldShowLoading = isLoading || !e2eeSetup;
    
    console.log('[Chat] Decrypt state check:', {
      isLoading,
      e2eeSetup,
      shouldShowLoading,
      messagesCount: messages.length
    });
    
    setIsDecrypting(shouldShowLoading);
  }, [isLoading, e2eeSetup]);

  // Auto-scroll to bottom when messages are fully decrypted and ready to display
  useLayoutEffect(() => {
    // Only scroll when we have messages and decryption is complete
    if (!isDecrypting && messages.length > 0) {
      console.log('[Chat] Messages ready, scrolling to bottom', { count: messages.length });
      
      // Use a more aggressive retry with multiple strategies
      let retries = 0;
      const maxRetries = 8;
      
      const doScroll = () => {
        try {
          // Strategy 1: Try using end marker ref
          if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
            console.log(`[Chat] Scrolled using end marker (attempt ${retries + 1})`);
          }
          
          // Strategy 2: Also try scrolling the viewport directly
          const scrollViewport = document.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollViewport) {
            scrollViewport.scrollTop = scrollViewport.scrollHeight;
            console.log(`[Chat] Scrolled viewport directly: ${scrollViewport.scrollTop}`);
          }
        } catch (e) {
          console.error('[Chat] Scroll error:', e);
        }
        
        // Retry with progressive delays
        if (retries < maxRetries) {
          retries++;
          const delay = 50 + retries * 30; // 80ms, 110ms, 140ms, ...
          setTimeout(doScroll, delay);
        } else {
          console.log('[Chat] Max scroll attempts reached');
        }
      };
      
      // Start scrolling on next frame
      requestAnimationFrame(doScroll);
    }
  }, [isDecrypting, messages.length]);

  // Calculate emoji menu position (top/bottom/side) based on surrounding messages and viewport bounds
  useEffect(() => {
    if (longPressedMessageId === null || !longPressMenuRef.current) return;

    const calculatePosition = () => {
      // Find the message element that's being reacted to
      const messageElement = document.querySelector(`[data-message-id="${longPressedMessageId}"]`);
      if (!messageElement) return;

      const scrollViewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (!scrollViewport) return;

      // Get actual menu dimensions (measured from DOM)
      const menuRect = longPressMenuRef.current?.getBoundingClientRect();
      const actualMenuWidth = menuRect ? menuRect.width : 300;
      const menuPadding = 12;
      const viewportPadding = 12;

      const messageRect = messageElement.getBoundingClientRect();
      const scrollRect = scrollViewport.getBoundingClientRect();
      
      // Find previous and next message elements
      const allMessages = Array.from(document.querySelectorAll('[data-message-id]'));
      const currentMessageIndex = allMessages.findIndex(
        (el) => (el as HTMLElement).dataset.messageId === String(longPressedMessageId)
      );

      const prevMessage = currentMessageIndex > 0 ? allMessages[currentMessageIndex - 1] : null;
      const nextMessage = currentMessageIndex < allMessages.length - 1 ? allMessages[currentMessageIndex + 1] : null;

      const prevRect = prevMessage ? prevMessage.getBoundingClientRect() : null;
      const nextRect = nextMessage ? nextMessage.getBoundingClientRect() : null;

      // Determine space above and below
      const spaceAbove = messageRect.top - scrollRect.top;
      const spaceBelow = scrollRect.bottom - messageRect.bottom;
      
      // Get actual menu height for accurate calculation
      const actualMenuHeight = menuRect ? menuRect.height + 8 : 60; // +8 for gap
      
      // Check if there's a message close above (within 200px)
      const hasMessageAbove = prevRect && (messageRect.top - prevRect.bottom) < 200;
      // Check if there's a message close below (within 200px)  
      const hasMessageBelow = nextRect && (nextRect.top - messageRect.bottom) < 200;

      let newPosition: 'top' | 'bottom' | 'side' = 'bottom';
      let newHorizontalAlign: 'left' | 'center' | 'right' = 'center';
      let newOffsetX = 0;

      // Determine vertical position with priority to avoid scrolling
      // Rule 1: Always prioritize fitting within viewport (no scrolling needed)
      const canFitBelow = spaceBelow >= actualMenuHeight + 12; // 12px padding
      const canFitAbove = spaceAbove >= actualMenuHeight + 12;
      
      if (hasMessageAbove && hasMessageBelow) {
        // Sandwiched between messages - use side positioning
        newPosition = 'side';
      } else if (!canFitBelow && canFitAbove) {
        // Not enough space below but enough above - definitely use top
        newPosition = 'top';
      } else if (canFitBelow && !canFitAbove) {
        // Enough space below but not above - use bottom
        newPosition = 'bottom';
      } else if (canFitBelow && canFitAbove) {
        // Can fit both ways - use preferred position based on messages around
        if (hasMessageBelow && !hasMessageAbove) {
          newPosition = 'top'; // Message below, no message above - show above
        } else if (hasMessageAbove && !hasMessageBelow) {
          newPosition = 'bottom'; // Message above, no message below - show below
        } else {
          // Default: show below if more space below, otherwise above
          newPosition = spaceBelow > spaceAbove ? 'bottom' : 'top';
        }
      } else {
        // Can't fit either way - use side positioning as fallback
        newPosition = 'side';
      }

      // Calculate horizontal alignment with smart viewport boundary safety
      // Use actual message center (not just wrapper)
      const bubbleCenter = messageRect.left + messageRect.width / 2;
      
      // Space available on left and right from viewport
      const spaceLeft = messageRect.left - scrollRect.left;
      const spaceRight = scrollRect.right - messageRect.right;
      
      if (newPosition === 'side') {
        // For side positioning, place on the side with more space
        if (spaceLeft >= spaceRight) {
          newHorizontalAlign = 'right'; // Place to the left of bubble
        } else {
          newHorizontalAlign = 'left'; // Place to the right of bubble
        }
      } else {
        // For top/bottom positioning, center by default but adjust if needed
        const halfMenu = actualMenuWidth / 2;
        const safeLeftEdge = scrollRect.left + viewportPadding;
        const safeRightEdge = scrollRect.right - viewportPadding;
        
        const wouldOverflowLeft = bubbleCenter - halfMenu < safeLeftEdge;
        const wouldOverflowRight = bubbleCenter + halfMenu > safeRightEdge;
        
        // Check if side positioning would fit better
        const sideSpaceNeeded = actualMenuWidth + menuPadding + 20; // 20px distance from bubble
        const sideWouldFitLeft = sideSpaceNeeded <= spaceLeft;
        const sideWouldFitRight = sideSpaceNeeded <= spaceRight;
        
        if (wouldOverflowLeft && wouldOverflowRight && (sideWouldFitLeft || sideWouldFitRight)) {
          // Both directions overflow, but side positioning would fit - use side
          newPosition = 'side';
          newHorizontalAlign = sideWouldFitLeft ? 'right' : 'left';
        } else if (wouldOverflowLeft && !wouldOverflowRight) {
          // Would overflow left - push to right
          newHorizontalAlign = 'left';
          newOffsetX = Math.max(safeLeftEdge - bubbleCenter + halfMenu, 0);
        } else if (wouldOverflowRight && !wouldOverflowLeft) {
          // Would overflow right - push to left
          newHorizontalAlign = 'right';
          newOffsetX = Math.min(safeRightEdge - bubbleCenter - halfMenu, 0);
        } else {
          // Fits perfectly centered
          newHorizontalAlign = 'center';
          newOffsetX = 0;
        }
      }

      console.log(`[Emoji Position] msg ${longPressedMessageId}:`, {
        position: newPosition,
        horizontalAlign: newHorizontalAlign,
        offsetX: newOffsetX,
        actualMenuWidth,
        spaceLeft,
        spaceRight,
      });

      setEmojiPosition(newPosition);
      setEmojiHorizontalAlign(newHorizontalAlign);
      setEmojiOffsetX(newOffsetX);
    };

    // Calculate immediately and after a small delay to ensure menu is rendered
    calculatePosition();
    const timer1 = setTimeout(calculatePosition, 50);
    const timer2 = setTimeout(calculatePosition, 150);
    
    window.addEventListener('scroll', calculatePosition, { passive: true });
    window.addEventListener('resize', calculatePosition, { passive: true });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('scroll', calculatePosition);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [longPressedMessageId]);

  // Calculate context menu position (top/bottom/side) based on viewport bounds
  useEffect(() => {
    if (contextMenuId === null || !contextMenuRef.current) return;

    const calculateContextMenuPosition = () => {
      // Find the message element for the context menu target
      const messageElement = document.querySelector(`[data-message-id="${contextMenuId}"]`) as HTMLElement;
      if (!messageElement) return;

      const scrollViewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (!scrollViewport) return;

      const messageRect = messageElement.getBoundingClientRect();
      const scrollRect = scrollViewport.getBoundingClientRect();
      const menuRect = contextMenuRef.current?.getBoundingClientRect();

      // Get actual menu height and width (measured from DOM)
      const actualMenuHeight = menuRect ? menuRect.height + 8 : 150;
      const actualMenuWidth = menuRect ? menuRect.width + 8 : 120;
      const menuPadding = 12;
      const viewportPadding = 12;

      // Calculate vertical position based on available space
      const spaceAbove = messageRect.top - scrollRect.top;
      const spaceBelow = scrollRect.bottom - messageRect.bottom;

      let newPosition: 'top' | 'bottom' | 'side' = 'bottom';
      let newHorizontalAlign: 'left' | 'center' | 'right' = 'center';
      let newOffsetX = 0;

      // Priority rule: prioritize vertical space for menu fit
      const canFitBelow = spaceBelow >= actualMenuHeight + viewportPadding;
      const canFitAbove = spaceAbove >= actualMenuHeight + viewportPadding;

      // Determine which side the message is on
      const scrollViewportWidth = scrollRect.width;
      const messageCenter = messageRect.left + messageRect.width / 2;
      const viewportCenter = scrollRect.left + scrollViewportWidth / 2;
      const isMessageOnRight = messageCenter > viewportCenter;
      
      // Calculate available space on left and right
      const spaceLeft = messageRect.left - scrollRect.left - viewportPadding;
      const spaceRight = scrollRect.right - messageRect.right - viewportPadding;
      
      const canFitLeft = spaceLeft >= actualMenuWidth;
      const canFitRight = spaceRight >= actualMenuWidth;

      if (!canFitBelow && canFitAbove) {
        // Not enough space below but enough above - use top
        newPosition = 'top';
      } else if (canFitBelow && !canFitAbove) {
        // Enough space below but not above - use bottom
        newPosition = 'bottom';
      } else if (canFitBelow && canFitAbove) {
        // Can fit both ways vertically - check for next message
        const allMessages = Array.from(document.querySelectorAll('[data-message-id]'));
        const currentIndex = allMessages.findIndex(el => (el as HTMLElement).dataset.messageId === String(contextMenuId));
        const hasMessageBelow = currentIndex < allMessages.length - 1;
        newPosition = hasMessageBelow ? 'top' : 'bottom';
      } else {
        // Can't fit vertically - must use side positioning
        newPosition = 'side';
      }

      // Handle horizontal alignment based on message side and available space
      if (newPosition !== 'side') {
        // For top/bottom positioning, try to position on the side
        // But ensure menu stays within viewport bounds
        
        // Calculate where menu would be if positioned on each side
        const messageLeft = messageRect.left - scrollRect.left;
        const messageRight = scrollRect.right - messageRect.right;
        
        // Check if we can fit menu on the right side of message
        const canFitOnRight = messageRect.right + 8 + actualMenuWidth <= scrollRect.right - viewportPadding;
        // Check if we can fit menu on the left side of message
        const canFitOnLeft = messageRect.left - 8 - actualMenuWidth >= scrollRect.left + viewportPadding;
        
        if (isMessageOnRight && canFitOnRight) {
          // User's message (right) - position menu on right if it fits
          newHorizontalAlign = 'right';
          newOffsetX = 0;
        } else if (!isMessageOnRight && canFitOnLeft) {
          // Partner's message (left) - position menu on left if it fits
          newHorizontalAlign = 'left';
          newOffsetX = 0;
        } else if (canFitOnLeft) {
          // Can't fit on preferred side, but can fit on left
          newHorizontalAlign = 'left';
          newOffsetX = 0;
        } else if (canFitOnRight) {
          // Can't fit on preferred side, but can fit on right
          newHorizontalAlign = 'right';
          newOffsetX = 0;
        } else {
          // Can't fit on either side - center it with boundary checks
          newHorizontalAlign = 'center';
          const messageCenterX = messageRect.left + messageRect.width / 2;
          const menuLeftEdge = messageCenterX - actualMenuWidth / 2;
          const menuRightEdge = messageCenterX + actualMenuWidth / 2;
          
          // Calculate offset to keep menu in bounds
          if (menuLeftEdge < scrollRect.left + viewportPadding) {
            newOffsetX = (scrollRect.left + viewportPadding) - menuLeftEdge;
          } else if (menuRightEdge > scrollRect.right - viewportPadding) {
            newOffsetX = (scrollRect.right - viewportPadding) - menuRightEdge;
          } else {
            newOffsetX = 0;
          }
        }
      }

      setContextMenuPosition(newPosition);
      setContextMenuHorizontalAlign(newHorizontalAlign);
      setContextMenuOffsetX(newOffsetX);
    };

    // Calculate immediately and after a small delay to ensure menu is rendered
    calculateContextMenuPosition();
    const timer1 = setTimeout(calculateContextMenuPosition, 50);
    const timer2 = setTimeout(calculateContextMenuPosition, 150);

    window.addEventListener('scroll', calculateContextMenuPosition, { passive: true });
    window.addEventListener('resize', calculateContextMenuPosition, { passive: true });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('scroll', calculateContextMenuPosition);
      window.removeEventListener('resize', calculateContextMenuPosition);
    };
  }, [contextMenuId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { content: string; replyToId?: number }) => {
      // Encrypt message with shared secret (ECDH derived from both public keys)
      // This way: message is encrypted, both users can decrypt, server cannot read
      
      let contentToSend = payload.content;

      console.log("[E2EE SEND]", {
        userId,
        partnerId,
        e2eeSetup,
        hasPartnerKey: !!partnerPublicKey,
        messageLength: payload.content.length,
      });

      // Encrypt message if E2EE is setup and partner's key is available
      if (e2eeSetup && partnerPublicKey) {
        try {
          const userKeyPair = getStoredKeyPair(userId);
          if (userKeyPair) {
            // Encrypt with shared secret (both public keys + user's secret key)
            contentToSend = encryptMessage(
              payload.content,
              userKeyPair.publicKey,  // User's own public key
              partnerPublicKey,        // Partner's public key
              userKeyPair.secretKey    // User's secret key
            );
            console.log("[E2EE SEND] ✓ Encrypted - Original:", payload.content.length, "→ Encrypted:", contentToSend.length);
          } else {
            console.warn("[E2EE SEND] ❌ KeyPair not found in localStorage for userId:", userId);
            throw new Error("No keypair found");
          }
        } catch (err) {
          console.error("[E2EE SEND] ❌ Encryption failed:", err);
          throw new Error("Failed to encrypt message");
        }
      } else {
        console.warn("[E2EE SEND] ❌ Cannot encrypt because:", {
          setupFalse: !e2eeSetup,
          partnerKeyNull: !partnerPublicKey,
        });
        throw new Error("E2EE not ready");
      }

      const response = await fetch(api.chat.sendMessage.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: userId,
          recipientId: partnerId,
          content: contentToSend,
          replyToId: payload.replyToId,
        }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Get encrypted content from server response (already encrypted)
      const encryptedContent = data.message.content;

      const newMsg: Message = {
        id: data.message.id,
        senderId: data.message.senderId,
        recipientId: data.message.recipientId,
        content: encryptedContent, // Use encrypted content from server (same as partner would see)
        replyToId: data.message.replyToId || null,
        isRead: false,
        createdAt: new Date(data.message.createdAt),
        readAt: null,
      };

      // Update React Query cache with new message
      queryClient.setQueryData(chatQueryKey, (oldData: Message[] | undefined) => {
        return oldData ? [...oldData, newMsg] : [newMsg];
      });

      setMessageText("");
      setReplyTo(null);
      // Auto-scroll is handled by useLayoutEffect on messages change
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal mengirim pesan",
        variant: "destructive",
      });
    },
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const response = await fetch(api.chat.markAsRead.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate chat query to refetch messages with updated read status
      queryClient.invalidateQueries({ queryKey: chatQueryKey });
      // Also invalidate unread count
      queryClient.invalidateQueries({ queryKey: ['unreadCount', userId] });
    },
  });

  // Add reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: async (payload: { messageId: number; userId: number; emoji: string }) => {
      const response = await fetch(api.chat.addReaction.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to add reaction");
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Update local state immediately for optimistic UI
      setMessageReactions((prev) => ({
        ...prev,
        [variables.messageId]: {
          ...(prev[variables.messageId] || {}),
          [variables.userId]: variables.emoji,
        },
      }));
    },
  });

  // Remove reaction mutation
  const removeReactionMutation = useMutation({
    mutationFn: async (payload: { messageId: number; userId: number }) => {
      const response = await fetch(
        buildUrl(api.chat.removeReaction.path, {
          messageId: payload.messageId.toString(),
          userId: payload.userId.toString(),
        }),
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to remove reaction");
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Update local state immediately
      setMessageReactions((prev) => {
        const updated = { ...prev };
        if (updated[variables.messageId]) {
          const messageReactions = { ...updated[variables.messageId] };
          delete messageReactions[variables.userId];
          if (Object.keys(messageReactions).length === 0) {
            delete updated[variables.messageId];
          } else {
            updated[variables.messageId] = messageReactions;
          }
        }
        return updated;
      });
    },
  });

  // Load reactions for all messages
  const loadReactionsForMessage = async (messageId: number) => {
    try {
      const response = await fetch(buildUrl(api.chat.getReactions.path, { messageId: messageId.toString() }));
      if (response.ok) {
        const data = await response.json();
        // data.reactions is Record<string, string> with userId (as string) -> emoji
        const reactions = data.reactions as Record<string, string>;
        if (Object.keys(reactions).length > 0) {
          setMessageReactions((prev) => ({
            ...prev,
            [messageId]: reactions,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to load reactions:", error);
    }
  };

  // Load reactions when messages change
  useEffect(() => {
    if (messages.length > 0) {
      Promise.all(messages.map((msg: Message) => loadReactionsForMessage(msg.id))).catch(console.error);
    }
  }, [messages.length]);

  // Mark all unread messages from partner as read when opening chat
  useEffect(() => {
    if (messages.length > 0) {
      messages.forEach((msg: Message) => {
        if (msg.senderId === partnerId && !msg.isRead) {
          markAsReadMutation.mutate(msg.id, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['unreadCount', userId] });
            }
          });
        }
      });
    }
  }, [messages, partnerId, userId, queryClient]);

  // Swipe handlers for quick reply
  const handleSwipeStart = (e: React.TouchEvent<HTMLDivElement>) => {
    swipeStartXRef.current = e.touches[0].clientX;
  };

  const handleSwipeMove = (messageId: number, e: React.TouchEvent<HTMLDivElement>) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - swipeStartXRef.current;
    
    // Only allow swipe to right (positive value)
    if (diff > 0 && diff < 100) {
      setSwipingMessageId(messageId);
      setSwipeOffset(diff);
    }
  };

  const handleSwipeEnd = (message: Message) => {
    if (swipeOffset > 50) {
      // Trigger reply if swiped more than 50px
      handleReply(message);
    }
    setSwipingMessageId(null);
    setSwipeOffset(0);
  };

  // Mouse drag handlers for desktop (similar to touch swipe)
  const handleMouseDown = (messageId: number, e: React.MouseEvent<HTMLDivElement>) => {
    // Only trigger on left mouse button (button 0)
    if (e.button !== 0) return;
    
    mouseDownXRef.current = e.clientX;
    setIsDraggingMessage(true);
  };

  const handleMouseMove = (messageId: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingMessage) return;
    
    const currentX = e.clientX;
    const diff = currentX - mouseDownXRef.current;
    
    // Only allow drag to right (positive value)
    if (diff > 0 && diff < 100) {
      setSwipingMessageId(messageId);
      setSwipeOffset(diff);
    }
  };

  const handleMouseUp = (message: Message) => {
    if (swipeOffset > 50) {
      // Trigger reply if dragged more than 50px
      handleReply(message);
    }
    setIsDraggingMessage(false);
    setSwipingMessageId(null);
    setSwipeOffset(0);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessageMutation.mutate({
        content: messageText,
        replyToId: replyTo?.id,
      });
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText(messageText + emoji);
  };

  // Add reaction from quick reactions menu (quick press) - ONLY ADD, no toggle
  const handleQuickReaction = (messageId: number, emoji: string) => {
    addReactionMutation.mutate(
      { messageId, userId, emoji },
      {
        onSuccess: () => {
          setLongPressedMessageId(null);
          toast({
            description: t('chat.reaction.added', { emoji }),
          });
        },
        onError: () => {
          toast({
            title: t('chat.error.title'),
            description: t('chat.reaction.addFailed'),
            variant: "destructive",
          });
        },
      }
    );
  };

  // Remove reaction from saved reactions display (top-right emoji) - ONLY REMOVE
  const handleRemoveReaction = (messageId: number, emoji: string) => {
    removeReactionMutation.mutate(
      { messageId, userId },
      {
        onSuccess: () => {
          toast({
            description: t('chat.reaction.removed', { emoji }),
          });
        },
        onError: () => {
          toast({
            title: t('chat.error.title'),
            description: t('chat.reaction.removeFailed'),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    setContextMenuId(null);
    toast({
      description: t('chat.message.copiedToClipboard'),
    });
  };

  const handleDeleteMessage = async (messageId: number, senderId: number) => {
    if (senderId !== userId) {
      toast({
        title: t('chat.error.title'),
        description: t('chat.message.canOnlyDeleteOwn'),
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(buildUrl(api.chat.deleteMessage.path, { messageId: messageId.toString() }), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error("Failed to delete message");

      // Update cache to remove the message
      queryClient.setQueryData(chatQueryKey, (oldData: Message[] | undefined) => {
        return oldData ? oldData.filter((msg) => msg.id !== messageId) : [];
      });

      setContextMenuId(null);
      toast({
        description: t('chat.message.deleteSuccess'),
      });
    } catch (error) {
      toast({
        title: t('chat.error.title'),
        description: t('chat.message.deleteFailed'),
        variant: "destructive",
      });
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
    setContextMenuId(null);
  };

  // Group messages by date
  const messagesByDate = messages.reduce((acc: Record<string, Message[]>, msg: Message) => {
    const date = new Date(msg.createdAt);
    const dateKey = date.toDateString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(msg);
    return acc;
  }, {} as Record<string, Message[]>);

  if (isLoading || isDecrypting) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground">
            {isLoading ? t('chat.loading.messages') : t('chat.loading.decrypting')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-slate-950 overflow-hidden">
      {/* Header - Instagram style */}
      <div className="bg-white dark:bg-slate-900/90 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title={t('chat.header.backButton')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            {partnerData?.avatarUrl && partnerData?.id && (
              <img 
                src={`/api/avatars/${partnerData.id}?t=${Date.now()}`} 
                alt={partnerName}
                className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-slate-700"
              />
            )}
            <div className="flex flex-col">
              <h2 className="font-semibold text-foreground">{partnerName}</h2>
              <p className="text-xs text-muted-foreground">
                {partnerStatus?.lastSeenText || t('common.loading')}
              </p>
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 w-full">
        <div className="px-4 py-3 space-y-4 max-w-full">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">💬</span>
              </div>
              <p className="text-lg font-medium">Belum ada pesan</p>
              <p className="text-sm mt-2">Mulai percakapan yang menyenangkan!</p>
            </div>
          ) : (
            Object.entries(messagesByDate).map(([dateKey, dayMessages]: [string, any]) => (
              <div key={dateKey}>
                {/* Date Separator */}
                <div className="flex items-center my-4">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                  <span className="px-3 text-xs text-muted-foreground font-medium">
                    {formatMessageDate(new Date(dateKey))}
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></div>
                </div>

                {/* Messages for this date */}
                {dayMessages.map((msg: Message) => {
                  // Check if message can be decrypted - if not, SKIP rendering
                  const decryptedContent = decryptMessageContentSafely(
                    msg.content,
                    msg.senderId,
                    userId,
                    partnerPublicKey,
                    e2eeSetup,
                    msg.id
                  );
                  
                  // If decrypted content is null (couldn't decrypt), skip this message
                  if (decryptedContent === null) {
                    return null;
                  }

                  const handleMessagePointerDown = () => {
                    longPressTimerRef.current = setTimeout(() => {
                      setLongPressedMessageId(msg.id);
                    }, 500); // 500ms long press
                  };

                  const handleMessagePointerUp = () => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  };

                  return (
                  <div
                    key={msg.id}
                    className={`flex mb-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 px-2 overflow-visible user-select-none ${
                      msg.senderId === userId ? "justify-end" : "justify-start"
                    }`}
                    onPointerDown={handleMessagePointerDown}
                    onPointerUp={handleMessagePointerUp}
                    onPointerLeave={handleMessagePointerUp}
                    onTouchStart={handleSwipeStart}
                    onTouchMove={(e) => handleSwipeMove(msg.id, e)}
                    onTouchEnd={() => handleSwipeEnd(msg)}
                    onMouseDown={(e) => handleMouseDown(msg.id, e)}
                    onMouseMove={(e) => handleMouseMove(msg.id, e)}
                    onMouseUp={() => handleMouseUp(msg)}
                    onMouseLeave={() => {
                      if (isDraggingMessage) {
                        setIsDraggingMessage(false);
                        setSwipingMessageId(null);
                        setSwipeOffset(0);
                      }
                    }}
                  >
                    {/* Reply indicator icon during drag */}
                    {swipingMessageId === msg.id && swipeOffset > 20 && (
                      <div className="flex items-center justify-center mr-2 opacity-60">
                        <CornerUpLeft className="w-5 h-5 text-blue-500" />
                      </div>
                    )}
                    
                    
                    {/* Message bubble with actions */}
                    <div 
                      className="relative group max-w-sm lg:max-w-2xl min-w-0 overflow-visible user-select-none" 
                      data-message-id={msg.id}
                      style={{
                        transform: swipingMessageId === msg.id ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                        transition: swipingMessageId === msg.id ? 'none' : 'transform 0.2s ease-out',
                      }}
                    >
                      {/* Reply quote reference if message is a reply */}
                      {msg.replyToId && messages.find((m: Message) => m.id === msg.replyToId) && (() => {
                        const referencedMsg = messages.find((m: Message) => m.id === msg.replyToId);
                        if (!referencedMsg) return null;
                        
                        const replyContent = decryptMessageContentSafely(
                          referencedMsg.content,
                          referencedMsg.senderId,
                          userId,
                          partnerPublicKey,
                          e2eeSetup,
                          referencedMsg.id
                        );
                        
                        // Skip showing reply reference if it can't be decrypted
                        if (replyContent === null) return null;
                        
                        return (
                          <button
                            onClick={() => {
                              // Find the referenced message element and scroll to it
                              const referencedElement = document.querySelector(`[data-message-id="${msg.replyToId}"]`);
                              if (referencedElement) {
                                referencedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Add highlight effect
                                referencedElement.classList.add('animate-pulse', 'bg-yellow-100', 'dark:bg-yellow-900/30');
                                setTimeout(() => {
                                  referencedElement.classList.remove('animate-pulse', 'bg-yellow-100', 'dark:bg-yellow-900/30');
                                }, 2000);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-t-2xl text-xs border-b border-opacity-30 cursor-pointer hover:opacity-80 transition-opacity w-full block overflow-hidden min-w-0 text-left user-select-none ${
                              msg.senderId === userId
                                ? "bg-blue-400 border-white text-blue-50"
                                : "bg-gray-200 dark:bg-slate-700 border-gray-400 dark:border-slate-600 text-foreground"
                            }`}>
                            <p className="text-xs font-medium opacity-80 mb-1 text-left">{referencedMsg.senderId === userId ? t('chat.common.you') : partnerName}</p>
                            <p className="opacity-80 text-xs break-all overflow-hidden line-clamp-3 text-left">{replyContent}</p>
                          </button>
                        );
                      })()}
                      
                      <div
                        className={`px-4 py-2.5 w-full min-w-0 user-select-none ${msg.replyToId ? "rounded-b-2xl rounded-t-none" : "rounded-2xl"} transition-all ${
                          msg.senderId === userId
                            ? "bg-blue-500 text-white rounded-br-none shadow-sm"
                            : "bg-gray-100 dark:bg-slate-800 text-foreground rounded-bl-none shadow-sm"
                        }`}
                      >
                        <p className="text-sm word-break break-all leading-relaxed overflow-hidden whitespace-normal">
                          {decryptedContent}
                        </p>
                      </div>

                      {/* Time and read status */}
                      <div className={`flex items-center gap-1 mt-1 px-2 text-xs ${
                        msg.senderId === userId ? "justify-end" : "justify-start"
                      } text-muted-foreground`}>
                        {msg.senderId === userId && (
                          <span>{msg.isRead ? t('chat.message.status.read') : t('chat.message.status.sent')}</span>
                        )}
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Saved reactions display - top right corner of bubble - HIGH z-index to appear on top */}
                      {messageReactions[msg.id] && Object.keys(messageReactions[msg.id]).length > 0 && (
                        <div className="absolute -top-3 -right-3 bg-white dark:bg-slate-900 rounded-full px-2 py-1 shadow-lg border border-gray-200 dark:border-slate-700 flex gap-1 flex-wrap max-w-xs z-[9999]">
                          {Object.entries(messageReactions[msg.id]).map(([reactionUserId, emoji]) => {
                            const isCurrentUserReaction = parseInt(reactionUserId) === userId;
                            return (
                              <button
                                key={reactionUserId}
                                onClick={() => {
                                  if (isCurrentUserReaction) {
                                    handleRemoveReaction(msg.id, emoji);
                                  }
                                }}
                                className={`text-sm inline-block ${
                                  isCurrentUserReaction ? "cursor-pointer hover:opacity-70 transition-opacity" : "cursor-default"
                                }`}
                                title={isCurrentUserReaction ? `Click to remove your ${emoji} reaction` : `${emoji} reaction`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Emoji reactions on long-press - smart adaptive positioning */}
                      {longPressedMessageId === msg.id && (
                        <div 
                          ref={longPressMenuRef}
                          className={`absolute bg-white dark:bg-slate-800 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex gap-1 p-2 animate-in fade-in-0 scale-In-95 duration-150 z-[9999] whitespace-nowrap ${
                            emojiPosition === 'top'
                              ? 'bottom-full mb-2'
                              : emojiPosition === 'bottom'
                              ? 'top-full mt-2'
                              : 'top-1/2 -translate-y-1/2'
                          }`}
                          style={
                            emojiPosition === 'side'
                              ? {
                                  left: msg.senderId === userId ? '-140px' : 'auto',
                                  right: msg.senderId === userId ? 'auto' : '-140px',
                                }
                              : {
                                  left: emojiHorizontalAlign === 'center' 
                                    ? '50%' 
                                    : emojiHorizontalAlign === 'left'
                                    ? '0'
                                    : 'auto',
                                  right: emojiHorizontalAlign === 'right' 
                                    ? '0'
                                    : 'auto',
                                  transform: 
                                    emojiHorizontalAlign === 'center'
                                      ? `translateX(calc(-50% + ${emojiOffsetX}px))`
                                      : emojiOffsetX !== 0
                                      ? `translateX(${emojiOffsetX}px)`
                                      : undefined,
                                }
                          }
                        >
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleQuickReaction(msg.id, emoji)}
                              className="text-lg hover:scale-125 transition-transform duration-150 cursor-pointer"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                          <button 
                            onClick={() => {
                              setContextMenuId(msg.id);
                              setLongPressedMessageId(null);
                            }}
                            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Context menu - absolutely positioned for always-on-top display */}
                      {contextMenuId === msg.id && (
                        <div 
                          ref={contextMenuRef}
                          className={`absolute bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 z-[50] animate-in fade-in-0 duration-150 overflow-visible pointer-events-auto ${
                            contextMenuPosition === 'top'
                              ? "bottom-full mb-2"
                              : contextMenuPosition === 'bottom'
                              ? "top-full mt-2"
                              : "top-1/2 -translate-y-1/2"
                          }`}
                          style={{
                            // Position on the side of the message, not overlapping
                            ...(contextMenuHorizontalAlign === 'left' && {
                              right: 'calc(100% + 12px)',
                              left: 'auto',
                            }),
                            ...(contextMenuHorizontalAlign === 'right' && {
                              left: 'calc(100% + 12px)',
                              right: 'auto',
                            }),
                            ...(contextMenuHorizontalAlign === 'center' && {
                              left: '50%',
                              transform: 'translateX(-50%)',
                            }),
                          }}
                        >
                          <button
                            onClick={() => handleReply(msg)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 text-foreground"
                            title={t('chat.contextMenu.reply')}
                          >
                            <CornerUpLeft className="w-4 h-4" />
                            {t('chat.contextMenu.reply')}
                          </button>
                          
                          <button
                            onClick={() => handleCopyMessage(msg.content)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 text-foreground"
                            title={t('chat.contextMenu.copy')}
                          >
                            <Copy className="w-4 h-4" />
                            {t('chat.contextMenu.copyButton')}
                          </button>
                          
                          {msg.senderId === userId && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id, msg.senderId)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-3 text-red-500 hover:text-red-600 dark:hover:text-red-400 border-t border-gray-200 dark:border-slate-700"
                              title={t('chat.contextMenu.deleteTooltip')}
                            >
                              <Trash2 className="w-4 h-4" />
                              {t('chat.contextMenu.deleteButton')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ))
          )}
          {/* End of messages marker for scroll-into-view */}
          <div ref={endOfMessagesRef} />
        </div>
      </ScrollArea>

      {/* Reply Quote Display */}
      {replyTo && (
        <div className="w-full max-w-full overflow-hidden border-t border-l-4 border-blue-400 bg-blue-50 dark:bg-slate-800/50 px-3 py-2 flex gap-2 user-select-none">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 text-left truncate">{replyTo.senderId === userId ? t('chat.common.you') : partnerName}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 break-all overflow-hidden line-clamp-2 text-left w-full">
              {decryptMessageContentSafely(
                replyTo.content,
                replyTo.senderId,
                userId,
                partnerPublicKey,
                e2eeSetup,
                replyTo.id
              ) || "[Message content unavailable]"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="flex-shrink-0 ml-auto text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold mt-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Area - Instagram style */}
      <form
        onSubmit={handleSendMessage}
        className="relative w-full max-w-full border-t border-gray-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900 flex gap-2"
      >
        <Input
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={t('chat.input.placeholder')}
          disabled={sendMessageMutation.isPending}
          className="flex-1 rounded-full px-4 py-2 border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all focus:outline-none"
        />

        <div ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title={t('chat.emoji.addButton')}
          >
            <Smile className="w-5 h-5 text-yellow-500" />
          </button>
        </div>

        {/* Emoji Picker - Centered in Chat Window */}
        {showEmojiPicker && (
          <div ref={emojiPickerMenuRef} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 w-80 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Category Tabs - Scrollable with Arrow Buttons */}
              <div className="flex items-center border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); scrollCategories('left'); }}
                  className="flex-shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  title={t('chat.emoji.scrollLeft')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div ref={categoryScrollRef} className="flex-1 overflow-x-auto" style={{ scrollBehavior: 'smooth' }}>
                  <div className="flex min-w-max">
                    {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActiveEmojiCategory(key as keyof typeof EMOJI_CATEGORIES); }}
                        className={`flex-shrink-0 px-4 py-3 text-lg transition-all duration-200 whitespace-nowrap ${
                          activeEmojiCategory === key
                            ? "bg-blue-50 dark:bg-blue-900/30 border-b-2 border-blue-500"
                            : "hover:bg-gray-100 dark:hover:bg-slate-700 opacity-60 hover:opacity-100"
                        }`}
                        title={category.name}
                      >
                        {category.icon}
                      </button>
                    ))}
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); scrollCategories('right'); }}
                  className="flex-shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  title={t('chat.emoji.scrollRight')}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Emoji Grid */}
              <ScrollArea className="h-56 w-full p-3">
                <div className="grid grid-cols-6 gap-2">
                  {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEmojiSelect(emoji); }}
                      className="text-2xl w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all hover:scale-125 duration-150"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
        )}

        <Button
          type="submit"
          disabled={sendMessageMutation.isPending || !messageText.trim()}
          size="sm"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-6 transition-all hover:shadow-lg disabled:opacity-50 font-medium"
        >
          {sendMessageMutation.isPending ? "..." : "Send"}
        </Button>
      </form>
    </div>
  );
}


