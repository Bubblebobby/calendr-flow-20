import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type BusinessHour = {
  id?: string;
  business_id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
};

/** 0 = Sunday, matching Date#getDay() and the day_of_week column. */
export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DEFAULT_OPEN = "09:00";
export const DEFAULT_CLOSE = "18:00";

/** Mon–Sat 9:00–18:00, Sunday closed. Used until the owner saves their own. */
export function defaultHours(businessId: string): BusinessHour[] {
  return DAY_LABELS.map((_, day) => ({
    business_id: businessId,
    day_of_week: day,
    is_open: day !== 0,
    open_time: DEFAULT_OPEN,
    close_time: DEFAULT_CLOSE,
  }));
}

/** "09:00:00" | "09:00" -> minutes since midnight. */
export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  const hours = Number(h);
  const minutes = Number(m ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Normalises a DB time value to the "HH:MM" shape the inputs expect. */
export function toInputTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export function useBusinessHours(businessId: string | undefined) {
  return useQuery({
    queryKey: ["business-hours", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<BusinessHour[]> => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("id, business_id, day_of_week, is_open, open_time, close_time")
        .eq("business_id", businessId!)
        .order("day_of_week", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return defaultHours(businessId!);

      // Fill any missing days so callers always get all seven.
      const byDay = new Map(data.map((row) => [row.day_of_week, row as BusinessHour]));
      return defaultHours(businessId!).map((fallback) => byDay.get(fallback.day_of_week) ?? fallback);
    },
    staleTime: 5 * 60 * 1000,
  });
}
