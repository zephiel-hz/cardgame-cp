import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useWebSocketMessages } from "@/hooks/use-websocket";
import { Smile } from "lucide-react";
import { EMOJI_CATEGORIES } from "@/data/emoji-categories";
import type { Message } from "@shared/schema";

interface ChatWindowProps {
  userId: number;
  partnerId: number;
  partnerName: string;
}

export function ChatWindow({
  userId,
  partnerId,
  partnerName,
}: ChatWindowProps) {
  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>("smileys");
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Create stable query key - memoize to prevent recreation on every render
  const chatQueryKey = useMemo(() => [api.chat.getMessages.path, userId, partnerId], [userId, partnerId]);

  // Listen for incoming WebSocket messages and update cache in real-time
  useWebSocketMessages(
    useCallback((incomingMessage: Message & { senderUsername?: string }) => {
      console.log('[ChatWindow] useWebSocketMessages callback fired');
      console.log('[ChatWindow] Incoming message:', incomingMessage);
      console.log('[ChatWindow] Current user:', userId, 'Partner:', partnerId);
      console.log('[ChatWindow] Message is from partner?', incomingMessage.senderId === partnerId, 'To current user?', incomingMessage.recipientId === userId);
      
      // Only update if message is for this conversation
      if (incomingMessage.senderId === partnerId && incomingMessage.recipientId === userId) {
        console.log('[ChatWindow] ✅ Message is for this conversation, updating cache');
        
        // Update cache immediately
        queryClient.setQueryData(chatQueryKey, (oldData: Message[] | undefined) => {
          console.log('[ChatWindow] Old cache data:', oldData?.length || 0, 'messages');
          
          // Check if message already exists to avoid duplicates
          if (oldData?.some(msg => msg.id === incomingMessage.id)) {
            console.log('[ChatWindow] Message already exists in cache, skipping');
            return oldData;
          }
          
          const newData = oldData ? [...oldData, incomingMessage] : [incomingMessage];
          console.log('[ChatWindow] Updated cache with new message, total:', newData.length);
          return newData;
        });

        // Invalidate unread count when message arrives (it's now unread)
        queryClient.invalidateQueries({ queryKey: ['unreadCount', userId] });

        // Scroll to bottom after a small delay to let React render
        setTimeout(() => {
          console.log('[ChatWindow] Scrolling to bottom');
          if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }, 0);
      } else {
        console.log('[ChatWindow] ❌ Message is NOT for this conversation');
      }
    }, [partnerId, userId, queryClient, chatQueryKey])
  );

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
    gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 0);
    }
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(api.chat.sendMessage.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: userId,
          recipientId: partnerId,
          content,
        }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data) => {
      const newMsg: Message = {
        id: data.message.id,
        senderId: data.message.senderId,
        recipientId: data.message.recipientId,
        content: data.message.content,
        isRead: false,
        createdAt: new Date(data.message.createdAt),
        readAt: null,
      };

      // Update React Query cache with new message
      queryClient.setQueryData(chatQueryKey, (oldData: Message[] | undefined) => {
        return oldData ? [...oldData, newMsg] : [newMsg];
      });

      setMessageText("");
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 0);
    },
    onError: (err) => {
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
  });

  // Mark all unread messages from partner as read when opening chat
  useEffect(() => {
    if (messages.length > 0) {
      console.log('[ChatWindow] Auto-marking unread messages as read');
      messages.forEach((msg) => {
        // Only mark messages from partner that are unread
        if (msg.senderId === partnerId && !msg.isRead) {
          console.log('[ChatWindow] Marking message', msg.id, 'as read');
          markAsReadMutation.mutate(msg.id, {
            onSuccess: () => {
              // Invalidate the unread count in layout when marking messages as read
              queryClient.invalidateQueries({ queryKey: ['unreadCount', userId] });
            }
          });
        }
      });
    }
  }, [messages, partnerId, userId, queryClient]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessageMutation.mutate(messageText);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText(messageText + emoji);
    setShowEmojiPicker(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden flex flex-col h-96 bg-gradient-to-b from-background via-background to-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 via-pink-500 to-purple-600 dark:from-purple-600 dark:via-purple-500 dark:to-pink-500 text-white p-4 border-b border-pink-400/20 shadow-md">
        <h3 className="font-semibold text-lg">💬 Chat dengan {partnerName}</h3>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p className="text-lg">💭 Belum ada pesan</p>
              <p className="text-sm mt-2">Mulai percakapan yang menyenangkan!</p>
            </div>
          ) : (
            messages.map((msg: Message) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.senderId === userId ? "justify-end" : "justify-start"
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-xs px-4 py-3 rounded-2xl shadow-sm transition-all hover:shadow-md ${
                    msg.senderId === userId
                      ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-br-none"
                      : "bg-gradient-to-r from-muted to-muted/80 text-foreground rounded-bl-none border border-border/50"
                  }`}
                >
                  <p className="text-sm break-words leading-relaxed">{msg.content}</p>
                  <p className={`text-xs mt-2 ${
                    msg.senderId === userId ? "opacity-80" : "opacity-60"
                  }`}>
                    {new Date(msg.createdAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="border-t p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-slate-900/50 dark:to-slate-800/50 flex gap-3 relative backdrop-blur-sm"
      >
        <div className="relative" ref={emojiPickerRef}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-3 hover:bg-pink-100 dark:hover:bg-slate-700 transition-colors rounded-full"
            title="Tambah emoji"
          >
            <Smile className="w-5 h-5" />
          </Button>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-3 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-600 z-50 w-72 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Category Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-600 overflow-x-auto bg-gray-50 dark:bg-slate-900/50">
                {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveEmojiCategory(key as keyof typeof EMOJI_CATEGORIES)}
                    className={`flex-shrink-0 px-3 py-3 text-xl transition-all duration-200 ${
                      activeEmojiCategory === key
                        ? "bg-gradient-to-b from-pink-100 to-pink-50 dark:from-pink-900/50 dark:to-pink-900/30 border-b-2 border-pink-500 scale-110"
                        : "hover:bg-gray-100 dark:hover:bg-slate-700 opacity-70 hover:opacity-100"
                    }`}
                    title={category.name}
                  >
                    {category.icon}
                  </button>
                ))}
              </div>

              {/* Emoji Grid */}
              <ScrollArea className="h-64 w-full p-3">
                <div className="grid grid-cols-6 gap-2">
                  {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiSelect(emoji)}
                      className="text-2xl w-10 h-10 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-slate-700 rounded-lg transition-all hover:scale-125 duration-150"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <Input
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Ketik pesan..."
          disabled={sendMessageMutation.isPending}
          className="flex-1 rounded-full px-5 py-2 border-2 border-pink-200 dark:border-slate-600 focus:border-pink-400 dark:focus:border-pink-500 transition-colors bg-white dark:bg-slate-800"
        />
        <Button
          type="submit"
          disabled={
            sendMessageMutation.isPending || !messageText.trim()
          }
          size="sm"
          className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-full px-6 transition-all hover:shadow-lg disabled:opacity-50"
        >
          {sendMessageMutation.isPending ? "..." : "Kirim"}
        </Button>
      </form>
    </div>
  );
}
