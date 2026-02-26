import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useGachaStatus(userId: number | undefined) {
  return useQuery({
    queryKey: [api.gacha.status.path, userId],
    queryFn: async () => {
      if (!userId) throw new Error("No user ID");
      const url = buildUrl(api.gacha.status.path, { userId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      return api.gacha.status.responses[200].parse(data);
    },
    enabled: !!userId,
  });
}

export function usePullGacha() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: number) => {
      const input = api.gacha.pull.input.parse({ userId });
      const res = await fetch(api.gacha.pull.path, {
        method: api.gacha.pull.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 400) {
          throw new Error(data.message || "Validasi gagal");
        }
        throw new Error("Gagal menarik kartu");
      }
      
      return api.gacha.pull.responses[200].parse(data);
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: [api.gacha.status.path, userId] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.list.path, userId] });
    },
  });
}
