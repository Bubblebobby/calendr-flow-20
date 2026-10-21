import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsOut,
  CalendarCheck,
  CaretDown,
  ChatsCircle,
  DeviceMobile,
  Globe,
  InstagramLogo,
  List,
  LockKey,
  QrCode,
  Storefront,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  CalendarMock,
  CheckoutMock,
  ClientMock,
  GiftCardMock,
  ListingMock,
  ReportsMock,
  TeamMock,
} from "@/components/site/site-mocks";
import { PHOTOS, photo } from "@/components/site/site-styles";
import { CardWash, DotBurst, GradientRibbon, HoverArrow } from "./v2-art";
import {
  bodyClass,
  buttonPrimary,
  buttonSecondary,
  buttonSmall,
  frame,
  h1Class,
  h2Class,
  h3Class,
  inner,
  linkClass,
} from "./v2-styles";

/*
 * The second homepage (/v2), laid out like Stripe's: a framed page with guide lines, a thin
 * headline that runs on in grey, a gradient ribbon, a bento of product cards, a facts band, "for
 * every size" segments, a dark diagram band, a carousel, a call to action and a light footer.
 *
 * Everything said about Bookly here is true of the app today. Stripe's customer logos, volumes
 * and stories have no Bookly equivalent yet, so those slots carry business types and product
 * facts instead.
 */

export function HomeV2() {
  return (
    <div className="v2-home min-h-screen bg-white font-sans font-light text-[#061b31] antialiased [font-feature-settings:'cv11']">
      <Nav />
      <main>
        <Hero />
        <Bento />
        <Facts />
        <Sizes />
        <Connected />
        <Craft />
        <GetStarted />
      </main>
      <Footer />
    </div>
  );
}

// ── Navigation ──

