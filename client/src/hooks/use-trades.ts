import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { queryClient } from '../lib/queryClient';
import { CardTrade } from '@shared/schema';
import { api } from '@shared/routes';

const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

export interface PendingTrade extends CardTrade {
  initiatorName?: string;
  initiatorAvatar?: string;
}

export function useTrades(userId: number | undefined) {
  return useQuery({
    queryKey: ['trades', 'pending', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(api.trades.pending.path.replace(':userId', String(userId)));
      if (!response.ok) throw new Error('Failed to fetch pending trades');
      return response.json() as Promise<CardTrade[]>;
    },
    enabled: !!userId,
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

export function useTradeHistory(userId: number | undefined) {
  return useQuery({
    queryKey: ['trades', 'history', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(api.trades.history.path.replace(':userId', String(userId)));
      if (!response.ok) throw new Error('Failed to fetch trade history');
      return response.json() as Promise<CardTrade[]>;
    },
    enabled: !!userId,
  });
}

export function useInitiateTrade(userId: number | undefined) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      recipientId: number;
      offeringCardIds: number[];
      message?: string;
    }) => {
      const response = await fetch(api.trades.propose.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiatorId: userId,
          ...data,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initiate trade');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Trade offer sent! Waiting for response...',
      });
      queryClient.invalidateQueries({ queryKey: ['trades', 'pending'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send trade',
        variant: 'destructive',
      });
    },
  });
}

export function useRespondToTrade(recipientId: number | undefined) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      tradeId: number;
      accept: boolean;
      offeringCardIds?: number[];
    }) => {
      const response = await fetch(api.trades.respond.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          ...data,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to respond to trade');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Success',
        description: variables.accept ? 'Trade accepted!' : 'Trade rejected',
      });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to respond',
        variant: 'destructive',
      });
    },
  });
}

export function UseCancelTrade(userId: number | undefined) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tradeId: number) => {
      const response = await fetch(api.trades.cancel.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId,
          userId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel trade');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Cancelled',
        description: 'Trade has been cancelled',
      });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel',
        variant: 'destructive',
      });
    },
  });
}
