import { cn } from "@/lib/utils";

/*
 * Shared styles for the marketing site, sized from Square's Appointments page (measured at 1440
 * wide): 60px side margins, serif display headings over Inter, a mono eyebrow, 10px-rounded media
 * and blue pill buttons. Motion classes (.site-*) live in styles.css.
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

export const wrap = "mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-[60px]";
export const serif = "font-display font-[450]";
export const eyebrow = "font-mono text-[13px] uppercase tracking-[0.08em]";
// Section headings: 44px on phones, Square's 72px (-2.88px tracking) on desktop.
export const bigHeading = cn(
  serif,
  "text-[44px] leading-[1.02] tracking-[-1.5px] lg:text-[72px] lg:tracking-[-2.88px]",
);

const pillBase =
  "inline-flex h-[47px] items-center justify-center whitespace-nowrap rounded-full px-5 text-[18px] font-medium leading-[27px] transition-[background-color,color,box-shadow,transform] duration-200 ease-out motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97]";
export const pillSolid = cn(
  pillBase,
  "bg-[#006aff] text-white hover:bg-[#0055cc] hover:shadow-[0_8px_20px_-6px_rgba(0,106,255,0.55)]",
);
export const pillOutline = cn(
  pillBase,
  "border border-[#006aff] text-[#006aff] hover:bg-[#006aff] hover:text-white",
);
export const pillSmall = "h-10 px-4 text-[15px]";

// Hover: an underline that sweeps in from the left.
export const sweep =
  "bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat pb-0.5 transition-[background-size,color] duration-300 ease-out hover:bg-[length:100%_1px]";

// Photos drift in slightly when their card is hovered.
export const photoZoom =
  "transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-safe:group-hover:scale-[1.04]";
