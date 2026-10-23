import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** For the Automations page: is email connected, and when did the scheduler last run? */
export const getAutomationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { brevoConfigured } = await import("@/lib/brevo.server");
    const { lastAutomationRun } = await import("@/lib/automations.server");
    return { email: brevoConfigured(), lastRun: await lastAutomationRun().catch(() => null) };
  });
