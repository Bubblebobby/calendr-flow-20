import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/**
 * Reusable auth + onboarding guard.
 *
 * Use this in `beforeLoad` of any top-level route that should only be
 * accessible to fully onboarded business users. Nested routes under
 * `/_authenticated` already inherit this check from the layout route.
 */
export async function requireOnboardedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect({ to: "/auth" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, business_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) throw redirect({ to: "/onboarding" });

  if (!profile.business_id) throw redirect({ to: "/business-setup" });

  const { data: business } = await supabase
    .from("businesses")
    .select("setup_step")
    .eq("id", profile.business_id)
    .maybeSingle();

  if (!business || (business.setup_step ?? 1) < 8) {
    throw redirect({ to: "/business-setup" });
  }

  return { user: data.user };
}
