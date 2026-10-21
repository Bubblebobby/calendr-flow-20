import { cn } from "@/lib/utils";

/*
 * Shared styles for the marketing site. Layout, sections and interactions follow Square's
 * Appointments page (measured at 1440 wide); colours, type, buttons and card shapes follow the
 * Square DESIGN.md: black ink on white and cream (#f7f6f5), #707070 for muted text, blue only for
 * outlines and focus, black pill buttons, 50px cards, a mono uppercase eyebrow. Motion classes
 * (.site-*) live in styles.css.
 */

export const BLUE = "#006aff";

export const photo = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?w=${width}&q=80&auto=format&fit=crop`;

// Free Unsplash photos.
export const PHOTOS = {
  hero: "photo-1609535895148-cf9f5c446290",
  heroCheckout: "photo-1600334089648-b0d9d3028eb2",
  heroListing: "photo-1632828167055-126c0c57ecff",
  scheduling: "photo-1687422808328-11cf750a5051",
  payments: "photo-1694000682374-f6d5bf8be8a3",
  clients: "photo-1632828172055-942e6b7dd511",
  barber: "photo-1686671805337-7d8aa64b965f",
  hairSalon: "photo-1729005732908-de02acdeca5d",
  braids: "photo-1757866332992-723bf8d6169c",
  nails: "photo-1632765866070-3fadf25d3d5b",
  lashes: "photo-1772236617396-2f8460293c07",
  spa: "photo-1600334089648-b0d9d3028eb2",
  makeup: "photo-1655215081879-0ac1f535b575",
};

/**
 * Icons are Google's Material Symbols Sharp (Apache 2.0): square-cut corners and a heavy stroke,
 * the closest open set to Square's own icons. Only these glyphs are downloaded (see
 * routes/index.tsx), so add a name here before using it.
 */
export const SITE_ICONS = [
  "account_circle",
  "add",
  "arrow_back",
  "arrow_downward",
  "arrow_forward",
  "arrow_outward",
  "arrow_upward",
  "bar_chart",
  "call_split",
  "contact_page",
  "event_busy",
  "event_repeat",
  "group",
  "groups",
  "hourglass_top",
  "inventory_2",
  "keyboard_arrow_down",
  "language",
  "loyalty",
  "notifications",
  "payments",
  "point_of_sale",
  "policy",
  "qr_code_2",
  "redeem",
  "reviews",
  "sell",
  "share",
  "shopping_bag",
  "star",
  "storefront",
] as const;
export type SiteIcon = (typeof SITE_ICONS)[number];

export const ICON_FONT_URL = `https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=${[...SITE_ICONS].sort().join(",")}&display=block`;

export const wrap = "mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-[60px]";
export const serif = "font-display font-[450]";
// DESIGN.md eyebrow-mono: 14px / 500 / 1.4px tracking, uppercase, #707070.
export const eyebrow = "font-mono text-[14px] font-medium uppercase tracking-[1.4px]";
// Section headings: 44px on phones, display-xl (72px, -2.88px) on desktop.
export const bigHeading = cn(
  serif,
  "text-[44px] leading-[1.02] tracking-[-1.5px] lg:text-[72px] lg:leading-none lg:tracking-[-2.88px]",
);
// Feature-band headings: display-md (40px / 1.125 / -0.8px).
export const bandHeading = cn(
  serif,
  "text-[36px] leading-[1.125] tracking-[-0.6px] lg:text-[40px] lg:tracking-[-0.8px]",
);

/*
 * Buttons, as on Square: the pill's background is a pseudo-element that grows 5% on hover
 * (0.15s, cubic-bezier(0, 0, 0.2, 1)) while the label stays put, and the whole button dips 5%
 * when pressed.
 */
const pillBase =
  "relative isolate inline-flex h-[47px] items-center justify-center whitespace-nowrap rounded-full px-5 font-medium transition-transform duration-150 ease-[cubic-bezier(0,0,0.2,1)] active:translate-y-[5%] before:absolute before:inset-0 before:-z-10 before:rounded-full before:transition-[transform,background-color] before:duration-150 before:ease-[cubic-bezier(0,0,0.2,1)] motion-safe:hover:before:scale-105";
// button-primary: black fill, white 18px/500 label; pressed #1a1a1a.
export const pillSolid = cn(
  pillBase,
  "text-[18px] leading-[27px] text-white before:bg-black active:before:bg-[#1a1a1a]",
);
// button-secondary: white with a 1px Square Blue outline and blue 16px/500 label.
export const pillOutline = cn(
  pillBase,
  "text-base leading-6 text-[#006aff] before:border before:border-[#006aff] before:bg-white",
);
// button-on-dark: white fill, black label.
export const pillOnDark = cn(pillBase, "text-[18px] leading-[27px] text-black before:bg-white");
export const pillSmall = "h-10 px-4 text-[15px] leading-5";

// Square's text links: underlined, fading to 70% on hover.
export const textLink =
  "underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70";
// Plain links (nav, footer): fade to 70% on hover.
export const fadeLink = "transition-opacity duration-150 hover:opacity-70";
