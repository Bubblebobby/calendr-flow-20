import { cn } from "@/lib/utils";

/*
 * Styles for the second homepage (/v2), following Stripe's homepage (measured at 1440 wide) and
 * the Stripe DESIGN.md. Where the two differ the live site wins: buttons have 4px corners, not
 * pills. Thin (300) Inter stands in for Sohne, with the single-storey "a" (cv11).
 */

export const INDIGO = "#533afd";
export const INK = "#061b31";
export const MUTED = "#64748d";
export const NAVY = "#0d1738";
export const HAIRLINE = "#e5edf5";
export const SOFT = "#f8fafd";

// Stripe frames the page with 1px guide lines 1266px apart; content sits 120px inside them.
export const frame = "mx-auto w-full max-w-[1266px] border-x border-[#e5edf5]";
export const inner = "px-5 sm:px-10 lg:px-[120px]";

// Display type: 300 weight with negative tracking (DESIGN.md display tiers).
export const h1Class =
  "text-[36px] font-light leading-[1.12] tracking-[-0.72px] sm:text-[48px] sm:leading-[1.15] sm:tracking-[-0.96px]";
export const h2Class =
  "text-[26px] font-light leading-[1.15] tracking-[-0.4px] sm:text-[32px] sm:leading-[1.1] sm:tracking-[-0.64px]";
export const h3Class =
  "text-[22px] font-light leading-[1.15] tracking-[-0.22px] sm:text-[26px] sm:tracking-[-0.26px]";
export const bodyClass = "text-[16px] font-light leading-[1.4]";

// Buttons: 4px corners, 16px/400 labels, indigo fill for the one primary per band.
const buttonBase =
  "group inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] font-normal transition-[background-color,border-color,color] duration-150";
export const buttonPrimary = cn(
  buttonBase,
  "h-12 px-5 text-base bg-[#533afd] text-white hover:bg-[#4434d4] active:bg-[#2e2b8c]",
);
export const buttonSecondary = cn(
  buttonBase,
  "h-12 px-5 text-base border border-[#b9b9f9] bg-white/65 text-[#533afd] hover:border-[#533afd]",
);
export const buttonSmall = "h-10 px-4 text-[14px]";
// Indigo text link with the hover arrow.
export const linkClass =
  "group inline-flex items-center gap-1 text-[#533afd] transition-colors hover:text-[#061b31]";
