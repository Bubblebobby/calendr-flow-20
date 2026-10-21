import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import type { CurrentBusiness } from "@/lib/use-business";

/**
 * Reusable auth + onboarding guard.
 *
 * Use this in `beforeLoad` of any top-level route that should only be
 * accessible to fully onboarded business users. Nested routes under
 * `/_authenticated` already inherit this check from the layout route.
 */

// beforeLoad re-runs on every navigation inside the authenticated shell.
// Re-checking onboarding over the network each time makes navigation feel
// sluggish, so the "fully onboarded" verdict is memoised per user.
const ONBOARDED_TTL_MS = 5 * 60_000;
let onboardedCache: { userId: string; at: number } | undefined;

export function clearOnboardingCache() {
  onboardedCache = undefined;
}

export async function requireOnboardedUser(opts?: { context?: { queryClient?: QueryClient } }) {
  // Local read from storage (no network round-trip); refreshes only when stale.
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw redirect({ to: "/auth" });

  if (
    onboardedCache &&
    onboardedCache.userId === user.id &&
    Date.now() - onboardedCache.at < ONBOARDED_TTL_MS
  ) {
    return { user };
  }

  // Profile and business in one request.
  const { data } = await supabase
    .from("profiles")
    .select(
      "onboarded_at, business_id, user_type, businesses(id, name, country, currency, timezone, setup_step)",
    )
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as {
    onboarded_at: string | null;
    business_id: string | null;
    user_type: string;
    businesses: (CurrentBusiness & { setup_step: number | null }) | null;
  } | null;

  // Customer logins belong on the customer side; one email is one class of account.
  if (profile?.user_type === "customer")
    throw redirect({ to: "/account-type", search: { expected: "business" } });

  if (!profile?.onboarded_at) throw redirect({ to: "/onboarding" });

  if (!profile.business_id) throw redirect({ to: "/business-setup" });

  const business = profile.businesses;
  if (!business || (business.setup_step ?? 1) < 8) {
    throw redirect({ to: "/business-setup" });
  }

  // Pages read the business through useBusiness(); hand it over so they don't fetch it again.
  const { setup_step: _setupStep, ...current } = business;
  opts?.context?.queryClient?.setQueryData<CurrentBusiness>(["current-business"], current);

  onboardedCache = { userId: user.id, at: Date.now() };
  return { user };
}
