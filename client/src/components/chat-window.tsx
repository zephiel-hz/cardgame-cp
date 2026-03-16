import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useWebSocketMessages } from "@/hooks/use-websocket";
import { Smile, ArrowLeft, MoreVertical, Image as ImageIcon, Paperclip } from "lucide-react";
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
    return null; // Don't show date for today
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

export function ChatWindow({
  userId,
  partnerId,
  partnerName,
  partnerData,
  onBack,
}: ChatWindowProps) {
  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>("smileys");
  const [longPressedMessageId, setLongPressedMessageId] = useState<number | null>(null);
  const [contextMenuId, setContextMenuId] = useState<number | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<number, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const longPressMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Close emoji picker and clear long press when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
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
        // Update cache immediately
        queryClient.setQueryData(chatQueryKey, (oldData: Message[] | undefined) => {
          // Check if message already exists to avoid duplicates
          if (oldData?.some(msg => msg.id === incomingMessage.id)) {
            return oldData;
          }
          
          const newData = oldData ? [...oldData, incomingMessage] : [incomingMessage];
          return newData;
        });

        // Invalidate unread count when message arrives
        queryClient.invalidateQueries({ queryKey: ['unreadCount', userId] });

        // Scroll to bottom after a small delay
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }, 0);
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
    gcTime: 1000 * 60 * 30, // 30 minutes
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
  });

  // Mark all unread messages from partner as read when opening chat
  useEffect(() => {
    if (messages.length > 0) {
      messages.forEach((msg) => {
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

  const handleAddReaction = (messageId: number, emoji: string) => {
    setMessageReactions((prev) => {
      // Override - single reaction per message
      return {
        ...prev,
        [messageId]: emoji,
      };
    });
    setLongPressedMessageId(null);
    toast({
      description: `Reacted with ${emoji}`,
    });
  };

  // Group messages by date
  const messagesByDate = messages.reduce((acc, msg) => {
    const date = new Date(msg.createdAt);
    const dateKey = date.toDateString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(msg);
    return acc;
  }, {} as Record<string, Message[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading messages...</p>
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
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            {partnerData?.avatarUrl && (
              <img 
                src={partnerData.avatarUrl} 
                alt={partnerName}
                className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-slate-700"
              />
            )}
            <div className="flex flex-col">
              <h2 className="font-semibold text-foreground">{partnerName}</h2>
              <p className="text-xs text-muted-foreground">Active now</p>
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">💬</span>
              </div>
              <p className="text-lg font-medium">Belum ada pesan</p>
              <p className="text-sm mt-2">Mulai percakapan yang menyenangkan!</p>
            </div>
          ) : (
            Object.entries(messagesByDate).map(([dateKey, dayMessages]) => (
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
                    className={`flex gap-3 mb-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${
                      msg.senderId === userId ? "justify-end" : "justify-start"
                    }`}
                    onPointerDown={handleMessagePointerDown}
                    onPointerUp={handleMessagePointerUp}
                    onPointerLeave={handleMessagePointerUp}
                  >
                    {/* Avatar for incoming messages */}
                    {msg.senderId !== userId && (
                      <div className="w-7 h-7 rounded-full flex-shrink-0">
                        {partnerData?.avatarUrl && (
                          <img 
                            src={partnerData.avatarUrl}
                            alt={partnerName}
                            className="w-full h-full rounded-full object-cover border border-gray-200 dark:border-slate-700"
                          />
                        )}
                      </div>
                    )}

                    {/* Message bubble with actions */}
                    <div className={`relative group max-w-xs lg:max-w-md ${msg.senderId === userId ? "order-2" : "order-1"}`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl transition-all ${
                          msg.senderId === userId
                            ? "bg-blue-500 text-white rounded-br-none shadow-sm"
                            : "bg-gray-100 dark:bg-slate-800 text-foreground rounded-bl-none shadow-sm"
                        }`}
                      >
                        <p className="text-sm break-words leading-relaxed">{msg.content}</p>
                      </div>

                      {/* Time and read status */}
                      <div className={`flex items-center gap-1 mt-1 px-2 text-xs ${
                        msg.senderId === userId ? "justify-end" : "justify-start"
                      } text-muted-foreground`}>
                        {msg.senderId === userId && (
                          <span>{msg.isRead ? "read" : "sent"}</span>
                        )}
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Saved reactions display - top right corner of bubble */}
                      {messageReactions[msg.id] && (
                        <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 rounded-full px-1.5 py-0.5 shadow-md border border-gray-200 dark:border-slate-700">
                          <span
                            className="text-xs inline-block"
                            title={`Reacted with ${messageReactions[msg.id]}`}
                          >
                            {messageReactions[msg.id]}
                          </span>
                        </div>
                      )}

                      {/* Emoji reactions on long-press */}
                      {longPressedMessageId === msg.id && (
                        <div 
                          ref={longPressMenuRef}
                          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex gap-1 p-2 animate-in fade-in-0 scale-In-95 duration-150 z-30 whitespace-nowrap max-w-fit"
                        >
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleAddReaction(msg.id, emoji)}
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

                      {/* Context menu */}
                      {contextMenuId === msg.id && (
                        <div 
                          ref={contextMenuRef}
                          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-20 animate-in fade-in-0 slide-in-from-top-2 duration-150 overflow-hidden min-w-fit"
                        >
                          {[
                            { label: "Reply", icon: "↩️" },
                            { label: "Copy", icon: "📋" },
                            { label: "Forward", icon: "↪️" },
                            { label: "Delete", icon: "🗑️", className: "text-red-500" },
                          ].map((action) => (
                            <button
                              key={action.label}
                              onClick={() => {
                                toast({ description: `${action.label} clicked` });
                                setContextMenuId(null);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 ${action.className || ""}`}
                            >
                              <span>{action.icon}</span>
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area - Instagram style */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-gray-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900 flex gap-2"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Attach image"
          >
            <ImageIcon className="w-5 h-5 text-blue-500" />
          </button>
          <button
            type="button"
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5 text-blue-500" />
          </button>
        </div>

        <Input
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Aa"
          disabled={sendMessageMutation.isPending}
          className="flex-1 rounded-full px-4 py-2 border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all focus:outline-none"
        />

        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Add emoji"
          >
            <Smile className="w-5 h-5 text-yellow-500" />
          </button>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 w-80 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Category Tabs */}
              <div className="flex border-b border-gray-200 dark:border-slate-700 overflow-x-auto bg-gray-50 dark:bg-slate-900/50">
                {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveEmojiCategory(key as keyof typeof EMOJI_CATEGORIES)}
                    className={`flex-shrink-0 px-3 py-3 text-lg transition-all duration-200 ${
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

              {/* Emoji Grid */}
              <ScrollArea className="h-56 w-full p-3">
                <div className="grid grid-cols-6 gap-2">
                  {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiSelect(emoji)}
                      className="text-2xl w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all hover:scale-125 duration-150"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

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


