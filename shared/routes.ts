import { z } from 'zod';
import { users } from './schema';
import type { UserCardWithDetails } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: z.object({ 
        username: z.string().min(3),
        pin: z.string().length(4),
        gender: z.enum(['male', 'female', 'other']).optional(),
        email: z.string().email().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        409: z.object({ message: z.string() }), // User exists
      }
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ username: z.string(), pin: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      }
    },
    updateProfile: {
      method: 'PATCH' as const,
      path: '/api/auth/profile' as const,
      input: z.object({ 
        userId: z.number(),
        username: z.string().optional(),
        pin: z.string().optional(),
        avatarUrl: z.string().optional(),
        gender: z.enum(['male', 'female', 'other']).optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      }
    },
    listUsers: {
      method: 'GET' as const,
      path: '/api/auth/users' as const,
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      }
    },
    uploadAvatar: {
      method: 'POST' as const,
      path: '/api/auth/upload-avatar' as const,
      responses: {
        200: z.object({ avatarUrl: z.string() }),
        400: errorSchemas.validation,
      }
    },
    updateEmail: {
      method: 'POST' as const,
      path: '/api/auth/update-email' as const,
      input: z.object({ 
        userId: z.number(),
        email: z.string().email(),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: errorSchemas.validation,
        409: z.object({ message: z.string() }), // Email already exists
      }
    },
    verifyEmail: {
      method: 'POST' as const,
      path: '/api/auth/verify-email' as const,
      input: z.object({ 
        token: z.string(),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ message: z.string() }),
      }
    },
    sendRegistrationEmail: {
      method: 'POST' as const,
      path: '/api/auth/send-registration-email' as const,
      input: z.object({ 
        email: z.string().email(),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
      }
    },
    pairPartner: {
      method: 'POST' as const,
      path: '/api/auth/pair-partner' as const,
      input: z.object({ 
        userId: z.number(),
        partnerId: z.number(),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      }
    },
    getPartner: {
      method: 'GET' as const,
      path: '/api/auth/partner/:userId' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>().nullable(),
        404: errorSchemas.notFound,
      }
    },
    getUserInfo: {
      method: 'GET' as const,
      path: '/api/auth/user/:id' as const,
      responses: {
        200: z.object({
          id: z.number(),
          username: z.string(),
          avatarUrl: z.string().nullable(),
          gender: z.string().nullable(),
          cardCount: z.number()
        }).nullable(),
        404: errorSchemas.notFound,
      }
    },
    sendPartnershipRequest: {
      method: 'POST' as const,
      path: '/api/auth/send-partnership-request' as const,
      input: z.object({
        userId: z.number(),
        partnerId: z.number(),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
      }
    },
    getPendingRequests: {
      method: 'GET' as const,
      path: '/api/auth/pending-partnership-requests/:userId' as const,
      responses: {
        200: z.array(z.object({
          id: z.number(),
          fromUserId: z.number(),
          toUserId: z.number(),
          status: z.string(),
          createdAt: z.instanceof(Date).nullable(),
          respondedAt: z.instanceof(Date).nullable(),
        })),
      }
    },
    respondToPartnershipRequest: {
      method: 'POST' as const,
      path: '/api/auth/respond-partnership-request' as const,
      input: z.object({
        requestId: z.number(),
        accept: z.boolean(),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      }
    },
    initiateRemoval: {
      method: 'POST' as const,
      path: '/api/auth/remove-partnership' as const,
      input: z.object({
        userId: z.number(),
        reason: z.string().min(1, "Alasan penghapusan partnership wajib diisi"),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      }
    },
    getPendingRemovals: {
      method: 'GET' as const,
      path: '/api/auth/pending-removal-requests/:userId' as const,
      responses: {
        200: z.array(z.object({
          id: z.number(),
          initiatorId: z.number(),
          partnerId: z.number(),
          initiatorAccepted: z.boolean(),
          partnerAccepted: z.boolean().nullable(),
          reason: z.string(),
          rejectionReason: z.string().nullable(),
          status: z.string(),
          createdAt: z.instanceof(Date).nullable(),
          respondedAt: z.instanceof(Date).nullable(),
        })),
      }
    },
    respondToRemoval: {
      method: 'POST' as const,
      path: '/api/auth/respond-removal-request' as const,
      input: z.object({
        requestId: z.number(),
        accept: z.boolean(),
        userId: z.number(),
        rejectionReason: z.string().optional(), // Required if accept is false
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      }
    },
    forceDeletePartnership: {
      method: 'POST' as const,
      path: '/api/auth/force-delete-partnership' as const,
      input: z.object({
        requestId: z.number(),
        userId: z.number(),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      }
    }
  },
  gacha: {
    pull: {
      method: 'POST' as const,
      path: '/api/gacha/pull' as const,
      input: z.object({ userId: z.number() }),
      responses: {
        200: z.object({ 
          success: z.boolean(), 
          card: z.custom<UserCardWithDetails>().optional(),
          remainingPulls: z.number(),
          message: z.string().optional()
        }),
        400: errorSchemas.validation,
      }
    },
    status: {
      method: 'GET' as const,
      path: '/api/gacha/status/:userId' as const,
      responses: {
        200: z.object({ remainingPulls: z.number(), nextResetTime: z.string() })
      }
    }
  },
  inventory: {
    list: {
      method: 'GET' as const,
      path: '/api/inventory/:userId' as const,
      responses: {
        200: z.array(z.custom<UserCardWithDetails>()),
      }
    },
    use: {
      method: 'POST' as const,
      path: '/api/inventory/use' as const,
      input: z.object({ userCardId: z.number() }),
      responses: {
        200: z.custom<UserCardWithDetails>(),
        400: errorSchemas.validation,
      }
    }
  },
  activeCards: {
    list: {
      method: 'GET' as const,
      path: '/api/active-cards/:userId' as const,
      responses: {
        200: z.array(z.custom<UserCardWithDetails>()),
        401: errorSchemas.validation,
        403: z.object({ message: z.string() }),
      }
    }
  },
  chat: {
    sendMessage: {
      method: 'POST' as const,
      path: '/api/chat/send' as const,
      input: z.object({ 
        senderId: z.number(),
        recipientId: z.number(),
        content: z.string().min(1).max(1000),
      }),
      responses: {
        200: z.object({ 
          success: z.boolean(), 
          message: z.object({
            id: z.number(),
            senderId: z.number(),
            recipientId: z.number(),
            content: z.string(),
            isRead: z.boolean(),
            createdAt: z.instanceof(Date),
          })
        }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      }
    },
    getMessages: {
      method: 'GET' as const,
      path: '/api/chat/messages/:userId/:partnerId' as const,
      responses: {
        200: z.array(z.object({
          id: z.number(),
          senderId: z.number(),
          recipientId: z.number(),
          content: z.string(),
          isRead: z.boolean(),
          createdAt: z.instanceof(Date),
          readAt: z.instanceof(Date).nullable(),
        })),
        404: errorSchemas.notFound,
      }
    },
    markAsRead: {
      method: 'POST' as const,
      path: '/api/chat/mark-as-read' as const,
      input: z.object({ 
        messageId: z.number(),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      }
    },
    getUnreadCount: {
      method: 'GET' as const,
      path: '/api/chat/unread-count/:userId' as const,
      responses: {
        200: z.object({ unreadCount: z.number() }),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export const WS_EVENTS = {
  CARD_USED: 'card_used',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_READ: 'message_read',
} as const;

export interface WsMessage<T = unknown> {
  type: typeof WS_EVENTS[keyof typeof WS_EVENTS];
  payload: T;
}
