import { useEffect } from "react";
import { redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";

export { safeNext } from "@/lib/safe-next";

/** The signed-in person's own details, used across the customer pages. */
export type CustomerProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  birthday: string | null;
  gender: string | null;
  email_reminders: boolean;
  marketing_emails: boolean;
};

export type MyAppointment = {
  id: string;
  status: string;
  cancellation_reason: string | null;
  manage_token: string;
  start: string;
  end: string;
  total: number;
  items: {
    service_id: string | null;
    name: string;
    price: number | null;
    minutes: number;
    with: string | null;
  }[];
  business: {
    id: string;
    name: string;
    slug: string | null;
    location: { address?: string; city?: string; district?: string } | null;
    categories: string[] | null;
    currency: string;
    country: string;
    timezone: string;
    policy: string | null;
    notice_hours: number | null;
    allow_cancel: boolean | null;
    allow_reschedule: boolean | null;
  };
  review: { rating: number; comment: string | null } | null;
};

export type VenueCard = {
  id: string;
  name: string;
  slug: string;
  categories: string[] | null;
  city: string | null;
  area: string | null;
  description: string | null;
  currency: string;
  country: string;
  rating: number | null;
  review_count: number;
  from_price: number | null;
};

/** Route guard for the customer area: signed-out visitors go to sign-in and come back. */
export async function requireCustomer({ location }: { location: { href: string } }) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/sign-in", search: { next: location.href } });
  return { user: data.session.user };
}

/** Session + profile of whoever is signed in (null when signed out). Refreshes on sign-in/out. */
export function useCustomer() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void queryClient.invalidateQueries({ queryKey: ["customer"] });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return useQuery({
    queryKey: ["customer"],
    staleTime: 60_000,
    queryFn: async (): Promise<CustomerProfile | null> => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      const row = (profile ?? {}) as Partial<CustomerProfile>;
      return {
        id: user.id,
        email: user.email ?? "",
        full_name: row.full_name ?? null,
        phone: row.phone ?? null,
        birthday: row.birthday ?? null,
        gender: row.gender ?? null,
        email_reminders: row.email_reminders ?? true,
        marketing_emails: row.marketing_emails ?? false,
      };
    },
  });
}

export function splitName(full: string | null | undefined) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function initialsOf(name: string | null | undefined, fallback = "?") {
  const { first, last } = splitName(name);
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || fallback;
}

const CATEGORY_LABEL = new Map(BUSINESS_CATEGORIES.map((c) => [c.id, c.label]));
export const categoryLabel = (id: string) => CATEGORY_LABEL.get(id) ?? id;
export const DISCOVER_CATEGORIES = BUSINESS_CATEGORIES.filter((c) => c.id !== "other");

/** Appointment buckets the way the Activity page shows them. */
export const UPCOMING_STATUSES = ["booked", "confirmed", "arrived", "started"];
export const isUpcoming = (a: MyAppointment, now = Date.now()) =>
  UPCOMING_STATUSES.includes(a.status) && new Date(a.end).getTime() > now;

export const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  booked: { label: "Booked", tone: "bg-accent text-primary" },
  confirmed: { label: "Confirmed", tone: "bg-[#e6f6ea] text-[#1f8a3e]" },
  arrived: { label: "Checked in", tone: "bg-[#e6f6ea] text-[#1f8a3e]" },
  started: { label: "In progress", tone: "bg-[#e6f6ea] text-[#1f8a3e]" },
  completed: { label: "Completed", tone: "bg-secondary text-foreground" },
  no_show: { label: "No show", tone: "bg-[#fdecef] text-destructive" },
  cancelled: { label: "Cancelled", tone: "bg-[#fdecef] text-destructive" },
};

/** "Book again" link: same services (and professional, if there was only one). */
export function bookAgainHref(a: MyAppointment) {
  if (!a.business.slug) return null;
  const services = [...new Set(a.items.map((i) => i.service_id).filter(Boolean))].join(",");
  return `/book/${a.business.slug}${services ? `?services=${services}` : ""}`;
}

export function formatInZone(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(new Date(iso));
}

// ── Recently viewed salons (this browser only) ──
const RECENT_KEY = "bookly.recentSalons";
export function readRecent(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
export function rememberRecent(businessId: string) {
  try {
    const next = [businessId, ...readRecent().filter((id) => id !== businessId)].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode): recently viewed just stays empty.
  }
}

/** Loads public salon cards, optionally for a fixed set of ids (favourites, recently viewed). */
export async function fetchVenues(args: {
  q?: string | undefined;
  category?: string | undefined;
  city?: string | undefined;
  ids?: string[] | undefined;
}) {
  const { data, error } = await supabase.rpc("discover_businesses", {
    p_query: args.q || null,
    p_category: args.category || null,
    p_city: args.city || null,
    p_ids: args.ids ?? null,
  });
  if (error) throw error;
  return (data ?? []) as unknown as VenueCard[];
}

export function useMyAppointments(enabled = true) {
  return useQuery({
    queryKey: ["my-appointments"],
    enabled,
    queryFn: async (): Promise<MyAppointment[]> => {
      const { data, error } = await supabase.rpc("my_appointments");
      if (error) throw error;
      return (data ?? []) as unknown as MyAppointment[];
    },
  });
}