const FEATURE_MENU = [
  { title: "Online booking", text: "A booking page clients can use 24/7", href: "#bento" },
  { title: "Calendar and team", text: "Shifts, time off and access levels", href: "#bento" },
  { title: "Checkout", text: "Services, products, tips, split payments", href: "#bento" },
  {
    title: "Gift cards and memberships",
    text: "Money up front, regulars for life",
    href: "#bento",
  },
  { title: "Marketplace", text: "Get found by clients nearby", href: "#connected" },
  { title: "Reports", text: "Sales, bookings and team at a glance", href: "#sizes" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [features, setFeatures] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!features) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setFeatures(false);
    const onClick = (event: MouseEvent) => {
      if (!featuresRef.current?.contains(event.target as Node)) setFeatures(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [features]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,box-shadow] duration-200",
        scrolled ? "bg-white/90 shadow-[0_1px_0_#e5edf5] backdrop-blur" : "bg-transparent",
      )}
    >
      <div className={cn(frame, "border-transparent")}>
        <div className="flex h-[72px] items-center justify-between gap-6 px-5 sm:px-10 lg:px-[120px]">
          <div className="flex items-center gap-8">
            <Link to="/v2" className="flex items-center gap-1.5" aria-label="Bookly home">
              <CalendarCheck size={22} weight="bold" className="text-[#533afd]" />
              <span className="text-[21px] font-semibold tracking-[-0.03em]">bookly</span>
            </Link>
            <nav className="hidden items-center gap-6 text-[14px] font-normal lg:flex">
              <div
                ref={featuresRef}
                className="relative"
                onMouseEnter={() => setFeatures(true)}
                onMouseLeave={() => setFeatures(false)}
              >
                <button
                  type="button"
                  aria-expanded={features}
                  aria-controls="v2-features"
                  onClick={() => setFeatures((open) => !open)}
                  className="flex h-10 items-center gap-1 transition-opacity hover:opacity-60"
                >
                  Features
                  <CaretDown
                    size={11}
                    weight="bold"
                    className={cn("transition-transform duration-200", features && "rotate-180")}
                  />
                </button>
                {/* Pad the gap so the menu stays open while the pointer crosses it. */}
                <div
                  id="v2-features"
                  hidden={!features}
                  className="absolute -left-6 top-full w-[520px] pt-2"
                >
                  <ul className="grid grid-cols-2 gap-1 rounded-[8px] bg-white p-3 shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] ring-1 ring-[#e5edf5]">
                    {FEATURE_MENU.map((item) => (
                      <li key={item.title}>
                        <a
                          href={item.href}
                          onClick={() => setFeatures(false)}
                          className="block rounded-[6px] p-3 transition-colors hover:bg-[#f8fafd]"
                        >
                          <span className="block text-[14px] font-normal">{item.title}</span>
                          <span className="block text-[13px] text-[#64748d]">{item.text}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <a href="#sizes" className="transition-opacity hover:opacity-60">
                Solutions
              </a>
              <Link to="/discover" className="transition-opacity hover:opacity-60">
                Find a salon
              </Link>
              <Link to="/" hash="pricing" className="transition-opacity hover:opacity-60">
                Pricing
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className={cn(buttonSecondary, buttonSmall, "hidden border-[#e5edf5] sm:inline-flex")}
            >
              Sign in
            </Link>
            <Link to="/auth" className={cn(buttonPrimary, buttonSmall)}>
              Get started <HoverArrow />
            </Link>
            <button
              type="button"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              aria-controls="v2-menu"
              onClick={() => setMenu((open) => !open)}
              className="flex size-10 items-center justify-center rounded-[4px] lg:hidden"
            >
              {menu ? <X size={22} /> : <List size={22} />}
            </button>
          </div>
        </div>
      </div>
      <nav
        id="v2-menu"
        hidden={!menu}
        className="border-t border-[#e5edf5] bg-white px-5 pb-6 pt-2 shadow-[0_8px_24px_rgba(0,55,112,0.08)] lg:hidden"
      >
        {[
          ["Features", "#bento"],
          ["Solutions", "#sizes"],
          ["Business types", "#craft"],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            onClick={() => setMenu(false)}
            className="flex h-12 items-center border-b border-[#e5edf5] text-base font-normal"
          >
            {label}
          </a>
        ))}
        <Link
          to="/discover"
          className="flex h-12 items-center border-b border-[#e5edf5] text-base font-normal"
        >
          Find a salon
        </Link>
        <Link to="/auth" className="flex h-12 items-center text-base font-normal">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

// ── Hero ──

const TYPES = [
  "Hair salons",
  "Barbers",
  "Braiding",
  "Nail salons",
  "Lash and brow",
  "Spas",
  "Makeup artists",
];

function Hero() {
  return (
    <section className="relative -mt-[72px] overflow-hidden pt-[72px]">
      <GradientRibbon className="absolute opacity-50 sm:opacity-100 -right-[18%] -top-[10%] h-[760px] w-[min(1100px,95vw)] [mask-image:linear-gradient(to_left,black_45%,transparent_95%)] sm:-right-[6%] lg:right-0" />
      <div className={cn(frame, "relative")}>
        <div className={cn(inner, "pb-16 pt-20 sm:pt-28 lg:pb-24")}>
          <p className="v2-rise text-[14px] font-normal">
            Booking software for salons, barbers and spas
          </p>
          <h1
            className={cn(h1Class, "v2-rise mt-6 max-w-[880px]")}
            style={{ animationDelay: "80ms" }}
          >
            Booking software that keeps your chairs full.{" "}
            <span className="text-[#64748d]">
              Take bookings online, check clients out and run your team—from your first client to
              your thousandth.
            </span>
          </h1>
          <div className="v2-rise mt-10 flex flex-wrap gap-3" style={{ animationDelay: "160ms" }}>
            <Link to="/auth" className={buttonPrimary}>
              Get started <HoverArrow />
            </Link>
            <Link to="/discover" className={buttonSecondary}>
              <Storefront size={18} /> Find a salon
            </Link>
          </div>
        </div>

        {/* Stripe's customer-logo strip; Bookly lists who it's built for. */}
        <div className="border-y border-[#e5edf5] bg-white/70 backdrop-blur-sm">
          <ul
            className={cn(
              inner,
              "flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-6",
            )}
          >
            {TYPES.map((type) => (
              <li key={type} className="text-[15px] font-normal tracking-[-0.2px] text-[#64748d]">
                {type}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── Bento of product cards ──

type BentoCard = {
  title: string;
  text: string;
  wash: "warm" | "cool" | "pink" | "violet";
  art: ReactNode;
  span: string;
};

const BENTO: BentoCard[] = [
  {
    title: "Take bookings online, around the clock",
    text: "Your own booking page with services, prices and team. Clients pick a time and it lands in your calendar.",
    wash: "warm",
    span: "lg:col-span-2",
    art: (
      <div className="grid w-full max-w-[560px] grid-cols-[1fr_1.3fr] items-end gap-4">
        <ListingMock />
        <CalendarMock compact />
      </div>
    ),
  },
  {
    title: "Check clients out in seconds",
    text: "Services, products and tips on one sale, split across cash, card and transfer.",
    wash: "cool",
    span: "",
    art: (
      <div className="w-full max-w-[280px]">
        <CheckoutMock />
      </div>
    ),
  },
  {
    title: "Sell gift cards and memberships",
    text: "Money up front, and a reason for regulars to keep coming back.",
    wash: "pink",
    span: "",
    art: <GiftCardMock />,
  },
  {
    title: "Run your whole team",
    text: "Shifts, time off, commission and pay runs in one place.",
    wash: "violet",
    span: "",
    art: <TeamMock />,
  },
  {
    title: "Know every client",
    text: "Notes, history and spend on every client, and clients who can reschedule themselves.",
    wash: "warm",
    span: "",
    art: (
      <div className="w-full max-w-[280px]">
        <ClientMock />
      </div>
    ),
  },
];

function Bento() {
  return (
    <section id="bento" className="scroll-mt-20">
      <div className={frame}>
        <div className={cn(inner, "pt-20 lg:pt-24")}>
          <h2 className={cn(h2Class, "v2-fade max-w-[720px]")}>
            Flexible tools for every kind of salon.{" "}
            <span className="text-[#64748d]">
              Booking, checkout, clients and team, designed to work on their own or together.
            </span>
          </h2>
        </div>
        <div className={cn(inner, "grid gap-4 pb-20 pt-10 lg:grid-cols-3 lg:pb-24")}>
          {BENTO.map((card) => (
            <Link
              key={card.title}
              to="/auth"
              className={cn(
                "v2-fade group relative flex min-h-[460px] flex-col overflow-hidden rounded-[8px] bg-[#f8fafd] p-6 transition-shadow duration-300 hover:shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] lg:min-h-[560px]",
                card.span,
              )}
            >
              <CardWash tone={card.wash} />
              <div className="relative flex items-start justify-between gap-4">
                <h3 className={cn(h3Class, "max-w-[340px]")}>{card.title}</h3>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-[#e5edf5] bg-white text-[#533afd] transition-colors group-hover:border-[#533afd]">
                  <ArrowsOut size={14} />
                </span>
              </div>
              <p className="relative mt-3 max-w-[380px] text-[15px] leading-[1.4] text-[#64748d]">
                {card.text}
              </p>
              <div className="relative mt-auto flex justify-center pt-8 transition-transform duration-500 ease-out motion-safe:group-hover:-translate-y-1.5">
                {card.art}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Facts band (Stripe's "backbone" statistics) ──

const FACTS = [
  ["24/7", "online booking from your own page"],
  ["0", "apps for clients to download"],
  ["3", "ways to pay on one sale: cash, card, transfer"],
  ["1", "calendar for your whole team"],
];

function Facts() {
  return (
    <section className="border-t border-[#e5edf5]">
      <div className={cn(frame, "relative overflow-hidden")}>
        <div className={cn(inner, "pt-20 text-center lg:pt-28")}>
          <h2 className="v2-fade mx-auto max-w-[620px] text-[36px] font-light leading-[1.05] tracking-[-0.9px] sm:text-[56px] sm:tracking-[-1.4px]">
            Everything your salon runs on
          </h2>
        </div>
        <dl className="v2-fade mt-14 grid grid-cols-2 border-y border-[#e5edf5] lg:grid-cols-4">
          {FACTS.map(([value, label], index) => (
            <div
              key={label}
              className={cn(
                "px-5 py-8 text-center",
                index > 0 && "lg:border-l lg:border-[#e5edf5]",
                index % 2 === 1 && "border-l border-[#e5edf5]",
                index > 1 && "border-t border-[#e5edf5] lg:border-t-0",
              )}
            >
              <dt className="text-[40px] font-light leading-none tracking-[-0.96px] tabular-nums sm:text-[48px]">
                {value}
              </dt>
              <dd className="mx-auto mt-3 max-w-[200px] text-[14px] leading-[1.4] text-[#64748d]">
                {label}
              </dd>
            </div>
          ))}
        </dl>
        <DotBurst className="v2-fade mx-auto -mb-1 w-full max-w-[1100px]" />
      </div>
    </section>
  );
}

// ── Segments (Stripe's "Powering businesses of all sizes") ──

const SEGMENTS = [
  {
    id: "solo",
    title: "Run your chair like a business",
    cta: "Bookly for solo stylists",
    side: "Take bookings while you work, check clients out from your phone, and keep every client's notes in one place.",
    image: PHOTOS.braids,
    facts: [
      ["Booking page", "Share one link"],
      ["Checkout", "From your phone"],
      ["Clients", "Notes and history"],
    ],
  },
  {
    id: "growing",
    title: "Give a growing team one calendar",
    cta: "Bookly for salons",
    side: "Every stylist gets their own calendar and shifts. Clients choose who they book, and you see the whole day at once.",
    image: PHOTOS.hairSalon,
    facts: [
      ["Team", "Shifts and time off"],
      ["Gift cards", "Sell at the desk"],
      ["Promotions", "Promo codes and offers"],
    ],
  },
  {
    id: "large",
    title: "Keep a busy salon or spa in order",
    cta: "Bookly for large salons",
    side: "Commission, timesheets and pay runs, stock and suppliers, and reports across sales, bookings and your team.",
    image: PHOTOS.spa,
    facts: [
      ["Pay", "Commission and pay runs"],
      ["Stock", "Low-stock alerts"],
      ["Reports", "Sales, bookings, team"],
    ],
  },
];

function Sizes() {
  const [open, setOpen] = useState(0);
  return (
    <section id="sizes" className="scroll-mt-20 border-t border-[#e5edf5]">
      <div className={frame}>
        <div className={cn(inner, "pt-20 lg:pt-24")}>
          <h2 className={cn(h2Class, "v2-fade max-w-[640px]")}>
            Built for salons of every size.{" "}
            <span className="text-[#64748d]">Start on your own and grow into a team.</span>
          </h2>
        </div>
        <div className={cn(inner, "pb-20 pt-10 lg:pb-24")}>
          {SEGMENTS.map((segment, index) => {
            const isOpen = open === index;
            return (
              <div key={segment.id} className="border-t border-[#e5edf5] last:border-b">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(index)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span className={cn(h3Class, "transition-colors", !isOpen && "text-[#64748d]")}>
                    {segment.title}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-[4px] text-[18px] leading-none transition-colors",
                      isOpen ? "bg-[#533afd] text-white" : "bg-[#f0f2ff] text-[#533afd]",
                    )}
                    aria-hidden
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-500 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="grid gap-6 pb-8 lg:grid-cols-[1fr_1fr] lg:items-start">
                      <Link to="/auth" className={cn(buttonPrimary, "h-10 w-fit px-4 text-[14px]")}>
                        {segment.cta} <HoverArrow />
                      </Link>
                      <p className="text-[15px] leading-[1.4] text-[#64748d]">{segment.side}</p>
                    </div>
                    <div className="relative overflow-hidden rounded-[8px]">
                      <img
                        src={photo(segment.image, 1600)}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/7] w-full object-cover"
                      />
                    </div>
                    <dl className="grid grid-cols-3 gap-4 pb-8 pt-5 text-[14px]">
                      {segment.facts.map(([term, detail]) => (
                        <div key={term}>
                          <dt className="font-normal">{term}</dt>
                          <dd className="text-[#64748d]">{detail}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Dark band (Stripe's "infrastructure for every stack") ──

const SOURCES = [
  { label: "Your booking page", icon: Globe },
  { label: "Instagram bio", icon: InstagramLogo },
  { label: "WhatsApp status", icon: WhatsappLogo },
  { label: "QR code at the desk", icon: QrCode },
  { label: "Bookly marketplace", icon: Storefront },
];
const RUNS = ["Calendar", "Checkout", "Clients", "Team and pay", "Stock", "Reports"];

function Connected() {
  return (
    <section id="connected" className="scroll-mt-20 bg-[#0d1738] text-white">
      <div className={cn(frame, "border-[#182659]")}>
        <div className={cn(inner, "pt-20 lg:pt-24")}>
          <h2 className={cn(h2Class, "v2-fade max-w-[720px]")}>
            Bookings from everywhere, one place to run them.{" "}
            <span className="text-[#a3acc9]">
              Share your link wherever clients find you, and every booking lands in the same
              calendar.
            </span>
          </h2>
          <div className="v2-fade mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className={buttonPrimary}>
              Get started <HoverArrow />
            </Link>
            <Link
              to="/discover"
              className={cn(
                buttonSecondary,
                "border-[#3a4a7a] bg-transparent text-white hover:border-white",
              )}
            >
              See the marketplace
            </Link>
          </div>
        </div>

        {/* Diagram: where bookings come from → Bookly → what it runs. */}
        <div
          className={cn(
            inner,
            "v2-fade relative mt-16 grid items-center gap-8 pb-20 [background-image:radial-gradient(#22306a_1px,transparent_1px)] [background-size:18px_18px] lg:grid-cols-[1fr_auto_1fr] lg:pb-24",
          )}
        >
          <ul className="grid gap-2">
            {SOURCES.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-[6px] border border-[#2a3a74] bg-[#131f4a] px-4 py-3 text-[14px]"
              >
                <Icon size={18} className="text-[#a8b4ff]" />
                {label}
                <span className="ml-auto hidden h-px w-10 bg-gradient-to-r from-[#2a3a74] to-[#533afd] lg:block" />
              </li>
            ))}
          </ul>
          <div className="mx-auto flex size-28 flex-col items-center justify-center rounded-[16px] bg-[#533afd] shadow-[0_0_80px_rgba(83,58,253,0.55)]">
            <CalendarCheck size={34} weight="bold" />
            <span className="mt-1 text-[15px] font-semibold tracking-[-0.03em]">bookly</span>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {RUNS.map((label) => (
              <li
                key={label}
                className="rounded-[6px] border border-[#2a3a74] bg-[#131f4a] px-4 py-3 text-center text-[14px]"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className={cn(inner, "grid gap-10 border-t border-[#182659] py-16 sm:grid-cols-3")}>
          {[
            {
              icon: ChatsCircle,
              title: "Share it anywhere.",
              text: "Booking links and QR codes for any service, ready for Instagram, WhatsApp or print.",
            },
            {
              icon: LockKey,
              title: "Private by default.",
              text: "Your salon's data is only visible to you and the team members you invite.",
            },
            {
              icon: DeviceMobile,
              title: "Works on any device.",
              text: "Bookly runs in the browser on phones, tablets and computers. Nothing to install.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="v2-fade">
              <Icon size={22} className="text-[#a8b4ff]" />
              <p className="mt-4 text-[16px] leading-[1.4]">
                <span className="font-normal">{title}</span>{" "}
                <span className="text-[#a3acc9]">{text}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Carousel (Stripe's "What's happening") ──

const CRAFT = [
  {
    title: "Hair salons",
    text: "Colour, cuts and blow-dries across a team of stylists, each with their own calendar.",
    image: PHOTOS.hairSalon,
  },
  {
    title: "Barbers",
    text: "Walk-ins and bookings side by side, with quick checkout between chairs.",
    image: PHOTOS.barber,
  },
  {
    title: "Braiding",
    text: "Long appointments blocked out properly, so a four-hour style never gets double-booked.",
    image: PHOTOS.braids,
  },
  {
    title: "Nail salons",
    text: "Gel, acrylics and art with add-ons, and gift cards for the regulars who send friends.",
    image: PHOTOS.nails,
  },
  {
    title: "Lash and brow",
    text: "Fills and new sets on repeat, with clients rebooking themselves from their link.",
    image: PHOTOS.lashes,
  },
  {
    title: "Spas",
    text: "Treatments, packages and memberships, with rooms and therapists in one calendar.",
    image: PHOTOS.spa,
  },
  {
    title: "Makeup artists",
    text: "Bookings for events and bridal parties, with notes on every client.",
    image: PHOTOS.makeup,
  },
];

function Craft() {
  const [index, setIndex] = useState(0);
  const step = (dir: number) => setIndex((i) => (i + dir + CRAFT.length) % CRAFT.length);
  const current = CRAFT[index] as (typeof CRAFT)[number];
  const rest = [...CRAFT.slice(index + 1), ...CRAFT.slice(0, index)].slice(0, 4);
  return (
    <section id="craft" className="scroll-mt-20">
      <div className={frame}>
        <div className={cn(inner, "flex items-end justify-between gap-6 pt-20 lg:pt-24")}>
          <h2 className={cn(h2Class, "v2-fade")}>
            Made for your craft
            <span className="block text-[#64748d]">See how Bookly fits the way you work.</span>
          </h2>
          <div className="flex gap-2">
            {[
              { label: "Previous", dir: -1, Icon: ArrowLeft },
              { label: "Next", dir: 1, Icon: ArrowRight },
            ].map(({ label, dir, Icon }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onClick={() => step(dir)}
                className="flex size-9 items-center justify-center rounded-[4px] bg-[#f0f2ff] text-[#533afd] transition-colors hover:bg-[#533afd] hover:text-white"
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
        <div className={cn(inner, "grid gap-3 pt-10 lg:grid-cols-[2fr_1fr]")}>
          <div key={current.title} className="v2-rise relative overflow-hidden rounded-[8px]">
            <img
              src={photo(current.image, 1400)}
              alt=""
              className="aspect-[16/10] w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-6 left-6 text-[32px] font-light leading-[1.1] tracking-[-0.64px] text-white">
              {current.title}
            </p>
          </div>
          <div className="hidden gap-3 lg:grid lg:grid-cols-4">
            {rest.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setIndex(CRAFT.indexOf(item))}
                aria-label={`Show ${item.title}`}
                className="overflow-hidden rounded-[8px] transition-opacity hover:opacity-80"
              >
                <img
                  src={photo(item.image, 400)}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
        <div
          className={cn(
            inner,
            "flex flex-col justify-between gap-6 pb-20 pt-6 sm:flex-row sm:items-start lg:pb-24",
          )}
        >
          <p aria-live="polite" className="max-w-[620px] text-[16px] leading-[1.4]">
            <span className="font-normal">{current.title}.</span>{" "}
            <span className="text-[#64748d]">{current.text}</span>
          </p>
          <Link to="/auth" className={cn(buttonSecondary, buttonSmall, "shrink-0")}>
            Get started <HoverArrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Call to action ──

function GetStarted() {
  return (
    <section className="border-t border-[#e5edf5] bg-[#f8fafd]">
      <div className={cn(frame, "grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr]")}>
        <div className="px-5 py-16 sm:px-10 lg:py-20 lg:pl-[120px] lg:pr-0">
          <h2 className={h2Class}>Ready to get started?</h2>
          <p className={cn(bodyClass, "mt-4 max-w-[400px] text-[#64748d]")}>
            Create your account and set up your services, team and booking page today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className={buttonPrimary}>
              Start now <HoverArrow />
            </Link>
            <Link to="/auth" className={buttonSecondary}>
              Sign in
            </Link>
          </div>
        </div>
        {[
          {
            icon: CalendarCheck,
            title: "See what you'll pay",
            text: "Simple monthly plans per location.",
            link: "Pricing details",
            href: "/#pricing",
          },
          {
            icon: Storefront,
            title: "Booking an appointment?",
            text: "Find a salon near you and book in a few taps.",
            link: "Find a salon",
            href: "/discover",
          },
        ].map(({ icon: Icon, title, text, link, href }) => (
          <div key={title} className="px-5 pb-16 sm:px-10 lg:px-0 lg:py-20">
            <span className="flex size-8 items-center justify-center rounded-[6px] border border-[#e5edf5] bg-white text-[#533afd]">
              <Icon size={16} />
            </span>
            <p className="mt-4 text-[15px] font-normal">{title}</p>
            <p className="mt-1 max-w-[260px] text-[15px] leading-[1.4] text-[#64748d]">{text}</p>
            <a href={href} className={cn(linkClass, "mt-3 text-[15px] font-normal")}>
              {link} <HoverArrow />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Footer (light, like Stripe's) ──

const FOOTER = [
  {
    title: "Product",
    links: [
      ["Online booking", "#bento"],
      ["Calendar and team", "#bento"],
      ["Checkout", "#bento"],
      ["Gift cards and memberships", "#bento"],
      ["Marketplace", "#connected"],
      ["Reports", "#sizes"],
    ],
  },
  {
    title: "Solutions",
    links: [
      ["Solo stylists", "#sizes"],
      ["Growing salons", "#sizes"],
      ["Large salons and spas", "#sizes"],
      ["Hair salons", "#craft"],
      ["Barbers", "#craft"],
      ["Nail salons", "#craft"],
    ],
  },
  {
    title: "For clients",
    links: [
      ["Find a salon", "/discover"],
      ["Book an appointment", "/sign-in"],
      ["Create an account", "/create-account"],
    ],
  },
  {
    title: "Bookly",
    links: [
      ["Sign in", "/auth"],
      ["Get started", "/auth"],
      ["Pricing", "/#pricing"],
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-[#e5edf5] bg-[#f8fafd]">
      <div className={cn(frame, "grid grid-cols-2 lg:grid-cols-4")}>
        {FOOTER.map((col, index) => (
          <div
            key={col.title}
            className={cn(
              "px-5 py-12 sm:px-10 lg:py-16",
              index === 0 && "lg:pl-[120px]",
              index > 0 && "lg:border-l lg:border-[#e5edf5]",
            )}
          >
            <p className="text-[14px] font-normal">{col.title}</p>
            <ul className="mt-3 space-y-1.5">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-[14px] text-[#64748d] transition-colors hover:text-[#061b31]"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={cn(frame, "border-t border-t-[#e5edf5]")}>
        <div className={cn(inner, "flex flex-col gap-2 py-8 text-[14px]")}>
          <span className="flex items-center gap-1.5 text-[#533afd]">
            <Globe size={16} /> Nigeria (English)
          </span>
          <span className="text-[#64748d]">© {new Date().getFullYear()} Bookly</span>
        </div>
      </div>
    </footer>
  );
}
