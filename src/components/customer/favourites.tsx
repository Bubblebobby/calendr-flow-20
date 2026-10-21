import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { isCustomerAccount, useCustomer, useSessionUserId } from "@/lib/customer";
import { cn } from "@/lib/utils";

/** Ids of the salons the signed-in customer has saved. */
export function useFavourites() {
  // Keyed by the session, so it loads alongside the profile (business logins get none back).
  const sessionUser = useSessionUserId();
  return useQuery({
    queryKey: ["favourites", sessionUser.data ?? null],
    enabled: !!sessionUser.data,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("favorite_businesses")
        .select("business_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => row.business_id);
    },
  });
}

export function FavouriteButton({
  businessId,
  compact,
}: {
  businessId: string;
  compact?: boolean;
}) {
  const customer = useCustomer();
  const favourites = useFavourites();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const saved = (favourites.data ?? []).includes(businessId);

  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = saved
        ? await supabase.from("favorite_businesses").delete().eq("business_id", businessId)
        : await supabase.from("favorite_businesses").insert({ business_id: businessId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(saved ? "Removed from favourites" : "Saved to favourites");
      void queryClient.invalidateQueries({ queryKey: ["favourites"] });
    },
    onError: () => toast.error("Couldn't update your favourites"),
  });

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from favourites" : "Save to favourites"}
      aria-pressed={saved}
      disabled={toggle.isPending}
      onClick={() => {
        if (customer.data && !isCustomerAccount(customer.data)) {
          toast("Favourites are for customer accounts", {
            description: "You're signed in with a business account.",
          });
          return;
        }
        if (!customer.data) {
          void navigate({ to: "/sign-in", search: { next: window.location.pathname } });
          return;
        }
        toggle.mutate();
      }}
      className={cn(
        "flex items-center justify-center rounded-full border border-border bg-white hover:bg-secondary",
        compact ? "size-9" : "size-11",
      )}
    >
      <Heart
        size={compact ? 18 : 20}
        weight={saved ? "fill" : "regular"}
        className={saved ? "text-[#e5484d]" : ""}
      />
    </button>
  );
}
