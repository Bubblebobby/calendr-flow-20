import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type CurrentBusiness = {
  id: string;
  name: string;
  country: string;
  currency: string;
  timezone: string | null;
};

/**
 * The business the signed-in person works in (as owner or staff) — the tenant root for every
 * read. Comes from the profile's business link in one request; the guard primes this cache.
 */
export function useBusiness() {
  return useQuery({
    queryKey: ["current-business"],
    queryFn: async (): Promise<CurrentBusiness | null> => {
      // Local session read — avoids a network round-trip on every mount.
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) return null;
      return fetchCurrentBusiness(user.id);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchCurrentBusiness(userId: string): Promise<CurrentBusiness | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("businesses!profiles_business_id_fkey(id, name, country, currency, timezone)")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const linked = (data as { businesses: CurrentBusiness | null } | null)?.businesses ?? null;
  if (linked) return linked;

  // An owner whose profile isn't linked yet (e.g. part-way through setup).
  const { data: owned, error: ownedError } = await supabase
    .from("businesses")
    .select("id, name, country, currency, timezone")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownedError) throw ownedError;
  return owned;
}
