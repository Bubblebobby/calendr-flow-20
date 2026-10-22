import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import {
  CalendarMock,
  CheckoutMock,
  ClientMock,
  DeviceMock,
  GiftCardMock,
  ListingMock,
  MembershipMock,
  PayMock,
  ReportsMock,
  ReviewMock,
  StockMock,
  TeamMock,
  type Device,
} from "./site-mocks";
import {
  PHOTOS,
  bandHeading,
  bigHeading,
  eyebrow,
  fadeLink,
  photo,
  pillOutline,
  pillSmall,
  pillSolid,
  serif,
  textLink,
  wrap,
  type SiteIcon,
} from "./site-styles";
import { ArrowLink, Icon, Logo, RoundButton, Words } from "./site-ui";

/*
 * Bookly's marketing homepage, following the sections of Square's Appointments page in order:
 * header with a sticky product bar (and a Features menu), hero with rotating product scenes,
 * "Explore solutions" jump links, four feature bands, a card slider, business types, devices,
 * pricing with a custom-pricing band, FAQ, closing call to action and footer. On phones a bar
 * with the two main buttons stays at the bottom of the screen once the hero is passed.
 *
 * Interactions are Square's: buttons whose pill grows 5% on hover and dips 5% when pressed,
 * links that fade to 70%, arrow links that nudge, a blue focus ring. Visual tokens come from the
 * Square DESIGN.md (see site-styles.ts).
 *
 * Every feature named here exists in the app. Don't add claims (reminders, deposits, client
 * import...) until they ship.
 */

export function HomePage() {
  return (
    <div className="site-home min-h-screen bg-white pb-[72px] font-sans text-black antialiased xl:pb-0">
      <SiteHeader />
      <main>
        <Hero />
        <ExploreSolutions />
        {FEATURE_SECTIONS.map((section) => (
          <FeatureSection key={section.id} {...section} />
        ))}
        <ManageSlider />
        <BusinessTypes />
        <Devices />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
      <BottomCtaBar />
    </div>
  );
}

// ── Header ──

const FEATURE_LINKS = [
  ["Online booking page", "#appointments"],
  ["Team calendars and shifts", "#appointments"],
  ["Booking links and QR codes", "#appointments"],
  ["Checkout and split payments", "#payments"],
  ["Gift cards, packages and memberships", "#payments"],
  ["Client profiles", "#clients"],
  ["Cancellation policy", "#clients"],
  ["Bookly marketplace", "#growth"],
  ["Promotions", "#growth"],
  ["Team pay and commission", "#manage"],
  ["Stock and suppliers", "#manage"],
  ["Reports", "#manage"],
] as const;

