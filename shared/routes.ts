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
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ username: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
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
        200: z.object({ remainingPulls: z.number() })
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
      path: '/api/active-cards' as const,
      responses: {
        200: z.array(z.custom<UserCardWithDetails>()),
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
} as const;

export interface WsMessage<T = unknown> {
  type: keyof typeof WS_EVENTS;
  payload: T;
}
