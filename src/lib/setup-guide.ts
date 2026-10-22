import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";

/*
 * The setup guide (like Square's "Set up your business"): the steps a new salon needs before it
 * can take bookings, each ticked off automatically from the salon's own data. Shown to owners
 * and admins only (staff can't see services, clients or the team), and gone once all are done.
 */

export type SetupStepKey = "services" | "team" | "booking" | "clients" | "appointment" | "sale";

export type SetupStep = {
  key: SetupStepKey;
  title: string;
  text: string;
  action: string;
  to: string;
  search?: Record<string, string>;
};

export const SETUP_STEPS: SetupStep[] = [
  {
    key: "services",
    title: "Add your services",
    text: "Add what you offer, with prices and how long each one takes.",
    action: "Add services",
    to: "/catalog",
    search: { tab: "services" },
  },
  {
    key: "team",
    title: "Add your team",
    text: "Add yourself and everyone who takes bookings, so clients can choose who they see.",
    action: "Add team members",
    to: "/team",
    search: { tab: "members" },
  },
  {
    key: "booking",
    title: "Turn on online booking",
    text: "Set up your booking page so clients can book themselves at any time.",
    action: "Set up booking page",
    to: "/online-booking",
    search: { tab: "profile" },
  },
  {
    key: "clients",
    title: "Add your clients",
    text: "Add the clients you already have, so their visits and notes are in one place.",
    action: "Add a client",
    to: "/clients",
    search: { tab: "list" },
  },
  {
    key: "appointment",
    title: "Book your first appointment",
    text: "Put an appointment in the calendar to see how your day looks.",
    action: "Open calendar",
    to: "/calendar",
  },
  {
    key: "sale",
    title: "Check out your first sale",
    text: "Ring up a service or product to see how checkout and receipts work.",
    action: "Go to checkout",
    to: "/sales",
    search: { tab: "register" },
  },
];

type Done = Record<SetupStepKey, boolean>;

/** True when the query found at least one row. */
async function hasAny(query: PromiseLike<{ data: unknown[] | null; error: unknown }>) {
  const { data, error } = await query;
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function fetchSetup(businessId: string): Promise<{ isAdmin: boolean; done: Done }> {
  const [admin, services, team, business, clients, appointment, sale] = await Promise.all([
    supabase.rpc("is_business_admin", { p_business: businessId }),
    hasAny(
      supabase
        .from("services")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_archived", false)
        .limit(1),
    ),
    hasAny(
      supabase
        .from("team_members")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .limit(1),
    ),
    supabase
      .from("businesses")
      .select("online_booking_enabled, booking_slug")
      .eq("id", businessId)
      .maybeSingle(),
    hasAny(supabase.from("clients").select("id").eq("business_id", businessId).limit(1)),
    hasAny(supabase.from("appointments").select("id").eq("business_id", businessId).limit(1)),
    hasAny(
      supabase
        .from("sales")
        .select("id")
        .eq("business_id", businessId)
        .neq("status", "draft")
        .limit(1),
    ),
  ]);
  if (admin.error) throw admin.error;
  if (business.error) throw business.error;
  return {
    isAdmin: admin.data === true,
    done: {
      services,
      team,
      booking: Boolean(business.data?.online_booking_enabled && business.data.booking_slug),
      clients,
      appointment,
      sale,
    },
  };
}

// Steps someone chose to dismiss (as on Square), remembered on this device.
function useDismissed(businessId: string | undefined) {
  const key = businessId ? `bookly.setup.dismissed.${businessId}` : null;
  const [dismissed, setDismissed] = useState<SetupStepKey[]>([]);
  useEffect(() => {
    if (!key) return;
    try {
      setDismissed(JSON.parse(window.localStorage.getItem(key) ?? "[]") as SetupStepKey[]);
    } catch {
      setDismissed([]);
    }
  }, [key]);
  const dismiss = useCallback(
    (step: SetupStepKey) => {
      setDismissed((current) => {
        const next = current.includes(step) ? current : [...current, step];
        try {
          if (key) window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage unavailable (private mode): the dismissal lasts until reload.
        }
        return next;
      });
    },
    [key],
  );
  return { dismissed, dismiss };
}

export type SetupItem = SetupStep & { done: boolean; dismissed: boolean };

export function useSetupGuide() {
  const { data: business } = useBusiness();
  const query = useQuery({
    queryKey: ["setup-guide", business?.id],
    queryFn: () => fetchSetup(business!.id),
    enabled: Boolean(business?.id),
    staleTime: 30 * 1000,
  });
  const { dismissed, dismiss } = useDismissed(business?.id);

  const items: SetupItem[] = SETUP_STEPS.map((step) => ({
    ...step,
    done: query.data?.done[step.key] ?? false,
    dismissed: dismissed.includes(step.key),
  }));
  const completed = items.filter((item) => item.done || item.dismissed).length;
  const remaining = items.filter((item) => !item.done && !item.dismissed);

  return {
    ready: query.isSuccess,
    // Only owners and admins set the business up, and the guide goes once everything's done.
    visible: query.isSuccess && query.data.isAdmin && remaining.length > 0,
    items,
    remaining,
    completed,
    total: items.length,
    percent: Math.round((completed / items.length) * 100),
    dismiss,
  };
}
