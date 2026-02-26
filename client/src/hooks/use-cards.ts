import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useInventory(userId: number | undefined) {
  return useQuery({
    queryKey: [api.inventory.list.path, userId],
    queryFn: async () => {
      if (!userId) throw new Error("No user ID");
      const url = buildUrl(api.inventory.list.path, { userId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch inventory");
      const data = await res.json();
      return api.inventory.list.responses[200].parse(data);
    },
    enabled: !!userId,
  });
}

export function useActiveCards() {
  return useQuery({
    queryKey: [api.activeCards.list.path],
    queryFn: async () => {
      const res = await fetch(api.activeCards.list.path);
      if (!res.ok) throw new Error("Failed to fetch active cards");
      const data = await res.json();
      return api.activeCards.list.responses[200].parse(data);
    },
    refetchInterval: 60000, // Refresh every minute just in case
  });
}

export function useUseCard() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userCardId: number) => {
      const input = api.inventory.use.input.parse({ userCardId });
      const res = await fetch(api.inventory.use.path, {
        method: api.inventory.use.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to use card");
      }
      
      return api.inventory.use.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.inventory.list.path, data.userId] });
      queryClient.invalidateQueries({ queryKey: [api.activeCards.list.path] });
    },
  });
}
