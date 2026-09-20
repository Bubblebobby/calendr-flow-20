import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type CurrentBusiness = {
  id: string;
  name: string;
  country: string;
  currency: string;
  timezone: string | null;
};

/** The signed-in owner's business — the tenant root for every catalog read. */
export function useBusiness() {
  return useQuery({
    queryKey: ["current-business"],
    queryFn: async (): Promise<CurrentBusiness | null> => {
      // Local session read — avoids a network round-trip on every mount.
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) return null;

      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, country, currency, timezone")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
