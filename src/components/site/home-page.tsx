import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  ArrowsSplit,
  ArrowUpRight,
  BellRinging,
  CalendarX,
  CaretDown,
  ChartLineUp,
  Gift,
  Globe,
  Hourglass,
  InstagramLogo,
  Money,
  Notebook,
  Package,
  Plus,
  QrCode,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Star,
  Storefront,
  Tag,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  BookingAlertMock,
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
  bigHeading,
  eyebrow,
  photo,
  photoZoom,
  pillOutline,
  pillSmall,
  pillSolid,
  serif,
  sweep,
  wrap,
} from "./site-styles";
import { ArrowLink, Logo, RoundButton, Words } from "./site-ui";

/*
 * Bookly's marketing homepage, following the sections of Square's Appointments page in order:
 * header with a sticky product bar (and a Features menu), hero with rotating product scenes,
 * "Explore solutions" jump links, four feature sections, a card slider, business types, devices,
 * pricing with a custom-pricing band, FAQ, closing call to action and footer. On phones a bar
 * with the two main buttons stays at the bottom of the screen once the hero is passed.
 *
 * Every feature named here exists in the app. Don't add claims (reminders, deposits, client
 * import...) until they ship.
 */

export function HomePage() {
  const [pastHero, setPastHero] = useState(false);
  return (
    <div className="site-home min-h-screen bg-white pb-20 font-sans text-[#101010] antialiased md:pb-0">
      <SiteHeader />
      <main>
        <Hero onPassed={setPastHero} />
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
      <MobileCtaBar visible={pastHero} />
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

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const menuRef = useDismiss(menuOpen, () => setMenuOpen(false));
  const featuresRef = useDismiss(featuresOpen, () => setFeaturesOpen(false));
  return (
    <>
      <div className="border-b border-[#f0f0f0]">
        <div className={cn(wrap, "flex h-[72px] items-center justify-between gap-3 sm:gap-6")}>
          <div className="flex items-center gap-10">
            <Logo />
            <nav className="hidden items-center gap-7 text-[15px] font-medium lg:flex">
              <a href="#business-types" className={sweep}>
                Business types
              </a>
              <a href="#appointments" className={sweep}>
                Features
              </a>
              <a href="#pricing" className={sweep}>
                Pricing
              </a>
              <Link to="/discover" className={sweep}>
                Find a salon
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-6 text-[15px] font-medium">
            <Link to="/sign-in" className={cn(sweep, "hidden md:inline")}>
              Book an appointment
            </Link>
            <Link to="/auth" className={cn(sweep, "py-3")}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
      <div
        ref={menuRef}
        className="sticky top-0 z-40 border-b border-[#f0f0f0] bg-white/95 backdrop-blur"
      >
        <div className={cn(wrap, "flex h-[72px] items-center justify-between gap-3 sm:gap-6")}>
          <span className="hidden text-[18px] font-semibold lg:inline">Bookly for salons</span>
          {/* Below desktop the section links fold into this menu, like Square's. */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="-ml-2 flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-base font-semibold sm:text-[17px] lg:hidden"
          >
            Bookly for salons
            <CaretDown
              size={14}
              weight="bold"
              className={cn("transition-transform duration-200", menuOpen && "rotate-180")}
            />
          </button>

          {/* Desktop: links sit on the right next to the buttons, as on Square. */}
          <div className="flex items-center gap-7">
            <nav className="hidden items-center gap-7 text-[15px] lg:flex">
              <a href="#top" className={cn(sweep, "font-medium")}>
                Overview
              </a>
              <div ref={featuresRef} className="relative">
                <button
                  type="button"
                  aria-expanded={featuresOpen}
                  aria-controls="site-features"
                  onClick={() => setFeaturesOpen((open) => !open)}
                  className="flex items-center gap-1 text-[#666] transition-colors hover:text-[#101010]"
                >
                  Features
                  <CaretDown
                    size={12}
                    weight="bold"
                    className={cn(
                      "transition-transform duration-200",
                      featuresOpen && "rotate-180",
                    )}
                  />
                </button>
                <ul
                  id="site-features"
                  hidden={!featuresOpen}
                  className="absolute left-1/2 top-[calc(100%+18px)] w-[280px] -translate-x-1/2 rounded-[12px] bg-white p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5"
                >
                  {FEATURE_LINKS.map(([label, href]) => (
                    <li key={label}>
                      <a
                        href={href}
                        onClick={() => setFeaturesOpen(false)}
                        className="block rounded-[8px] px-3 py-2 text-[14px] font-medium transition-colors hover:bg-[#f7f7f7]"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <a href="#business-types" className={cn(sweep, "text-[#666] hover:text-[#101010]")}>
                Business types
              </a>
              <a href="#pricing" className={cn(sweep, "text-[#666] hover:text-[#101010]")}>
                Pricing
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <a href="#pricing" className={cn(pillOutline, pillSmall, "hidden sm:inline-flex")}>
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
          className="absolute inset-x-0 top-full max-h-[calc(100svh-72px)] overflow-y-auto border-b border-[#f0f0f0] bg-white shadow-[0_16px_30px_-20px_rgba(0,0,0,0.25)] lg:hidden"
        >
          <ul className={cn(wrap, "py-2")}>
            {SECTIONS.map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex h-12 items-center border-b border-[#f0f0f0] text-base font-medium"
                >
                  {label}
                </a>
              </li>
            ))}
            <li>
              <Link
                to="/discover"
                className="flex h-12 items-center border-b border-[#f0f0f0] text-base font-medium"
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

function Hero({ onPassed }: { onPassed: (passed: boolean) => void }) {
  const [scene, setScene] = useState(0);
  const buttons = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setScene((s) => (s + 1) % HERO_SCENES.length), 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Once the hero buttons scroll away, phones get the bottom bar instead.
  useEffect(() => {
    const el = buttons.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) onPassed(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onPassed]);

  return (
    <section id="top" className={cn(wrap, "pt-12 lg:pt-16")}>
      <p className={cn(eyebrow, "site-fade-load text-[#101010]")}>Appointments</p>
      <h1
        className={cn(
          serif,
          "mt-4 max-w-[900px] text-[44px] leading-[1.05] tracking-[-0.5px] sm:text-[56px] lg:text-[64px]",
        )}
      >
        <Words text="Booking software that keeps your chairs full" onLoad />
      </h1>
      <p
        className="site-fade-load mt-5 max-w-[620px] text-[18px] leading-[27px] text-[#666]"
        style={{ animationDelay: "450ms" }}
      >
        Bookly brings online booking, your calendar, checkout, clients and your team together —
        built for salons, barbers, spas and studios.
      </p>
      <div
        ref={buttons}
        className="site-fade-load mt-8 flex flex-wrap gap-3"
        style={{ animationDelay: "600ms" }}
      >
        <a href="#pricing" className={pillOutline}>
          See pricing
        </a>
        <Link to="/auth" className={pillSolid}>
          Get started free
        </Link>
      </div>

      <div className="group relative mt-12 aspect-[4/5] overflow-hidden rounded-[10px] bg-[#e9e4de] sm:aspect-[16/9] lg:mt-16 lg:aspect-[1320/680]">
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
              className={cn(photoZoom, "size-full object-cover")}
              fetchPriority={index === 0 ? "high" : undefined}
              loading={index === 0 ? undefined : "lazy"}
            />
            <div className="absolute inset-x-4 bottom-4 transition-transform duration-500 ease-out motion-safe:group-hover:-translate-y-2 sm:inset-x-auto sm:bottom-10 sm:right-10 sm:w-[min(560px,60%)]">
              {item.mock}
            </div>
          </div>
        ))}
        <div className="absolute bottom-4 left-4 hidden gap-1.5 sm:flex sm:bottom-10 sm:left-10">
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
              className={cn(
                eyebrow,
                "group flex min-h-11 items-center gap-1.5 hover:text-[#006aff]",
              )}
            >
              {label}
              <ArrowDown
                size={14}
                weight="bold"
                className="transition-transform duration-300 motion-safe:group-hover:translate-y-0.5"
              />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Feature sections ──

type Feature = {
  icon: typeof Star;
  title: string;
  text: string;
  link?: { label: string; href: string };
};

type FeatureSectionProps = {
  id: string;
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
    title: "Say goodbye to double bookings",
    text: "One calendar for the whole salon. Clients book themselves online at any hour, and Bookly keeps every stylist's hours, breaks and days off in order.",
    image: PHOTOS.scheduling,
    mock: <CalendarMock compact />,
    columns: 3,
    features: [
      {
        icon: Globe,
        title: "Create a free booking page",
        text: "Give clients a page with your services, prices and team where they can book you 24/7.",
      },
      {
        icon: UsersThree,
        title: "Add your whole team",
        text: "Every team member gets their own calendar and shifts, and clients can choose who they book with.",
      },
      {
        icon: CalendarX,
        title: "Block out breaks and closures",
        text: "Lunch, days off and holidays are blocked, so clients only see times you can really take.",
      },
      {
        icon: QrCode,
        title: "Share links and QR codes",
        text: "Make a booking link or QR code for any service to share online or print for the front desk.",
      },
      {
        icon: Hourglass,
        title: "Keep a waitlist",
        text: "Note who's waiting for a slot, so you can fill the gap when someone cancels.",
      },
    ],
  },
  {
    id: "payments",
    title: "Get paid for every appointment",
    text: "Check clients out in seconds at the desk, with every sale, tip and payment recorded in one place.",
    image: PHOTOS.payments,
    mock: <CheckoutMock />,
    columns: 4,
    features: [
      {
        icon: Receipt,
        title: "Fast checkout",
        text: "Ring up services, products and tips on one sale, straight from the appointment.",
      },
      {
        icon: ArrowsSplit,
        title: "Split payments",
        text: "Let clients pay part cash, part card or transfer, all recorded on the same sale.",
      },
      {
        icon: Gift,
        title: "Sell gift cards",
        text: "Sell gift cards at the desk and take them as payment at checkout.",
      },
      {
        icon: Package,
        title: "Packages and memberships",
        text: "Sell bundles of sessions and memberships that clients use up visit by visit.",
      },
    ],
  },
  {
    id: "clients",
    title: "Keep clients coming back",
    text: "Everything you know about a client in one place, and an easy way for them to change plans without calling you.",
    image: PHOTOS.clients,
    mock: <ClientMock />,
    columns: 3,
    features: [
      {
        icon: Notebook,
        title: "Client profiles",
        text: "Contact details, notes, visit history and spend on every client's card.",
      },
      {
        icon: ArrowsClockwise,
        title: "Changes without the phone calls",
        text: "Clients can cancel or reschedule from their booking link, within the rules you set.",
      },
      {
        icon: ShieldCheck,
        title: "Set a cancellation policy",
        text: "Decide how close to an appointment clients can cancel or move it, and show it when they book.",
      },
      {
        icon: UserCircle,
        title: "Client accounts",
        text: "Clients can make a free account to see their bookings, save favourite salons and book again.",
      },
      {
        icon: Star,
        title: "Reviews",
        text: "Clients can review their visit, and good reviews help the next person choose you.",
      },
      {
        icon: BellRinging,
        title: "New booking alerts",
        text: "Get notified in Bookly the moment a new online booking comes in.",
      },
    ],
  },
  {
    id: "growth",
    title: "Find new clients in new ways",
    columns: 4,
    features: [
      {
        icon: Storefront,
        title: "Join the Bookly marketplace",
        text: "Get found by people nearby who are looking for a salon, and booked straight into your calendar.",
        link: { label: "Explore the marketplace", href: "/discover" },
      },
      {
        icon: InstagramLogo,
        title: "Get booked from social",
        text: "Put your booking link in your Instagram bio and WhatsApp status so followers can book in a tap.",
      },
      {
        icon: Tag,
        title: "Run promotions",
        text: "Create promo codes and offers to fill quiet days and bring regulars back.",
      },
      {
        icon: ShoppingBag,
        title: "Sell products too",
        text: "Ring up retail products alongside services and keep track of your stock.",
      },
    ],
  },
];

function FeatureSection({ id, title, text, image, mock, columns, features }: FeatureSectionProps) {
  return (
    <section id={id} className={cn(wrap, "scroll-mt-24 pt-24 lg:pt-36")}>
      {image ? (
        // Text on the left, picture on the right (Square keeps this order for every section).
        <div className="grid items-center gap-10 lg:grid-cols-[433px_1fr] lg:gap-5">
          <div className="lg:pr-10">
            <h2 className={cn(serif, "text-[36px] leading-[1.1] tracking-[-0.5px] lg:text-[48px]")}>
              <Words text={title} />
            </h2>
            {text ? <p className="site-fade mt-5 text-base leading-6 text-[#666]">{text}</p> : null}
            <ArrowLink className="site-fade mt-3">Get started</ArrowLink>
          </div>
          <div className="site-reveal group relative overflow-hidden rounded-[10px] bg-[#f7f6f5]">
            <img
              src={photo(image, 1400)}
              alt=""
              loading="lazy"
              className={cn(photoZoom, "aspect-[4/3] w-full object-cover lg:aspect-[867/578]")}
            />
            {mock ? (
              <div className="absolute bottom-4 hidden transition-transform duration-500 ease-out motion-safe:group-hover:-translate-y-2 sm:bottom-8 sm:right-8 sm:block sm:w-[340px]">
                {mock}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <h2 className={cn(serif, "text-[36px] leading-[1.1] tracking-[-0.5px] lg:text-[48px]")}>
          <Words text={title} />
        </h2>
      )}

      <div
        className={cn(
          "site-reveal mt-14 grid gap-x-5 gap-y-10 sm:grid-cols-2",
          columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {features.map(({ icon: Icon, title: featureTitle, text: featureText, link }) => (
          <div key={featureTitle} className="group relative border-t border-[#dadada] pt-6">
            {/* A dark line draws across the top rule on hover. */}
            <span className="absolute -top-px left-0 h-px w-0 bg-[#101010] transition-[width] duration-500 ease-out group-hover:w-full" />
            <Icon
              size={28}
              weight="regular"
              className="transition-[color,transform] duration-300 ease-out group-hover:text-[#006aff] motion-safe:group-hover:-translate-y-1"
            />
            <h3 className="mt-4 text-base font-medium leading-6">{featureTitle}</h3>
            <p className="mt-2 text-base leading-6 text-[#666]">{featureText}</p>
            {link ? (
              <ArrowLink href={link.href} className="mt-2">
                {link.label}
              </ArrowLink>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── "Run every part of your salon" slider ──

const MANAGE = [
  {
    title: "Manage your team",
    text: "Shifts, time off and access levels for owners, admins and staff.",
    icon: UsersThree,
    link: "Explore team tools",
    mock: <TeamMock />,
  },
  {
    title: "Pay your team",
    text: "Work out commission and tips, track hours with timesheets and run pay runs.",
    icon: Money,
    link: "Explore team pay",
    mock: <PayMock />,
  },
  {
    title: "Keep stock in check",
    text: "Track retail and back-bar products, see what's running low and order from suppliers.",
    icon: Package,
    link: "Explore inventory",
    mock: <StockMock />,
  },
  {
    title: "Know your numbers",
    text: "Sales, bookings and team reports that make sense at a glance.",
    icon: ChartLineUp,
    link: "Explore reports",
    mock: <ReportsMock />,
  },
  {
    title: "Sell gift cards",
    text: "Gift cards bring in new clients and money up front.",
    icon: Gift,
    link: "Explore gift cards",
    mock: <GiftCardMock />,
  },
  {
    title: "Offer memberships",
    text: "Monthly memberships and session packages keep regulars coming back.",
    icon: Repeat,
    link: "Explore memberships",
    mock: <MembershipMock />,
  },
  {
    title: "Build your reputation",
    text: "Reviews from real visits show on your salon page for new clients to see.",
    icon: Star,
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
  "site-reveal mt-10 flex snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:scroll-px-8 sm:px-8 lg:scroll-px-[60px] lg:px-[max(60px,calc((100vw-1320px)/2))]";

function ManageSlider() {
  const { track, scroll } = useSlider();
  return (
    <section id="manage" className="scroll-mt-24 pt-24 lg:pt-36">
      <div className={cn(wrap, "flex items-end justify-between gap-6")}>
        <h2 className={cn(bigHeading, "max-w-[900px]")}>
          <Words text="Run every part of your salon" />
        </h2>
        <div className="hidden gap-2 sm:flex">
          <RoundButton label="Previous" onClick={() => scroll(-1)}>
            <ArrowLeft size={20} />
          </RoundButton>
          <RoundButton label="Next" onClick={() => scroll(1)}>
            <ArrowRight size={20} />
          </RoundButton>
        </div>
      </div>
      <div ref={track} className={cn(sliderTrack, "gap-5")}>
        {MANAGE.map(({ title, text, icon: Icon, link, mock }) => (
          <article
            key={title}
            className="group grid w-[85vw] shrink-0 snap-start grid-rows-[auto_1fr] gap-8 overflow-hidden rounded-[10px] bg-[#f7f6f5] p-8 transition-colors duration-300 hover:bg-[#efebe6] sm:w-[600px] sm:grid-cols-[1fr_250px] sm:grid-rows-1 lg:h-[413px] lg:p-10"
          >
            <div className="flex flex-col justify-between gap-8">
              <span className="flex size-14 items-center justify-center rounded-full bg-white transition-[background-color,color,transform] duration-300 ease-out group-hover:bg-[#006aff] group-hover:text-white motion-safe:group-hover:scale-110">
                <Icon size={26} />
              </span>
              <div>
                <h3 className="text-[28px] font-medium leading-[1.1] tracking-[-0.6px] lg:text-[32px]">
                  {title}
                </h3>
                <p className="mt-3 text-base leading-6 text-[#666]">{text}</p>
                <ArrowLink className="mt-3">{link}</ArrowLink>
              </div>
            </div>
            <div className="flex items-center justify-center transition-transform duration-500 ease-out motion-safe:group-hover:-translate-y-1.5">
              {mock}
            </div>
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
    <section id="business-types" className="scroll-mt-24 pt-24 lg:pt-36">
      <h2 className={cn(wrap, bigHeading, "text-center")}>
        <Words text="Built for your craft" />
      </h2>
      <div className={cn(sliderTrack, "gap-4 lg:justify-center")}>
        {TYPES.map(({ label, image }) => (
          <Link
            key={label}
            to="/auth"
            className="group relative h-[364px] w-[256px] shrink-0 snap-start overflow-hidden rounded-[10px] bg-[#e9e4de]"
          >
            <img
              src={photo(image, 600)}
              alt=""
              loading="lazy"
              className={cn(
                photoZoom,
                "size-full object-cover motion-safe:group-hover:scale-[1.07]",
              )}
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <span className="absolute bottom-5 left-5 flex items-center gap-1 text-base font-medium text-white">
              {label}
              <ArrowUpRight
                size={16}
                weight="bold"
                className="transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5"
              />
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
    <section id="devices" className={cn(wrap, "scroll-mt-24 pt-24 lg:pt-36")}>
      <h2 className={cn(bigHeading, "text-center")}>
        <Words text="Works on the devices you already have" />
      </h2>
      <p className="site-fade mx-auto mt-5 max-w-[560px] text-center text-base leading-6 text-[#666]">
        Bookly runs in the browser, so there's nothing to install and no special hardware to buy.
      </p>
      <div className="site-reveal mt-14 grid items-center gap-10 lg:grid-cols-[320px_1fr_320px]">
        <div aria-live="polite" className="order-2 lg:order-1">
          <h3 className="text-base font-medium leading-6">{current.title}</h3>
          <p className="mt-2 max-w-[320px] text-base leading-6 text-[#666]">{current.text}</p>
          <div className="mt-6 flex gap-2">
            <RoundButton label="Previous device" onClick={() => step(-1)} className="size-11">
              <ArrowLeft size={18} />
            </RoundButton>
            <RoundButton label="Next device" onClick={() => step(1)} className="size-11">
              <ArrowRight size={18} />
            </RoundButton>
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
                  "w-full border-l-2 py-2 pl-4 text-left text-base transition-colors",
                  i === index
                    ? "border-[#101010] font-medium"
                    : "border-[#f0f0f0] text-[#666] hover:text-[#101010]",
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
    <section id="pricing" className="mt-24 scroll-mt-24 bg-[#f7f6f5] py-20 lg:mt-36 lg:py-28">
      <div className={wrap}>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          {/* Square sets this heading in its sans, not the serif. */}
          <h2 className="site-fade max-w-[760px] text-[32px] font-semibold leading-[1.15] tracking-[-0.8px] lg:text-[40px]">
            Choose the plan that fits your salon
          </h2>
          <a
            href="#faq"
            className={cn(pillOutline, pillSmall, "site-fade self-start sm:self-auto")}
          >
            Learn more
          </a>
        </div>

        <div className="site-reveal mt-12 grid max-w-[560px] gap-5 lg:max-w-none lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className="flex flex-col rounded-[10px] bg-white p-8 transition-[transform,box-shadow] duration-300 ease-out hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.18)] motion-safe:hover:-translate-y-1"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[24px] font-medium leading-[28.8px] tracking-[-0.24px]">
                  {plan.name}
                </h3>
                {plan.featured ? (
                  <span
                    className={cn(
                      eyebrow,
                      "rounded-full border border-[#101010] px-2.5 py-1 text-[11px]",
                    )}
                  >
                    Best value
                  </span>
                ) : null}
              </div>
              <p className="mt-2 min-h-12 text-base leading-6 text-[#666]">{plan.blurb}</p>
              <div className="mt-6 border-t border-[#f0f0f0] pt-6">
                <p className="text-[56px] font-medium leading-none tracking-[-1.68px]">
                  {plan.price}
                  <span className="text-[40px] tracking-[-1px]">/mo.</span>
                </p>
                <p className="mt-3 text-sm text-[#666]">per location</p>
              </div>
              <Link
                to="/auth"
                className={cn(
                  plan.featured ? pillSolid : pillOutline,
                  "mt-8 h-11 w-full text-base",
                )}
              >
                {plan.cta}
              </Link>
              <p className="mt-10 border-t border-[#f0f0f0] pt-6 text-sm font-medium">
                Top features
              </p>
              <ul className="mt-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="border-b border-[#f0f0f0] py-3 text-sm leading-5 text-[#666] last:border-0"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
              <ArrowLink href="#appointments" className="mt-auto pt-4 text-sm">
                See all features
              </ArrowLink>
            </article>
          ))}
        </div>

        {/* Square's fourth tier: a full-width band for custom pricing. */}
        <div className="site-reveal mt-5 grid gap-6 rounded-[10px] bg-white p-8 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:p-10">
          <div>
            <p className="text-sm font-medium text-[#666]">Bookly for salon groups</p>
            <h3 className="mt-1 text-[28px] font-medium leading-[1.15] tracking-[-0.6px] lg:text-[32px]">
              Get custom pricing
            </h3>
            <Link to="/auth" className={cn(pillSolid, "mt-5 h-11 text-base")}>
              Talk to our team
            </Link>
          </div>
          <p className="text-base leading-6 text-[#666]">
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
    <section id="faq" className={cn(wrap, "scroll-mt-24 pt-20 lg:pt-28")}>
      <h2 className={cn(serif, "text-[40px] leading-[45px]")}>
        <Words text="FAQ" />
      </h2>
      <ul className="site-reveal mt-10 border-t border-[#dadada]">
        {FAQS.map((item, index) => {
          const isOpen = open === index;
          return (
            <li key={item.q} className="border-b border-[#dadada]">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : index)}
                className="group flex w-full items-center justify-between gap-6 py-4 text-left text-base font-medium leading-6"
              >
                <span className="transition-transform duration-300 ease-out motion-safe:group-hover:translate-x-1">
                  {item.q}
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 group-hover:bg-[#f0f0f0]">
                  <Plus
                    size={20}
                    className={cn(
                      "transition-transform duration-300 ease-out",
                      isOpen && "rotate-45",
                    )}
                  />
                </span>
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <p className="max-w-[760px] overflow-hidden pr-12 text-base leading-6 text-[#666]">
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
    <section className={cn(wrap, "py-24 lg:py-36")}>
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <h2
          className={cn(
            serif,
            "max-w-[760px] text-[40px] leading-none tracking-[-1px] lg:text-[56px] lg:tracking-[-1.68px]",
          )}
        >
          <Words text="Ready to get started? Your next client is waiting." />
        </h2>
        <div className="site-fade flex flex-wrap gap-3">
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

// ── Footer ──

const FOOTER = [
  {
    title: "Product",
    links: [
      ["Online booking", "#appointments"],
      ["Payments", "#payments"],
      ["Clients", "#clients"],
      ["Pricing", "#pricing"],
    ],
  },
  {
    title: "Business types",
    links: [
      ["Hair salons", "#business-types"],
      ["Barbers", "#business-types"],
      ["Nail salons", "#business-types"],
      ["Spas", "#business-types"],
    ],
  },
  {
    title: "For clients",
    links: [
      ["Book an appointment", "/sign-in"],
      ["Create an account", "/create-account"],
      ["Find a salon", "/discover"],
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
    <footer className="bg-[#101010] text-[14px] leading-[21px] text-[#a0a0a0]">
      <div className={cn(wrap, "py-16")}>
        <Logo inverted />
        <div className="mt-12 grid grid-cols-2 gap-10 lg:grid-cols-4">
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="font-medium text-white">{col.title}</p>
              <ul className="mt-3 space-y-1">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className={cn(sweep, "inline-block py-1.5 hover:text-white")}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-8 text-[#707070] sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Bookly. Made in Lagos.</span>
          <span>Booking software for salons, barbers, spas and studios.</span>
        </div>
      </div>
    </footer>
  );
}

// ── Phones: the two main buttons stay at the bottom once the hero has scrolled away ──

function MobileCtaBar({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-[#f0f0f0] bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 ease-out md:hidden",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <a
        href="#pricing"
        tabIndex={visible ? 0 : -1}
        className={cn(pillOutline, "h-11 flex-1 text-base")}
      >
        See pricing
      </a>
      <Link
        to="/auth"
        tabIndex={visible ? 0 : -1}
        className={cn(pillSolid, "h-11 flex-1 text-base")}
      >
        Get started
      </Link>
    </div>
  );
}
