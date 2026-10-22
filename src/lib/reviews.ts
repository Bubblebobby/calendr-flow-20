import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";

/*
 * The salon's reviews: one per completed appointment, written by clients after their visit.
 * Used by Clients → Online reputation and the Reviews column on the client list.
 */

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  author_name: string;
  services: string | null;
  team_member_name: string | null;
  created_at: string;
  client_id: string | null;
};

export function useBusinessReviews() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["business-reviews", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          "id, rating, comment, author_name, services, team_member_name, created_at, appointments(client_id)",
        )
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const { appointments, ...review } = row as typeof row & {
          appointments: { client_id: string | null } | null;
        };
        return { ...review, client_id: appointments?.client_id ?? null };
      });
    },
  });
}

/** Average rating (one decimal) and count for a set of reviews. */
export function summarise(reviews: Review[]) {
  const count = reviews.length;
  const average = count ? reviews.reduce((total, r) => total + r.rating, 0) / count : 0;
  return { count, average: Math.round(average * 10) / 10 };
}
