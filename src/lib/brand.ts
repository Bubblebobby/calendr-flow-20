import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/*
 * Salon branding: a brand colour (one of these presets) and an optional logo. The colour
 * replaces Bookly's black on buttons, highlights and focus rings — on the salon's client-facing
 * pages and in its own dashboard. Every preset keeps white text readable (WCAG AA, 4.5:1 or
 * better). Red, green and amber keep their meanings and never change.
 */

export const BRAND_PRESETS = [
  { key: "black", label: "Black", hex: "#101010" },
  { key: "navy", label: "Dark navy", hex: "#1b2a4a" },
  { key: "blue", label: "Royal blue", hex: "#1d4ed8" },
  { key: "purple", label: "Purple", hex: "#6d28d9" },
  { key: "plum", label: "Plum", hex: "#7a2860" },
  { key: "emerald", label: "Emerald", hex: "#047857" },
  { key: "teal", label: "Teal", hex: "#0f766e" },
  { key: "terracotta", label: "Terracotta", hex: "#a8462a" },
  { key: "rose", label: "Rose", hex: "#be123c" },
] as const;

export type BrandKey = (typeof BRAND_PRESETS)[number]["key"];

export function brandHex(key: string | null | undefined): string {
  return BRAND_PRESETS.find((preset) => preset.key === key)?.hex ?? BRAND_PRESETS[0].hex;
}

export const LOGO_BUCKET = "business-logos";

/** Public URL of a salon's logo (the bucket is public), or null. */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// The CSS variables a brand colour replaces. They're set on <html> so dialogs and menus, which
// render outside the page's wrapper, pick the colour up too.
const VARS = ["--primary", "--ink", "--ring"] as const;

/** Applies a brand colour to the whole document while the calling page is mounted. */
export function useApplyBrand(key: string | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (!key || key === "black") {
      VARS.forEach((name) => root.style.removeProperty(name));
      return;
    }
    const hex = brandHex(key);
    VARS.forEach((name) => root.style.setProperty(name, hex));
    return () => VARS.forEach((name) => root.style.removeProperty(name));
  }, [key]);
}

export type Branding = { brandColor: BrandKey; logoPath: string | null };

/**
 * The signed-in salon's branding. Loaded on its own (not with the business itself) and falling
 * back to Bookly's defaults on any error, so the dashboard never depends on these columns.
 */
export function useBranding(businessId: string | undefined) {
  return useQuery({
    queryKey: ["business-branding", businessId],
    enabled: Boolean(businessId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Branding> => {
      const { data, error } = await supabase
        .from("businesses")
        .select("brand_color, logo_path")
        .eq("id", businessId!)
        .maybeSingle();
      if (error || !data) return { brandColor: "black", logoPath: null };
      return {
        brandColor: (data.brand_color as BrandKey | null) ?? "black",
        logoPath: data.logo_path ?? null,
      };
    },
  });
}
