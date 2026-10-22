import { Fragment, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarBlank,
  CalendarCheck,
  CaretDown,
  ChartLineUp,
  ChatCircleText,
  CheckCircle,
  CreditCard,
  Gift,
  Globe,
  Package,
  Plus,
  Receipt,
  Repeat,
  Storefront,
  Tag,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/*
 * Bookly's marketing homepage, laid out like Square's Appointments page (measured at 1440 wide):
 * 60px side margins, a two-level header with a sticky product bar, serif display headings over
 * Inter, a mono eyebrow, 10px-rounded media, blue pill buttons, a pricing band on warm grey, an
 * FAQ, a closing call to action and a black footer. Copy and product mock-ups are Bookly's own.
 */

const BLUE = "#006aff";

const photo = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?w=${width}&q=80&auto=format&fit=crop`;

const PHOTOS = {
  hero: "photo-1609535895148-cf9f5c446290",
  scheduling: "photo-1687422808328-11cf750a5051",
  payments: "photo-1694000682374-f6d5bf8be8a3",
  reminders: "photo-1632828172055-942e6b7dd511",
  newClients: "photo-1632828167055-126c0c57ecff",
  barber: "photo-1686671805337-7d8aa64b965f",
  hairSalon: "photo-1729005732908-de02acdeca5d",
  braids: "photo-1757866332992-723bf8d6169c",
  nails: "photo-1632765866070-3fadf25d3d5b",
  lashes: "photo-1772236617396-2f8460293c07",
  spa: "photo-1600334089648-b0d9d3028eb2",
  makeup: "photo-1655215081879-0ac1f535b575",
};

const wrap = "mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-[60px]";
const serif = "font-display font-[450]";
const eyebrow = "font-mono text-[13px] uppercase tracking-[0.08em]";

const pillBase =
  "inline-flex h-[47px] items-center justify-center whitespace-nowrap rounded-full px-5 text-[18px] font-medium leading-[27px] transition-[background-color,color,box-shadow,transform] duration-200 ease-out motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97]";
const pillSolid = cn(
  pillBase,
  "bg-[#006aff] text-white hover:bg-[#0055cc] hover:shadow-[0_8px_20px_-6px_rgba(0,106,255,0.55)]",
);
const pillOutline = cn(
  pillBase,
  "border border-[#006aff] text-[#006aff] hover:bg-[#006aff] hover:text-white",
);

// Hover: an underline that sweeps in from the left.
const sweep =
  "bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat pb-0.5 transition-[background-size,color] duration-300 ease-out hover:bg-[length:100%_1px]";

// Photos drift in slightly when their card is hovered.
const photoZoom =
  "transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-safe:group-hover:scale-[1.04]";

export function HomePage() {
  return (
    <div className="site-home min-h-screen bg-white font-sans text-[#101010] antialiased">
      <SiteHeader />
      <main>
        <Hero />
        <FeatureRow
          id="features"
          title="Say goodbye to double bookings"
          text="One calendar for the whole salon. Clients book themselves online at any hour, and Bookly keeps every stylist's chair, break and day off in order."
          image={PHOTOS.scheduling}
          mock={<CalendarMock compact />}
          features={[
            {
              icon: CalendarBlank,
              title: "A calendar that fits your day",
              text: "See every stylist side by side. Drag to move, tap to rebook, and block out lunch or time off.",
            },
            {
              icon: Globe,
              title: "Online booking, 24/7",
              text: "Share your booking link on Instagram and WhatsApp. Clients pick a service, a stylist and a time.",
            },
            {
              icon: Repeat,
              title: "Repeat bookings in a tap",
              text: "Set up regular clients once — every fortnight, every month — and the slots stay theirs.",
            },
          ]}
        />
        <FeatureRow
          reverse
          title="Get paid for every appointment"
          text="Check clients out in seconds at the desk, take deposits online, and stop losing money to no-shows."
          image={PHOTOS.payments}
          mock={<CheckoutMock />}
          features={[
            {
              icon: Receipt,
              title: "Fast checkout",
              text: "Services, products and tips on one sale. Split it across cash, card and transfer.",
            },
            {
              icon: Wallet,
              title: "Deposits and no-show rules",
              text: "Ask for a deposit when clients book online, so a missed appointment isn't a lost day.",
            },
            {
              icon: Gift,
              title: "Gift cards and packages",
              text: "Sell gift cards, bundles and memberships that clients redeem at checkout.",
            },
          ]}
        />
        <FeatureRow
          title="Reminders that go out on their own"
          text="Bookly confirms every booking and reminds clients before they're due, so you spend less time on the phone and more time with clients."
          image={PHOTOS.reminders}
          mock={<ReminderMock />}
          features={[
            {
              icon: Bell,
              title: "Automatic reminders",
              text: "Confirmations and reminders are sent for you, with a link to reschedule if plans change.",
            },
            {
              icon: ChatCircleText,
              title: "Client notes and history",
              text: "Allergies, colour formulas and past visits are on every client's card.",
            },
            {
              icon: UsersThree,
              title: "Waitlist",
              text: "When a slot opens up, the next client on the waitlist hears about it first.",
            },
          ]}
        />
        <FeatureRow
          reverse
          title="Find new clients in new ways"
          text="Get listed on the Bookly marketplace, where people nearby search for salons and book straight into your calendar."
          image={PHOTOS.newClients}
          mock={<ListingMock />}
          features={[
            {
              icon: Storefront,
              title: "Your own salon page",
              text: "Photos, services, prices and opening hours on a page clients can book from.",
            },
            {
              icon: Tag,
              title: "Promotions",
              text: "Run promo codes and offers to fill quiet days and bring regulars back.",
            },
            {
              icon: ChartLineUp,
              title: "Know what's working",
              text: "Reports on bookings, sales and your team show where the money comes from.",
            },
          ]}
        />
        <ManageSlider />
        <BusinessTypes />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * A heading that rises in word by word: as it scrolls into view (driven by its own scroll
 * position, see .site-words in styles.css), or straight away on load for the hero.
 */
function Words({ text, onLoad }: { text: string; onLoad?: boolean }) {
  return (
    <span className={cn("block", onLoad ? "site-words-load" : "site-words")}>
      {text.split(" ").map((word, index) => (
        <Fragment key={index}>
          {index > 0 ? " " : null}
          <span className="site-word" style={{ "--i": index } as CSSProperties}>
            {word}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

// ── Header ──

function Logo({ inverted }: { inverted?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Bookly home">
      <span
        className={cn(
          "flex size-[26px] items-center justify-center rounded-[5px]",
          inverted ? "bg-white text-[#101010]" : "bg-[#101010] text-white",
        )}
      >
        <CalendarCheck size={17} weight="bold" />
      </span>
      <span
        className={cn(
          "text-[22px] font-semibold tracking-[-0.02em]",
          inverted ? "text-white" : "text-[#101010]",
        )}
      >
        Bookly
      </span>
    </Link>
  );
}

const SECTIONS = [
  ["Overview", "#top"],
  ["Features", "#features"],
  ["Business types", "#business-types"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
] as const;

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
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
              <a href="#features" className={sweep}>
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
      <div className="sticky top-0 z-40 border-b border-[#f0f0f0] bg-white/95 backdrop-blur">
        <div className={cn(wrap, "flex h-[72px] items-center justify-between gap-3 sm:gap-6")}>
          <div className="flex items-center gap-8">
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
            <nav className="hidden items-center gap-7 text-[15px] lg:flex">
              <a href="#top" className={cn(sweep, "font-medium")}>
                Overview
              </a>
              <a href="#features" className={cn(sweep, "text-[#666] hover:text-[#101010]")}>
                Features
              </a>
              <a href="#business-types" className={cn(sweep, "text-[#666] hover:text-[#101010]")}>
                Business types
              </a>
              <a href="#pricing" className={cn(sweep, "text-[#666] hover:text-[#101010]")}>
                Pricing
              </a>
              <a href="#faq" className={cn(sweep, "text-[#666] hover:text-[#101010]")}>
                FAQ
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#pricing"
              className={cn(pillOutline, "hidden h-10 px-4 text-[15px] sm:inline-flex")}
            >
              See pricing
            </a>
            <Link to="/auth" className={cn(pillSolid, "h-10 px-4 text-[15px]")}>
              Get started
            </Link>
          </div>
        </div>
        <nav
          id="site-menu"
          hidden={!menuOpen}
          className="absolute inset-x-0 top-full border-b border-[#f0f0f0] bg-white shadow-[0_16px_30px_-20px_rgba(0,0,0,0.25)] lg:hidden"
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

function Hero() {
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
        Bookly brings online booking, your calendar, checkout, reminders and your team together —
        built for salons, barbers, spas and studios.
      </p>
      <div className="site-fade-load mt-8 flex flex-wrap gap-3" style={{ animationDelay: "600ms" }}>
        <a href="#pricing" className={pillOutline}>
          See pricing
        </a>
        <Link to="/auth" className={pillSolid}>
          Get started free
        </Link>
      </div>

      <div className="group relative mt-12 overflow-hidden rounded-[10px] bg-[#e9e4de] lg:mt-16">
        <img
          src={photo(PHOTOS.hero, 2000)}
          alt="A client relaxing after a treatment"
          className={cn(
            photoZoom,
            "aspect-[4/5] w-full object-cover sm:aspect-[16/9] lg:aspect-[1320/680]",
          )}
          fetchPriority="high"
        />
        <div className="absolute inset-x-4 bottom-4 transition-transform duration-500 ease-out motion-safe:group-hover:-translate-y-2 sm:inset-x-auto sm:bottom-10 sm:right-10 sm:w-[560px]">
          <CalendarMock />
        </div>
      </div>
    </section>
  );
}

// ── Feature rows ──

type Feature = { icon: typeof Bell; title: string; text: string };

function FeatureRow({
  id,
  title,
  text,
  image,
  mock,
  features,
  reverse,
}: {
  id?: string;
  title: string;
  text: string;
  image: string;
  mock: ReactNode;
  features: Feature[];
  reverse?: boolean;
}) {
  return (
    <section id={id} className={cn(wrap, "scroll-mt-24 pt-24 lg:pt-36")}>
      <div className="grid items-center gap-10 lg:grid-cols-[433px_1fr] lg:gap-5">
        <div className={cn(reverse && "lg:order-2 lg:pl-10")}>
          <h2 className={cn(serif, "text-[36px] leading-[1.1] tracking-[-0.5px] lg:text-[48px]")}>
            <Words text={title} />
          </h2>
          <p className="site-fade mt-5 text-base leading-6 text-[#666]">{text}</p>
          <ArrowLink className="site-fade mt-3">Get started</ArrowLink>
        </div>
        <div className="site-reveal group relative overflow-hidden rounded-[10px] bg-[#f7f6f5]">
          <img
            src={photo(image, 1400)}
            alt=""
            loading="lazy"
            className={cn(photoZoom, "aspect-[4/3] w-full object-cover lg:aspect-[867/578]")}
          />
          <div className="absolute bottom-4 hidden transition-transform duration-500 ease-out motion-safe:group-hover:-translate-y-2 sm:inset-x-auto sm:bottom-8 sm:right-8 sm:block sm:w-[340px]">
            {mock}
          </div>
        </div>
      </div>

      <div className="site-reveal mt-14 grid gap-8 sm:grid-cols-3 sm:gap-5">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="group relative border-t border-[#dadada] pt-6">
            {/* A dark line draws across the top rule on hover. */}
            <span className="absolute -top-px left-0 h-px w-0 bg-[#101010] transition-[width] duration-500 ease-out group-hover:w-full" />
            <Icon
              size={28}
              weight="regular"
              className="transition-[color,transform] duration-300 ease-out group-hover:text-[#006aff] motion-safe:group-hover:-translate-y-1"
            />
            <h3 className="mt-4 text-base font-medium leading-6">{title}</h3>
            <p className="mt-2 text-base leading-6 text-[#666]">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── "Run every part of your salon" slider ──

const MANAGE = [
  {
    title: "Your team",
    text: "Rotas, commission, tips and pay runs, with access levels for owners, admins and staff.",
    icon: UsersThree,
    link: "Explore team tools",
  },
  {
    title: "Your stock",
    text: "Track retail and back-bar products, get low-stock alerts and send orders to suppliers.",
    icon: Package,
    link: "Explore inventory",
  },
  {
    title: "Your clients",
    text: "Every visit, note, gift card and package in one place, with clients who can book again in a tap.",
    icon: ChatCircleText,
    link: "Explore client tools",
  },
  {
    title: "Your numbers",
    text: "Daily takings, best sellers and who's busiest — reports that make sense at a glance.",
    icon: ChartLineUp,
    link: "Explore reports",
  },
];

function ManageSlider() {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };
  return (
    <section className="pt-24 lg:pt-36">
      <div className={cn(wrap, "flex items-end justify-between gap-6")}>
        <h2
          className={cn(
            serif,
            "max-w-[900px] text-[44px] leading-[1.02] tracking-[-1.5px] lg:text-[72px] lg:tracking-[-2.88px]",
          )}
        >
          <Words text="Run every part of your salon" />
        </h2>
        <div className="hidden gap-2 sm:flex">
          <SliderButton label="Previous" onClick={() => scroll(-1)}>
            <ArrowLeft size={20} />
          </SliderButton>
          <SliderButton label="Next" onClick={() => scroll(1)}>
            <ArrowRight size={20} />
          </SliderButton>
        </div>
      </div>
      <div
        ref={track}
        className="site-reveal mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:scroll-px-8 sm:px-8 lg:scroll-px-[60px] lg:px-[max(60px,calc((100vw-1320px)/2))]"
      >
        {MANAGE.map(({ title, text, icon: Icon, link }) => (
          <article
            key={title}
            className="group flex w-[85vw] shrink-0 snap-start flex-col justify-between rounded-[10px] bg-[#f7f6f5] p-8 transition-colors duration-300 hover:bg-[#efebe6] sm:w-[560px] lg:h-[460px] lg:p-10"
          >
            <div>
              <h3 className="text-[32px] font-medium leading-[1.1] tracking-[-0.8px] lg:text-[40px]">
                {title}
              </h3>
              <p className="mt-4 max-w-[400px] text-base leading-6 text-[#666]">{text}</p>
              <ArrowLink className="mt-3">{link}</ArrowLink>
            </div>
            <div className="mt-10 flex size-16 items-center justify-center rounded-full bg-white transition-[background-color,color,transform] duration-300 ease-out group-hover:bg-[#006aff] group-hover:text-white motion-safe:group-hover:scale-110">
              <Icon size={30} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SliderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full border border-[#dadada] transition-[background-color,border-color,color,transform] duration-200 hover:border-[#101010] hover:bg-[#101010] hover:text-white motion-safe:active:scale-90"
    >
      {children}
    </button>
  );
}

/** "Get started →": underlined text whose arrow slides on hover. */
function ArrowLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Link
      to="/auth"
      className={cn(
        "group inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors hover:text-[#006aff]",
        className,
      )}
    >
      <span className="underline decoration-1 underline-offset-4">{children}</span>
      <ArrowRight
        size={16}
        className="transition-transform duration-300 ease-out motion-safe:group-hover:translate-x-1"
      />
    </Link>
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
      <h2
        className={cn(
          wrap,
          serif,
          "text-[44px] leading-[1.02] tracking-[-1.5px] lg:text-[72px] lg:tracking-[-2.88px]",
        )}
      >
        <Words text="Built for your craft" />
      </h2>
      <div className="site-reveal mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:scroll-px-8 sm:px-8 lg:scroll-px-[60px] lg:px-[max(60px,calc((100vw-1320px)/2))]">
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
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 transition-opacity duration-500" />
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

// ── Pricing ──

// TODO(prices): plan names, prices and features are placeholders until the real ones are in.
// Don't merge to main with these.
const PLANS = [
  {
    name: "Starter",
    blurb: "For independent stylists getting set up.",
    price: "₦TBC",
    cta: "Get started",
    features: [
      "Online booking page",
      "Calendar for 1 team member",
      "Automatic reminders",
      "Checkout and receipts",
    ],
  },
  {
    name: "Growth",
    blurb: "For busy salons with a growing team.",
    price: "₦TBC",
    cta: "Get started",
    featured: true,
    features: [
      "Everything in Starter",
      "Up to 10 team members",
      "Deposits and no-show rules",
      "Gift cards, packages and promotions",
      "Stock and supplier orders",
    ],
  },
  {
    name: "Pro",
    blurb: "For multi-chair salons and spas.",
    price: "₦TBC",
    cta: "Contact us",
    features: [
      "Everything in Growth",
      "Unlimited team members",
      "Commission and pay runs",
      "Advanced reports",
      "Priority support",
    ],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="mt-24 scroll-mt-24 bg-[#f7f6f5] py-20 lg:mt-36 lg:py-28">
      <div className={wrap}>
        <h2
          className={cn(
            serif,
            "text-[44px] leading-[1.02] tracking-[-1.5px] lg:text-[72px] lg:tracking-[-2.88px]",
          )}
        >
          <Words text="Pricing that grows with you" />
        </h2>
        <p className="site-fade mt-5 max-w-[620px] text-base leading-6 text-[#666]">
          Start free for 14 days. No card needed, and you can change plans at any time.
        </p>
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
                      "rounded-full bg-[#e5f0ff] px-3 py-1 text-[11px] text-[#006aff]",
                    )}
                  >
                    Best value
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-base leading-6 text-[#666]">{plan.blurb}</p>
              <p className="mt-8 flex items-baseline gap-1">
                <span className="text-[56px] font-medium leading-none tracking-[-1.68px]">
                  {plan.price}
                </span>
                <span className="text-base text-[#666]">/mo.</span>
              </p>
              <p className="mt-2 text-sm text-[#666]">per location</p>
              <Link
                to="/auth"
                className={cn(plan.featured ? pillSolid : pillOutline, "mt-8 w-full")}
              >
                {plan.cta}
              </Link>
              <p className="mt-10 text-sm font-medium">What's included</p>
              <ul className="mt-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex gap-3 border-b border-[#f0f0f0] py-3 text-base leading-6 last:border-0"
                  >
                    <CheckCircle
                      size={20}
                      weight="fill"
                      className="mt-0.5 shrink-0"
                      style={{ color: BLUE }}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ──

const FAQS = [
  {
    q: "How long does it take to set up?",
    a: "Most salons are taking bookings the same day. Add your services, prices and team, then share your booking link.",
  },
  {
    q: "Can clients book without downloading an app?",
    a: "Yes. Clients book from your link in any browser. They can create a free account to see their bookings and book again faster.",
  },
  {
    q: "Can I bring my clients from another booking system?",
    a: "Yes. Import your client list from a spreadsheet, and our team can help you move over from other systems.",
  },
  {
    q: "Do my staff get their own logins?",
    a: "Yes. Invite your team by email. Staff see their own calendar and checkout; admins and owners see everything.",
  },
  {
    q: "How do reminders work?",
    a: "Bookly sends a confirmation when a booking is made and a reminder before it's due, with a link to reschedule or cancel within your rules.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. There are no contracts. You can change or cancel your plan whenever you like.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className={cn(wrap, "scroll-mt-24 pt-20 lg:pt-28")}>
      <div className="grid gap-8 lg:grid-cols-[433px_1fr] lg:gap-5">
        <h2 className={cn(serif, "text-[40px] leading-[45px]")}>
          <Words text="FAQ" />
        </h2>
        <ul className="site-reveal border-t border-[#dadada]">
          {FAQS.map((item, index) => {
            const isOpen = open === index;
            return (
              <li key={item.q} className="border-b border-[#dadada]">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="group flex w-full items-center justify-between gap-6 py-5 text-left text-base font-medium leading-6"
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
                  <p className="overflow-hidden pr-12 text-base leading-6 text-[#666]">
                    <span className="block pb-6">{item.a}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
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
      ["Features", "#features"],
      ["Pricing", "#pricing"],
      ["Online booking", "#features"],
      ["Find a salon", "/discover"],
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
      ["Create an account", "/sign-in?mode=signup"],
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

// ── Product mock-ups laid over the photos ──

function MockCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[12px] bg-white p-4 text-[#101010] shadow-[0_12px_40px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const CAL_TEAM = ["Ada", "Tolu", "Chi"];
const CAL_SLOTS = [
  {
    col: 0,
    top: 0,
    h: 2,
    name: "Funmi O.",
    svc: "Silk press",
    tone: "bg-[#dbe8ff] text-[#0b3d91]",
  },
  {
    col: 1,
    top: 0,
    h: 3,
    name: "Kemi A.",
    svc: "Knotless braids",
    tone: "bg-[#fdf3e2] text-[#8a5300]",
  },
  { col: 2, top: 1, h: 1, name: "Ngozi E.", svc: "Gel nails", tone: "bg-[#e6f5ea] text-[#1f6b35]" },
  { col: 0, top: 2, h: 1, name: "Bisi K.", svc: "Trim", tone: "bg-[#fdecef] text-[#9b1c3a]" },
  { col: 2, top: 2, h: 2, name: "Amaka N.", svc: "Lash fill", tone: "bg-[#dbe8ff] text-[#0b3d91]" },
];

function CalendarMock({ compact }: { compact?: boolean }) {
  const rowH = compact ? 34 : 38;
  return (
    <MockCard>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">Today · Thu 22 Oct</p>
        <span className="flex items-center gap-1 rounded-full bg-[#101010] px-2.5 py-1 text-[11px] font-medium text-white">
          <Plus size={10} weight="bold" /> New
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[34px_1fr_1fr_1fr] gap-x-1.5">
        <span />
        {CAL_TEAM.map((name) => (
          <span key={name} className="pb-1.5 text-[11px] font-medium text-[#666]">
            {name}
          </span>
        ))}
        <div className="flex flex-col text-[10px] text-[#959595]">
          {["9:00", "10:00", "11:00", "12:00"].map((t) => (
            <span key={t} style={{ height: rowH }}>
              {t}
            </span>
          ))}
        </div>
        {CAL_TEAM.map((_, col) => (
          <div
            key={col}
            className="relative border-l border-[#f0f0f0]"
            style={{ height: rowH * 4 }}
          >
            {CAL_SLOTS.filter((s) => s.col === col).map((s) => (
              <div
                key={s.name}
                className={cn(
                  "absolute inset-x-1 overflow-hidden rounded-[5px] px-1.5 py-1",
                  s.tone,
                )}
                style={{ top: s.top * rowH + 2, height: s.h * rowH - 4 }}
              >
                <p className="truncate text-[10px] font-semibold">{s.name}</p>
                <p className="truncate text-[9px] opacity-80">{s.svc}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </MockCard>
  );
}

function CheckoutMock() {
  return (
    <MockCard>
      <p className="text-[13px] font-semibold">Checkout · Kemi A.</p>
      <ul className="mt-3 space-y-2 text-[12px]">
        {[
          ["Knotless braids", "₦35,000"],
          ["Edge control", "₦4,500"],
          ["Tip", "₦3,000"],
        ].map(([item, price]) => (
          <li key={item} className="flex justify-between">
            <span className="text-[#666]">{item}</span>
            <span className="tabular-nums">{price}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-[#f0f0f0] pt-3 text-[14px] font-semibold">
        <span>Total</span>
        <span className="tabular-nums">₦42,500</span>
      </div>
      <div
        className="mt-3 flex items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-medium text-white"
        style={{ background: BLUE }}
      >
        <CreditCard size={15} /> Take payment
      </div>
    </MockCard>
  );
}

function ReminderMock() {
  return (
    <div className="space-y-2">
      <MockCard className="p-3">
        <div className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#101010] text-white">
            <CalendarCheck size={16} weight="bold" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold">Reminder: tomorrow at 10:30</p>
            <p className="text-[11px] leading-4 text-[#666]">
              Hi Ngozi, see you tomorrow for Gel nails with Chi at Glow Studio, Lekki.
            </p>
          </div>
        </div>
      </MockCard>
      <MockCard className="flex items-center gap-2 p-3">
        <CheckCircle size={18} weight="fill" className="text-[#1f8a3e]" />
        <p className="text-[12px] font-medium">Ngozi confirmed her appointment</p>
      </MockCard>
    </div>
  );
}

function ListingMock() {
  return (
    <MockCard className="p-0">
      <div className="p-4">
        <p className="text-[14px] font-semibold">Glow Studio</p>
        <p className="text-[11px] text-[#666]">Lekki Phase 1, Lagos · ★ 4.9 (212)</p>
      </div>
      <ul className="border-t border-[#f0f0f0]">
        {[
          ["Silk press", "1 hr", "₦18,000"],
          ["Knotless braids", "4 hr", "₦35,000"],
          ["Gel nails", "45 min", "₦12,000"],
        ].map(([svc, dur, price]) => (
          <li
            key={svc}
            className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-2.5 last:border-0"
          >
            <div>
              <p className="text-[12px] font-medium">{svc}</p>
              <p className="text-[10px] text-[#959595]">{dur}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] tabular-nums">{price}</span>
              <span className="rounded-full border border-[#dadada] px-2.5 py-0.5 text-[11px] font-medium">
                Book
              </span>
            </div>
          </li>
        ))}
      </ul>
    </MockCard>
  );
}