const SECTIONS = [
  ["Overview", "#top"],
  ["Appointments", "#appointments"],
  ["Payments", "#payments"],
  ["Clients", "#clients"],
  ["Growth", "#growth"],
  ["Business types", "#business-types"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
] as const;

/** Closes a menu on Escape or a click outside it. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);
  return ref;
}

// Top bar links (DESIGN.md nav-link): black, turning Square Blue on hover.
const topLink = "transition-colors duration-150 hover:text-[#006aff]";
// Sticky bar links (as on Square): grey, darkening on hover.
const subLink = "text-[#707070] transition-colors duration-150 hover:text-[#1a1a1a]";

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const menuRef = useDismiss(menuOpen, () => setMenuOpen(false));
  const featuresRef = useDismiss(featuresOpen, () => setFeaturesOpen(false));
  return (
    <>
      <div className="border-b border-[#f2f2f2]">
        <div className={cn(wrap, "flex h-[72px] items-center justify-between gap-3 sm:gap-6")}>
          <div className="flex items-center gap-10">
            <Logo />
            <nav className="hidden items-center gap-7 text-base font-medium lg:flex">
              <a href="#business-types" className={topLink}>
                Business types
              </a>
              <a href="#appointments" className={topLink}>
                Features
              </a>
              <a href="#pricing" className={topLink}>
                Pricing
              </a>
              <Link to="/discover" className={topLink}>
                Find a salon
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-6 text-base font-medium">
            <Link to="/sign-in" className={cn(topLink, "hidden md:inline")}>
              Book an appointment
            </Link>
            <Link to="/auth" className={cn(topLink, "py-3")}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
      <div
        ref={menuRef}
        className="sticky top-0 z-40 border-b border-[#f2f2f2] bg-white/95 backdrop-blur"
      >
        <div className={cn(wrap, "flex h-[72px] items-center justify-between gap-3 sm:gap-6")}>
          <span className="hidden text-[18px] font-medium xl:inline">Bookly for salons</span>
          {/* Below desktop the section links fold into this menu, like Square's. */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="-ml-2 flex h-11 items-center gap-1 whitespace-nowrap rounded-full px-2 text-base font-medium sm:text-[17px] lg:text-[18px] xl:hidden"
          >
            Bookly for salons
            <Icon
              name="keyboard_arrow_down"
              size={20}
              className={cn("transition-transform duration-200", menuOpen && "rotate-180")}
            />
          </button>

          {/* Desktop: links sit on the right next to the buttons, as on Square. */}
          <div className="flex items-center gap-7">
            <nav className="hidden items-center gap-7 text-[15px] font-medium xl:flex">
              <a href="#top" className="text-black">
                Overview
              </a>
              <div ref={featuresRef} className="relative">
                <button
                  type="button"
                  aria-expanded={featuresOpen}
                  aria-controls="site-features"
                  onClick={() => setFeaturesOpen((open) => !open)}
                  className={cn(subLink, "flex items-center gap-0.5", featuresOpen && "text-black")}
                >
                  Features
                  <Icon
                    name="keyboard_arrow_down"
                    size={18}
                    className={cn(
                      "transition-transform duration-200",
                      featuresOpen && "rotate-180",
                    )}
                  />
                </button>
                <ul
                  id="site-features"
                  hidden={!featuresOpen}
                  className="absolute left-1/2 top-[calc(100%+18px)] w-[300px] -translate-x-1/2 rounded-[20px] bg-white px-3 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.32)]"
                >
                  {FEATURE_LINKS.map(([label, href]) => (
                    <li key={label}>
                      <a
                        href={href}
                        onClick={() => setFeaturesOpen(false)}
                        className={cn(fadeLink, "block px-3 py-1.5 text-base font-medium")}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <a href="#business-types" className={subLink}>
                Business types
              </a>
              <a href="#pricing" className={subLink}>
                Pricing
              </a>
            </nav>
            {/* Below 1280 these move to the bottom bar, as on Square. */}
            <div className="hidden items-center gap-3 xl:flex">
              <a href="#pricing" className={cn(pillOutline, pillSmall)}>
                See pricing
              </a>
              <Link to="/auth" className={cn(pillSolid, pillSmall)}>
                Get started
              </Link>
            </div>
          </div>
        </div>
        <nav
          id="site-menu"
          hidden={!menuOpen}
          className="absolute inset-x-0 top-full max-h-[calc(100svh-72px)] overflow-y-auto border-b border-[#f2f2f2] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.32)] xl:hidden"
        >
          <ul className={cn(wrap, "py-2")}>
            {SECTIONS.map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex h-12 items-center border-b border-[#f2f2f2] text-base font-medium"
                >
                  {label}
                </a>
              </li>
            ))}
            <li>
              <Link
                to="/discover"
                className="flex h-12 items-center border-b border-[#f2f2f2] text-base font-medium"
              >
                Find a salon
              </Link>
            </li>
            <li>
              <Link to="/sign-in" className="flex h-12 items-center text-base font-medium">
                Book an appointment
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}

// ── Hero ──

// The hero picture cycles through these, like Square's hero video.
const HERO_SCENES = [
  { image: PHOTOS.hero, alt: "A client relaxing after a treatment", mock: <CalendarMock /> },
  { image: PHOTOS.heroCheckout, alt: "A calm spa treatment room", mock: <CheckoutMock /> },
  { image: PHOTOS.heroListing, alt: "A smiling client", mock: <ListingMock /> },
];

function Hero() {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setScene((s) => (s + 1) % HERO_SCENES.length), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section id="top" className={cn(wrap, "pt-12 lg:pt-10 lg:text-center xl:pt-16 xl:text-left")}>
      <p className={cn(eyebrow, "site-fade-load text-[#707070]")}>Appointments</p>
      <h1
        className={cn(
          serif,
          "mt-[17.5px] max-w-[1000px] text-[44px] leading-[1.05] tracking-[-0.5px] sm:text-[56px] lg:mx-auto lg:leading-none lg:tracking-[-2.24px] xl:mx-0 xl:text-[72px] xl:tracking-[-2.88px]",
        )}
      >
        <Words text="Booking software that keeps your chairs full" onLoad />
      </h1>
      <p
        className="site-fade-load mt-5 max-w-[620px] text-[18px] font-medium leading-[27px] lg:mx-auto xl:mx-0"
        style={{ animationDelay: "450ms" }}
      >
        Bookly brings online booking, your calendar, checkout, clients and your team together —
        built for salons, barbers, spas and studios.
      </p>
      <div
        className="site-fade-load mt-8 flex flex-wrap gap-3 lg:justify-center xl:justify-start"
        style={{ animationDelay: "600ms" }}
      >
        <a href="#pricing" className={pillOutline}>
          See pricing
        </a>
        <Link to="/auth" className={pillSolid}>
          Get started free
        </Link>
      </div>

      <div className="relative mt-12 aspect-[4/5] overflow-hidden rounded-[10px] bg-[#f7f6f5] sm:aspect-[16/9] lg:mt-20 xl:mt-16 xl:aspect-[1320/680]">
        {HERO_SCENES.map((item, index) => (
          <div
            key={item.image}
            aria-hidden={index !== scene}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-in-out",
              index === scene ? "opacity-100" : "opacity-0",
            )}
          >
            <img
              src={photo(item.image, 2000)}
              alt={item.alt}
              className="size-full object-cover"
              fetchPriority={index === 0 ? "high" : undefined}
              loading={index === 0 ? undefined : "lazy"}
            />
            <div className="absolute inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-10 sm:right-10 sm:w-[min(560px,60%)]">
              {item.mock}
            </div>
          </div>
        ))}
        <div className="absolute bottom-4 left-4 hidden gap-1.5 sm:bottom-10 sm:left-10 sm:flex">
          {HERO_SCENES.map((item, index) => (
            <button
              key={item.image}
              type="button"
              aria-label={`Show picture ${index + 1}`}
              aria-current={index === scene}
              onClick={() => setScene(index)}
              className="flex h-6 items-center"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full bg-white transition-[width,opacity] duration-300",
                  index === scene ? "w-6 opacity-100" : "w-1.5 opacity-60",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── "Explore solutions" jump links ──

function ExploreSolutions() {
  return (
    <nav
      aria-label="Explore solutions"
      className={cn(
        wrap,
        "mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <p className="text-[14px] font-medium">Explore solutions</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {[
          ["Appointments", "#appointments"],
          ["Payments", "#payments"],
          ["Clients", "#clients"],
          ["Growth", "#growth"],
        ].map(([label, href]) => (
          <li key={href}>
            <a
              href={href}
              className={cn(eyebrow, fadeLink, "flex min-h-11 items-center gap-1 text-black")}
            >
              {label}
              <Icon name="arrow_downward" size={16} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Feature bands ──

type Feature = {
  icon: SiteIcon;
  title: string;
  text: string;
  link?: { label: string; href: string };
};

type FeatureSectionProps = {
  id: string;
  label: string;
  title: string;
  text?: string;
  image?: string;
  mock?: ReactNode;
  columns: 3 | 4;
  features: Feature[];
};

const FEATURE_SECTIONS: FeatureSectionProps[] = [
  {
    id: "appointments",
    label: "Appointments",
    title: "Say goodbye to double bookings",
    text: "One calendar for the whole salon. Clients book themselves online at any hour, and Bookly keeps every stylist's hours, breaks and days off in order.",
    image: PHOTOS.scheduling,
    mock: <CalendarMock compact />,
    columns: 3,
    features: [
      {
        icon: "language",
        title: "Create a free booking page",
        text: "Give clients a page with your services, prices and team where they can book you 24/7.",
      },
      {
        icon: "group",
        title: "Add your whole team",
        text: "Every team member gets their own calendar and shifts, and clients can choose who they book with.",
      },
      {
        icon: "event_busy",
        title: "Block out breaks and closures",
        text: "Lunch, days off and holidays are blocked, so clients only see times you can really take.",
      },
      {
        icon: "qr_code_2",
        title: "Share links and QR codes",
        text: "Make a booking link or QR code for any service to share online or print for the front desk.",
      },
      {
        icon: "hourglass_top",
        title: "Keep a waitlist",
        text: "Note who's waiting for a slot, so you can fill the gap when someone cancels.",
      },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    title: "Get paid for every appointment",
    text: "Check clients out in seconds at the desk, with every sale, tip and payment recorded in one place.",
    image: PHOTOS.payments,
    mock: <CheckoutMock />,
    columns: 4,
    features: [
      {
        icon: "point_of_sale",
        title: "Fast checkout",
        text: "Ring up services, products and tips on one sale, straight from the appointment.",
      },
      {
        icon: "call_split",
        title: "Split payments",
        text: "Let clients pay part cash, part card or transfer, all recorded on the same sale.",
      },
      {
        icon: "redeem",
        title: "Sell gift cards",
        text: "Sell gift cards at the desk and take them as payment at checkout.",
      },
      {
        icon: "inventory_2",
        title: "Packages and memberships",
        text: "Sell bundles of sessions and memberships that clients use up visit by visit.",
      },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    title: "Keep clients coming back",
    text: "Everything you know about a client in one place, and an easy way for them to change plans without calling you.",
    image: PHOTOS.clients,
    mock: <ClientMock />,
    columns: 3,
    features: [
      {
        icon: "contact_page",
        title: "Client profiles",
        text: "Contact details, notes, visit history and spend on every client's card.",
      },
      {
        icon: "event_repeat",
        title: "Changes without the phone calls",
        text: "Clients can cancel or reschedule from their booking link, within the rules you set.",
      },
      {
        icon: "policy",
        title: "Set a cancellation policy",
        text: "Decide how close to an appointment clients can cancel or move it, and show it when they book.",
      },
      {
        icon: "account_circle",
        title: "Client accounts",
        text: "Clients can make a free account to see their bookings, save favourite salons and book again.",
      },
      {
        icon: "star",
        title: "Reviews",
        text: "Clients can review their visit, and good reviews help the next person choose you.",
      },
      {
        icon: "notifications",
        title: "New booking alerts",
        text: "Get notified in Bookly the moment a new online booking comes in.",
      },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    title: "Find new clients in new ways",
    columns: 4,
    features: [
      {
        icon: "storefront",
        title: "Join the Bookly marketplace",
        text: "Get found by people nearby who are looking for a salon, and booked straight into your calendar.",
        link: { label: "Explore the marketplace", href: "/discover" },
      },
      {
        icon: "share",
        title: "Get booked from social",
        text: "Put your booking link in your Instagram bio and WhatsApp status so followers can book in a tap.",
      },
      {
        icon: "sell",
        title: "Run promotions",
        text: "Create promo codes and offers to fill quiet days and bring regulars back.",
      },
      {
        icon: "shopping_bag",
        title: "Sell products too",
        text: "Ring up retail products alongside services and keep track of your stock.",
      },
    ],
  },
];

function FeatureSection({
  id,
  label,
  title,
  text,
  image,
  mock,
  columns,
  features,
}: FeatureSectionProps) {
  const heading = (
    <>
      <p className={cn(eyebrow, "site-fade pb-[17.5px] text-[#707070]")}>{label}</p>
      <h2 className={bandHeading}>
        <Words text={title} />
      </h2>
    </>
  );
  return (
    <section id={id} className={cn(wrap, "scroll-mt-24 pt-24 xl:pt-[120px]")}>
      {image ? (
        // Text on the left, picture on the right (Square keeps this order for every band).
        <div className="grid items-center gap-10 lg:grid-cols-[325px_1fr] lg:gap-5 xl:grid-cols-[433px_1fr]">
          <div className="xl:pr-10">
            {heading}
            {text ? <p className="site-fade mt-5 text-base leading-6">{text}</p> : null}
            <ArrowLink className="site-fade mt-3">Get started</ArrowLink>
          </div>
          <div className="site-reveal relative overflow-hidden rounded-[10px] bg-[#f7f6f5]">
            <img
              src={photo(image, 1400)}
              alt=""
              loading="lazy"
              className="aspect-[4/3] w-full object-cover lg:aspect-[3/2]"
            />
            {mock ? (
              <div className="absolute bottom-4 hidden sm:bottom-8 sm:right-8 sm:block sm:w-[340px]">
                {mock}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        heading
      )}

      <div
        className={cn(
          "site-reveal mt-14 grid gap-x-5 gap-y-10 sm:grid-cols-2",
          columns === 4
            ? image
              ? "lg:grid-cols-4"
              : "lg:grid-cols-2 xl:grid-cols-4"
            : "lg:grid-cols-3",
        )}
      >
        {features.map(({ icon, title: featureTitle, text: featureText, link }) => (
          <div key={featureTitle} className="border-t border-black/15 pt-6">
            <Icon name={icon} size={30} />
            <h3 className="mt-4 text-base font-medium leading-6">{featureTitle}</h3>
            <p className="mt-2 text-base leading-6">{featureText}</p>
            {link ? (
              <a href={link.href} className={cn(textLink, "mt-3 inline-block font-medium")}>
                {link.label}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── "Run every part of your salon" slider ──

const MANAGE: { title: string; text: string; icon: SiteIcon; link: string; mock: ReactNode }[] = [
  {
    title: "Manage your team",
    text: "Shifts, time off and access levels for owners, admins and staff.",
    icon: "groups",
    link: "Explore team tools",
    mock: <TeamMock />,
  },
  {
    title: "Pay your team",
    text: "Work out commission and tips, track hours with timesheets and run pay runs.",
    icon: "payments",
    link: "Explore team pay",
    mock: <PayMock />,
  },
  {
    title: "Keep stock in check",
    text: "Track retail and back-bar products, see what's running low and order from suppliers.",
    icon: "inventory_2",
    link: "Explore inventory",
    mock: <StockMock />,
  },
  {
    title: "Know your numbers",
    text: "Sales, bookings and team reports that make sense at a glance.",
    icon: "bar_chart",
    link: "Explore reports",
    mock: <ReportsMock />,
  },
  {
    title: "Sell gift cards",
    text: "Gift cards bring in new clients and money up front.",
    icon: "redeem",
    link: "Explore gift cards",
    mock: <GiftCardMock />,
  },
  {
    title: "Offer memberships",
    text: "Monthly memberships and session packages keep regulars coming back.",
    icon: "loyalty",
    link: "Explore memberships",
    mock: <MembershipMock />,
  },
  {
    title: "Build your reputation",
    text: "Reviews from real visits show on your salon page for new clients to see.",
    icon: "reviews",
    link: "Explore reviews",
    mock: <ReviewMock />,
  },
];

function useSlider() {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };
  return { track, scroll };
}

const sliderTrack =
  "site-reveal mt-10 flex snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:scroll-px-8 sm:px-8 lg:scroll-px-10 lg:px-10 xl:scroll-px-[60px] xl:px-[max(60px,calc((100vw-1320px)/2))]";

function ManageSlider() {
  const { track, scroll } = useSlider();
  return (
    <section id="manage" className="scroll-mt-24 pt-24 xl:pt-[120px]">
      <div className={cn(wrap, "flex items-end justify-between gap-6")}>
        <h2 className={cn(bigHeading, "max-w-[900px]")}>
          <Words text="Run every part of your salon" />
        </h2>
        <div className="hidden gap-1 sm:flex">
          <RoundButton label="Previous" icon="arrow_back" onClick={() => scroll(-1)} />
          <RoundButton label="Next" icon="arrow_forward" onClick={() => scroll(1)} />
        </div>
      </div>
      <div ref={track} className={cn(sliderTrack, "gap-5")}>
        {MANAGE.map(({ title, text, icon, link, mock }) => (
          // DESIGN.md card-feature: cream, 50px corners, 40px padding, flat.
          <article
            key={title}
            className="grid w-[85vw] shrink-0 snap-start grid-rows-[auto_1fr] gap-8 overflow-hidden rounded-[50px] bg-[#f7f6f5] p-8 sm:w-[600px] sm:grid-cols-[1fr_240px] sm:grid-rows-1 lg:h-[583px] lg:w-[calc(100vw-80px)] lg:grid-cols-[1fr_320px] lg:p-[60px] xl:h-[413px] xl:w-[600px] xl:grid-cols-[1fr_240px] xl:p-10"
          >
            <div className="flex flex-col justify-between gap-8">
              <Icon name={icon} size={30} />
              <div>
                <h3 className="text-[24px] font-medium leading-[1.2] tracking-[-0.24px] lg:text-[36px] lg:leading-[40.5px] lg:tracking-[-0.72px] xl:text-[24px] xl:leading-[1.2] xl:tracking-[-0.24px]">
                  {title}
                </h3>
                <p className="mt-3 text-base leading-6">{text}</p>
                <Link to="/auth" className={cn(textLink, "mt-4 inline-block font-medium")}>
                  {link}
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-center">{mock}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ── Business types ──

const TYPES = [
  { label: "Hair salons", image: PHOTOS.hairSalon },
  { label: "Barbers", image: PHOTOS.barber },
  { label: "Braiding", image: PHOTOS.braids },
  { label: "Nail salons", image: PHOTOS.nails },
  { label: "Lash and brow", image: PHOTOS.lashes },
  { label: "Spas", image: PHOTOS.spa },
  { label: "Makeup artists", image: PHOTOS.makeup },
];

function BusinessTypes() {
  return (
    <section id="business-types" className="scroll-mt-24 pt-24 xl:pt-[120px]">
      <h2 className={cn(wrap, bigHeading, "text-center")}>
        <Words text="Built for your craft" />
      </h2>
      <div className={cn(sliderTrack, "gap-4 lg:gap-2.5 xl:justify-center xl:gap-4")}>
        {TYPES.map(({ label, image }) => (
          <Link
            key={label}
            to="/auth"
            className={cn(
              fadeLink,
              "relative h-[364px] w-[256px] lg:h-[408px] lg:w-[280px] xl:h-[364px] xl:w-[256px] shrink-0 snap-start overflow-hidden rounded-[10px] bg-[#f7f6f5]",
            )}
          >
            <img src={photo(image, 600)} alt="" loading="lazy" className="size-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
            <span className="absolute bottom-5 left-5 flex items-center gap-1 text-base font-medium text-white">
              {label}
              <Icon name="arrow_outward" size={18} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Devices (Square's "Simplify checkout with any device") ──

const DEVICES: { device: Device; title: string; text: string }[] = [
  {
    device: "phone",
    title: "Your phone",
    text: "Check your day, take bookings and check clients out from your phone's browser.",
  },
  {
    device: "tablet",
    title: "A tablet at the station",
    text: "Keep a tablet at the chair or front desk to run the calendar and checkout.",
  },
  {
    device: "laptop",
    title: "Your laptop",
    text: "Set up services, manage your team and run reports on a bigger screen.",
  },
  {
    device: "desktop",
    title: "The front desk computer",
    text: "Run the whole salon from reception, with the calendar open all day.",
  },
];

function Devices() {
  const [index, setIndex] = useState(0);
  const step = (dir: number) => setIndex((i) => (i + dir + DEVICES.length) % DEVICES.length);
  const current = DEVICES[index] as (typeof DEVICES)[number];
  return (
    <section id="devices" className={cn(wrap, "scroll-mt-24 pt-24 xl:pt-[120px]")}>
      <h2 className={cn(bigHeading, "text-center")}>
        <Words text="Works on the devices you already have" />
      </h2>
      <p className="site-fade mx-auto mt-5 max-w-[560px] text-center text-base leading-6">
        Bookly runs in the browser, so there's nothing to install and no special hardware to buy.
      </p>
      <div className="site-reveal mt-14 grid items-center gap-10 lg:grid-cols-[320px_1fr_320px]">
        <div aria-live="polite" className="order-2 lg:order-1">
          <h3 className="text-base font-medium leading-6">{current.title}</h3>
          <p className="mt-2 max-w-[320px] text-base leading-6">{current.text}</p>
          <div className="-ml-3 mt-4 flex gap-1">
            <RoundButton label="Previous device" icon="arrow_back" onClick={() => step(-1)} />
            <RoundButton label="Next device" icon="arrow_forward" onClick={() => step(1)} />
          </div>
        </div>
        <div className="order-1 flex min-h-[340px] items-center justify-center lg:order-2 lg:min-h-[440px]">
          <div key={current.device} className="site-fade-load">
            <DeviceMock device={current.device} />
          </div>
        </div>
        <ul className="order-3 hidden flex-col gap-1 lg:flex">
          {DEVICES.map((item, i) => (
            <li key={item.device}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                className={cn(
                  "w-full border-l-2 py-2 pl-4 text-left text-base transition-colors duration-150",
                  i === index
                    ? "border-black font-medium"
                    : "border-[#f2f2f2] text-[#707070] hover:text-[#1a1a1a]",
                )}
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Pricing ──

// TODO(prices): plan names, prices and feature lists are placeholders until the real ones are in.
const PLANS = [
  {
    name: "Starter",
    blurb: "For independent stylists taking bookings and payments",
    price: "₦TBC",
    cta: "Get started",
    features: [
      "Online booking page",
      "Calendar and client profiles",
      "Checkout and receipts",
      "Booking links and QR codes",
    ],
  },
  {
    name: "Growth",
    blurb: "For busy salons with a growing team",
    price: "₦TBC",
    cta: "Get started",
    featured: true,
    features: [
      "Everything in Starter",
      "Team calendars and shifts",
      "Gift cards, packages and memberships",
      "Promotions and promo codes",
      "Stock and supplier orders",
    ],
  },
  {
    name: "Pro",
    blurb: "For large salons and spas with complex teams",
    price: "₦TBC",
    cta: "Get started",
    features: [
      "Everything in Growth",
      "Commission and tips",
      "Timesheets and pay runs",
      "Full reports",
    ],
  },
];

function Pricing() {
  return (
    <section
      id="pricing"
      className="mt-24 scroll-mt-24 bg-[#f7f6f5] py-20 xl:mt-[120px] xl:py-[120px]"
    >
      <div className={wrap}>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className={cn(eyebrow, "site-fade pb-[17.5px] text-[#707070]")}>Pricing</p>
            {/* Square sets this heading in its sans (DESIGN.md heading-lg tier). */}
            <h2 className="site-fade max-w-[760px] text-[32px] font-medium leading-[1.1] tracking-[-0.8px] lg:text-[48px] lg:leading-none lg:tracking-[-1.44px] xl:text-[40px] xl:leading-[1.1] xl:tracking-[-0.8px]">
              Choose the plan that fits your salon
            </h2>
          </div>
          <a
            href="#faq"
            className={cn(pillOutline, pillSmall, "site-fade self-start sm:self-auto")}
          >
            Learn more
          </a>
        </div>

        <div className="site-reveal mt-12 grid max-w-[560px] gap-5 lg:max-w-none lg:grid-cols-3">
          {PLANS.map((plan) => (
            // DESIGN.md card: white on cream, 50px corners, 40px padding, no shadow.
            <article key={plan.name} className="flex flex-col rounded-[50px] bg-white p-8 lg:p-10">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[24px] font-medium leading-[1.2] tracking-[-0.24px]">
                  {plan.name}
                </h3>
                {plan.featured ? (
                  <span
                    className={cn(
                      eyebrow,
                      "rounded-full bg-[#f7f6f5] px-2.5 py-1 text-[12px] tracking-[1.2px]",
                    )}
                  >
                    Best value
                  </span>
                ) : null}
              </div>
              <p className="mt-2 min-h-12 text-base leading-6">{plan.blurb}</p>
              <div className="mt-6 border-t border-black/15 pt-6">
                <p className="text-[56px] font-medium leading-none tracking-[-1.68px] lg:text-[48px] lg:tracking-[-1.44px] xl:text-[56px] xl:tracking-[-1.68px]">
                  {plan.price}
                  <span className="text-[40px] tracking-[-1px] lg:text-[32px] xl:text-[40px]">
                    /mo.
                  </span>
                </p>
                <p className="mt-3 text-sm tracking-[0.28px] text-[#707070]">per location</p>
              </div>
              <Link
                to="/auth"
                className={cn(
                  plan.featured ? pillSolid : pillOutline,
                  "mt-8 w-full xl:h-11 xl:text-base",
                )}
              >
                {plan.cta}
              </Link>
              <p className="mt-10 border-t border-black/15 pt-6 text-sm font-medium">
                Top features
              </p>
              <ul className="mt-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="border-b border-black/10 py-3 text-sm leading-5 last:border-0"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href="#appointments"
                className={cn(textLink, "mt-auto self-start pt-4 text-sm font-medium")}
              >
                See all features
              </a>
            </article>
          ))}
        </div>

        {/* Square's fourth tier: a full-width band for custom pricing. */}
        <div className="site-reveal mt-5 grid gap-6 rounded-[50px] bg-white p-8 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:p-10">
          <div>
            <p className="text-sm font-medium text-[#707070]">Bookly for salon groups</p>
            <h3 className="mt-1 text-[24px] font-medium leading-[1.2] tracking-[-0.24px] lg:text-[32px]">
              Get custom pricing
            </h3>
            <Link to="/auth" className={cn(pillSolid, "mt-5 xl:h-11 xl:text-base")}>
              Talk to our team
            </Link>
          </div>
          <p className="text-base leading-6">
            Running several locations or a large team? Talk to us about pricing for your group, help
            setting up, and moving your clients and services over from another system.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ──

const FAQS = [
  {
    q: "Why use online booking software?",
    a: "Clients can book at any hour without calling, your calendar fills itself, and you spend less time on the phone and in your messages arranging appointments.",
  },
  {
    q: "How does booking work with Bookly?",
    a: "Share your booking link or salon page. Clients pick a service, a team member and a time, and the appointment goes straight into your calendar with an alert for you.",
  },
  {
    q: "Is Bookly right for my business?",
    a: "Bookly is built for appointment businesses: hair salons, barbers, braiders, nail techs, lash and brow artists, spas and makeup artists, whether you work alone or with a team.",
  },
  {
    q: "Can I switch from my current booking system?",
    a: "Yes. Add your services, team and opening hours and you're ready to take bookings. Importing a client list from a spreadsheet is coming soon; until then you can add clients as they visit.",
  },
  {
    q: "How long does it take to set up?",
    a: "Most salons can be taking bookings the same day. Add your services, prices and team, then share your booking link.",
  },
  {
    q: "Do clients need to download an app?",
    a: "No. Clients book from your link in any browser. They can make a free account to see their bookings, save favourite salons and book again faster.",
  },
  {
    q: "Can my team have their own logins?",
    a: "Yes. Invite your team by email. Owners and admins can see and change everything; staff get what they need for their day, like the calendar and checkout.",
  },
  {
    q: "Can clients cancel or reschedule themselves?",
    a: "Yes, from the link in their booking, within the cancellation policy you set. You decide how close to the appointment changes are allowed.",
  },
  {
    q: "Are reports included?",
    a: "Yes. See sales, bookings, clients and team performance in Bookly's reports, and export them when you need to.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className={cn(wrap, "scroll-mt-24 pt-20 xl:pt-[120px]")}>
      <h2 className={bandHeading}>
        <Words text="FAQ" />
      </h2>
      <ul className="site-reveal mt-10 border-t border-black/15">
        {FAQS.map((item, index) => {
          const isOpen = open === index;
          return (
            <li key={item.q} className="border-b border-black/15">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex min-h-[64px] w-full items-center justify-between gap-6 py-3 text-left text-base font-medium leading-6 transition-opacity duration-150 hover:opacity-70"
              >
                {item.q}
                <Icon
                  name="add"
                  size={24}
                  className={cn(
                    "transition-transform duration-300 ease-out",
                    isOpen && "rotate-45",
                  )}
                />
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <p className="max-w-[760px] overflow-hidden pr-12 text-base leading-6">
                  <span className="block pb-6">{item.a}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Closing call to action ──

function ClosingCta() {
  return (
    <section className={cn(wrap, "py-24 xl:py-[120px]")}>
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <h2
          className={cn(
            serif,
            "max-w-[760px] text-[40px] leading-none tracking-[-1px] lg:max-w-[657px] lg:text-[48px] lg:tracking-[-1.44px] xl:text-[56px] xl:tracking-[-1.68px]",
          )}
        >
          <Words text="Ready to get started? Your next client is waiting." />
        </h2>
        <div className="site-fade flex flex-wrap gap-3 lg:shrink-0 lg:flex-nowrap">
          <a href="#pricing" className={pillOutline}>
            See pricing
          </a>
          <Link to="/auth" className={pillSolid}>
            Get started free
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Footer: Square's layout on the DESIGN.md black canvas ──

const FOOTER = [
  {
    title: "Product",
    links: [
      ["Online booking", "#appointments"],
      ["Payments", "#payments"],
      ["Clients", "#clients"],
      ["Marketplace", "#growth"],
      ["Team and pay", "#manage"],
      ["Reports", "#manage"],
      ["Pricing", "#pricing"],
    ],
  },
  {
    title: "Business types",
    links: [
      ["Hair salons", "#business-types"],
      ["Barbers", "#business-types"],
      ["Braiding", "#business-types"],
      ["Nail salons", "#business-types"],
      ["Lash and brow", "#business-types"],
      ["Spas", "#business-types"],
      ["Makeup artists", "#business-types"],
    ],
  },
  {
    title: "For clients",
    links: [
      ["Book an appointment", "/sign-in"],
      ["Find a salon", "/discover"],
      ["Create an account", "/create-account"],
    ],
  },
  {
    title: "Bookly",
    links: [
      ["Sign in", "/auth"],
      ["Get started", "/auth"],
      ["FAQ", "#faq"],
    ],
  },
];

function SiteFooter() {
  return (
    <footer className="bg-black text-[14px] leading-[1.5] tracking-[0.28px] text-[#707070]">
      <div className={cn(wrap, "py-20")}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 xl:grid-cols-4">
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p>{col.title}</p>
              <ul className="mt-3 space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className={cn(fadeLink, "font-medium text-white")}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-16 max-w-[1100px]">
          <span className="font-medium text-white">Bookly:</span> booking software for salons,
          barbers, spas and studios, made in Lagos. Clients book online, you run the day from one
          calendar, and every sale, client and shift is in one place.
        </p>

        <div className="mt-8 flex items-center justify-between border-y border-white/20 py-5">
          <span className="flex items-center gap-2 font-medium text-white">
            <Icon name="language" size={20} />
            Nigeria (English)
          </span>
          <a href="#top" className={cn(fadeLink, "flex items-center gap-1 font-medium text-white")}>
            Back to top
            <Icon name="arrow_upward" size={18} />
          </a>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <span>© {new Date().getFullYear()} Bookly</span>
          <Logo inverted />
        </div>
      </div>
    </footer>
  );
}

// ── Below 1280: the two main buttons sit in a bar at the bottom of the screen, as on Square ──

/*
 * Square keeps the bar 72px below the screen until the page has scrolled past the 72px top bar
 * (the moment the product bar sticks), then slides it up over 0.15s; scrolling back hides it.
 */
function BottomCtaBar() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      inert={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex gap-1.5 border-t border-[#f2f2f2] bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-150 ease-[cubic-bezier(0,0,0.2,1)] sm:px-5 xl:hidden",
        shown ? "translate-y-0" : "translate-y-[calc(100%+1px)]",
      )}
    >
      <a href="#pricing" className={cn(pillOutline, "h-[41px] flex-1")}>
        See pricing
      </a>
      <Link to="/auth" className={cn(pillSolid, "h-[41px] flex-1")}>
        Get started
      </Link>
    </div>
  );
}
