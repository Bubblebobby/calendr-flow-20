import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/*
 * Each person's Home layout: which cards show, in what order, and whether each spans the full
 * width. Saved per person in dashboard_layouts so it follows them to any device. On any error
 * (e.g. the table isn't there yet) Home falls back to the default layout.
 */

export const DASHBOARD_CARDS = [
  { id: "sales", title: "Recent sales" },
  { id: "upcoming", title: "Upcoming appointments" },
  { id: "activity", title: "Appointments activity" },
  { id: "today", title: "Today's next appointments" },
  { id: "services", title: "Top services" },
  { id: "team", title: "Top team member" },
] as const;

export type DashboardCardId = (typeof DASHBOARD_CARDS)[number]["id"];
export type LayoutItem = { id: DashboardCardId; hidden: boolean; wide: boolean };

export const DEFAULT_LAYOUT: LayoutItem[] = DASHBOARD_CARDS.map((card) => ({
  id: card.id,
  hidden: false,
  wide: false,
}));

const KNOWN = new Set<string>(DASHBOARD_CARDS.map((card) => card.id));

/** Keeps the saved order, drops cards that no longer exist, and adds new cards at the end. */
export function normalizeLayout(saved: unknown): LayoutItem[] {
  const items: LayoutItem[] = [];
  if (Array.isArray(saved)) {
    for (const entry of saved) {
      const id = (entry as { id?: unknown })?.id;
      if (typeof id !== "string" || !KNOWN.has(id) || items.some((item) => item.id === id))
        continue;
      items.push({
        id: id as DashboardCardId,
        hidden: Boolean((entry as { hidden?: unknown }).hidden),
        wide: Boolean((entry as { wide?: unknown }).wide),
      });
    }
  }
  for (const card of DEFAULT_LAYOUT)
    if (!items.some((item) => item.id === card.id)) items.push(card);
  return items;
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export function useDashboardLayout() {
  const queryClient = useQueryClient();
  const key = ["dashboard-layout"];

  const query = useQuery({
    queryKey: key,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LayoutItem[]> => {
      const userId = await currentUserId();
      if (!userId) return DEFAULT_LAYOUT;
      const { data, error } = await supabase
        .from("dashboard_layouts")
        .select("layout")
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return DEFAULT_LAYOUT;
      return normalizeLayout(data.layout);
    },
  });

  const save = useMutation({
    mutationFn: async (layout: LayoutItem[]) => {
      const userId = await currentUserId();
      if (!userId) throw new Error("Sign in again to save your layout.");
      const { error } = await supabase
        .from("dashboard_layouts")
        .upsert({ user_id: userId, layout, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onMutate: (layout) => queryClient.setQueryData(key, layout),
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const userId = await currentUserId();
      if (!userId) return;
      const { error } = await supabase.from("dashboard_layouts").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onMutate: () => queryClient.setQueryData(key, DEFAULT_LAYOUT),
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { layout: query.data ?? DEFAULT_LAYOUT, save, reset };
}
