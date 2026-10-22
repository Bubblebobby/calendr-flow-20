import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, ShareNetwork } from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  CustomerHeader,
  Rating,
  SalonVisual,
  solidPill,
  Stars,
} from "@/components/customer/customer-ui";
import { FavouriteButton } from "@/components/customer/favourites";
import { supabase } from "@/integrations/supabase/client";
import { useApplyBrand } from "@/lib/brand";
import { SalonLogo } from "@/components/customer/salon-logo";
import {
  formatClock,
  localDay,
  openWindowForWeekday,
  weekday,
  type OpeningHours,
} from "@/lib/booking-slots";
import { rememberRecent } from "@/lib/customer";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SkeletonHeader, SkeletonList } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/salon/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Salon — Bookly" },
      {
        name: "description",
        content: "See services, prices, opening times and reviews, and book online.",
      },
    ],
  }),
  component: SalonPage,
});

type Venue = {
  business: {
    id: string;
    name: string;
    currency: string;
    country: string;
    timezone: string;
    description: string | null;
    brand_color?: string | null;
    logo_path?: string | null;
    location: {
      address?: string;
      apt?: string;
      district?: string;
      city?: string;
      state?: string;
    } | null;
  };
  hours: OpeningHours[];
  categories: { id: string; name: string }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    category_id: string | null;
    pricing_type: string;
    price: number | null;
    duration: number;
  }[];
  team: {
    id: string;
    first_name: string;
    last_name: string | null;
    initials: string | null;
    color: string;
    job_title: string | null;
  }[];
};
type Reviews = {
  rating: number | null;
  count: number;
  reviews: {
    author: string;
    rating: number;
    comment: string | null;
    services: string | null;
    with: string | null;
    created_at: string;
  }[];
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

function SalonPage() {
  const { slug } = Route.useParams();
  const venue = useQuery({
    queryKey: ["booking-page", slug],
    retry: false,
    queryFn: async (): Promise<Venue | null> => {
      const { data, error } = await supabase.rpc("get_booking_page", { p_slug: slug });
      if (error) throw error;
      return (data as unknown as Venue | null) ?? null;
    },
  });
  const reviews = useQuery({
    queryKey: ["venue-reviews", slug],
    retry: false,
    queryFn: async (): Promise<Reviews | null> => {
      const { data, error } = await supabase.rpc("get_venue_reviews", { p_slug: slug });
      if (error) return null;
      return (data as unknown as Reviews | null) ?? null;
    },
  });

  useApplyBrand(venue.data?.business.brand_color);

  useEffect(() => {
    if (venue.data) {
      rememberRecent(venue.data.business.id);
      document.title = `${venue.data.business.name} — Bookly`;
    }
  }, [venue.data]);

  if (venue.isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerHeader />
        <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
          <SkeletonHeader actions={1} />
          <Skeleton className="h-48 w-full rounded-2xl sm:h-72" />
          <SkeletonList rows={5} label="Loading salon" />
        </div>
      </div>
    );
  }
  if (!venue.data) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerHeader />
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <p className="text-title font-semibold">This salon isn&apos;t available</p>
          <p className="mt-2 text-body text-muted-foreground">It may have paused online booking.</p>
          <Link to="/discover" className={cn(solidPill, "mt-6")}>
            Find another salon
          </Link>
        </div>
      </div>
    );
  }
  return <Salon slug={slug} venue={venue.data} reviews={reviews.data ?? null} />;
}

function Salon({ slug, venue, reviews }: { slug: string; venue: Venue; reviews: Reviews | null }) {
  const { business } = venue;
  const money = (n: number) => formatMoney(n, business.currency, business.country);
  const [category, setCategory] = useState<string | null>(null);
  const loc = business.location;
  const area = [loc?.district, loc?.city].filter(Boolean).join(", ");
  const address = [loc?.address, loc?.apt, loc?.district, loc?.city, loc?.state]
    .filter(Boolean)
    .join(", ");
  const open = openNow(venue.hours, business.timezone);
  const categories = venue.categories.filter((c) =>
    venue.services.some((s) => s.category_id === c.id),
  );
  const shown = category
    ? venue.services.filter((s) => s.category_id === category)
    : venue.services;
  const priceOf = (s: Venue["services"][number]) =>
    s.pricing_type === "free"
      ? "Free"
      : `${s.pricing_type === "from" ? "from " : ""}${money(Number(s.price ?? 0))}`;
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name}, ${address}`)}`
    : null;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: business.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // Share sheet dismissed.
    }
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      <CustomerHeader />
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
        <nav
          aria-label="Breadcrumb"
          className="mt-5 flex flex-wrap gap-1.5 text-caption text-muted-foreground"
        >
          <Link to="/discover" className="hover:text-foreground">
            Home
          </Link>
          {loc?.city ? (
            <>
              <span>·</span>
              <Link to="/discover" search={{ city: loc.city }} className="hover:text-foreground">
                {loc.city}
              </Link>
            </>
          ) : null}
          <span>·</span>
          <span className="text-foreground">{business.name}</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <SalonLogo path={business.logo_path} name={business.name} size={64} />
              <h1 className="text-[2rem] font-bold leading-tight sm:text-[2.5rem]">
                {business.name}
              </h1>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
              <Rating value={reviews?.rating ?? null} count={reviews?.count ?? 0} />
              <span className="text-muted-foreground">·</span>
              <span className={open.open ? "text-success" : "text-muted-foreground"}>
                {open.label}
              </span>
              {area ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{area}</span>
                </>
              ) : null}
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary"
                >
                  Get directions
                </a>
              ) : null}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Share"
              onClick={share}
              className="flex size-11 items-center justify-center rounded-full border border-border hover:bg-secondary"
            >
              <ShareNetwork size={20} />
            </button>
            <FavouriteButton businessId={business.id} />
          </div>
        </div>

        <SalonVisual name={business.name} className="mt-6 h-48 w-full rounded-2xl sm:h-72" />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-12">
            <section id="services">
              <h2 className="text-display font-semibold">Services</h2>
              {categories.length > 1 ? (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {[{ id: null, name: "All" }, ...categories].map((c) => (
                    <button
                      key={c.id ?? "all"}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={cn(
                        "h-10 shrink-0 rounded-full px-4 text-body font-medium",
                        category === c.id
                          ? "bg-ink text-ink-foreground"
                          : "bg-secondary hover:bg-secondary/70",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <ul className="mt-4 space-y-3">
                {shown.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-4 rounded-xl p-4 shadow-[inset_0_0_0_1px_var(--color-border)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-heading font-semibold">{s.name}</p>
                      <p className="text-caption text-muted-foreground">
                        {formatDuration(s.duration)}
                      </p>
                      {s.description ? (
                        <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">
                          {s.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-body font-semibold">{priceOf(s)}</p>
                    </div>
                    <a
                      href={`/book/${slug}?services=${s.id}`}
                      className="inline-flex h-9 items-center rounded-full border border-input px-4 text-body font-semibold hover:bg-secondary"
                    >
                      Book
                    </a>
                  </li>
                ))}
                {shown.length === 0 ? (
                  <li className="text-body text-muted-foreground">
                    No services to book online yet.
                  </li>
                ) : null}
              </ul>
            </section>

            {venue.team.length ? (
              <section>
                <h2 className="text-display font-semibold">Team</h2>
                <ul className="mt-4 flex flex-wrap gap-6">
                  {venue.team.map((t) => (
                    <li key={t.id} className="w-24 text-center">
                      <span
                        className="mx-auto flex size-20 items-center justify-center rounded-full text-title font-semibold"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.initials || t.first_name[0]}
                      </span>
                      <p className="mt-2 truncate text-body font-semibold">{[t.first_name, t.last_name].filter(Boolean).join(" ")}</p>
                      {t.job_title ? (
                        <p className="truncate text-caption text-muted-foreground">{t.job_title}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h2 className="text-display font-semibold">Reviews</h2>
              {reviews && reviews.count > 0 ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-[2.5rem] font-bold leading-none">
                      {Number(reviews.rating).toFixed(1)}
                    </span>
                    <span>
                      <Stars value={Number(reviews.rating)} size={20} />
                      <span className="block text-caption text-muted-foreground">
                        {reviews.count} {reviews.count === 1 ? "review" : "reviews"}
                      </span>
                    </span>
                  </div>
                  <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                    {reviews.reviews.map((r, index) => (
                      <li key={index}>
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-body font-semibold text-primary">
                            {r.author[0]}
                          </span>
                          <span>
                            <span className="block text-body font-semibold">{r.author}</span>
                            <span className="block text-caption text-muted-foreground">
                              {new Intl.DateTimeFormat("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }).format(new Date(r.created_at))}
                            </span>
                          </span>
                        </div>
                        <Stars value={r.rating} size={14} />
                        {r.comment ? (
                          <p className="mt-1 whitespace-pre-line text-body">{r.comment}</p>
                        ) : null}
                        {r.services ? (
                          <p className="mt-1 text-caption text-muted-foreground">
                            {r.services}
                            {r.with ? ` · with ${r.with}` : ""}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-body text-muted-foreground">
                  No reviews yet. Clients can review after their visit.
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-8 lg:sticky lg:top-24 lg:h-fit">
            {business.description ? (
              <section>
                <h2 className="text-title font-semibold">About</h2>
                <p className="mt-2 whitespace-pre-line text-body text-muted-foreground">
                  {business.description}
                </p>
              </section>
            ) : null}
            <section>
              <h2 className="text-title font-semibold">Opening times</h2>
              <ul className="mt-3 space-y-2">
                {ORDER.map((d) => {
                  const w = openWindowForWeekday(venue.hours, d);
                  const today = d === open.weekday;
                  return (
                    <li
                      key={d}
                      className={cn("flex justify-between text-body", today && "font-semibold")}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn("size-2 rounded-full", w ? "bg-success" : "bg-border")}
                        />
                        {DAYS[d]}
                      </span>
                      <span className={w ? "" : "text-muted-foreground"}>
                        {w ? `${formatClock(w.from)} – ${formatClock(w.to)}` : "Closed"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
            {address ? (
              <section>
                <h2 className="text-title font-semibold">Location</h2>
                <p className="mt-2 flex gap-2 text-body text-muted-foreground">
                  <MapPin size={20} className="shrink-0" /> {address}
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-8">
          <span className="min-w-0">
            <span className="block truncate text-heading font-semibold">{business.name}</span>
            <span className="text-caption text-muted-foreground">
              {venue.services.length} {venue.services.length === 1 ? "service" : "services"}{" "}
              available
            </span>
          </span>
          <a href={`/book/${slug}`} className={cn(solidPill, "h-12 px-8 text-heading")}>
            Book now
          </a>
        </div>
      </div>
    </div>
  );
}

/** "Open until 17:00", "Opens at 10:00" or "Closed today", in the salon's own time zone. */
function openNow(hours: OpeningHours[], timeZone: string) {
  const day = weekday(localDay(timeZone));
  const w = openWindowForWeekday(hours, day);
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .format(new Date())
    .split(":")
    .map(Number);
  const now = (h ?? 0) * 60 + (m ?? 0);
  if (!w) return { open: false, label: "Closed today", weekday: day };
  if (now < w.from) return { open: false, label: `Opens at ${formatClock(w.from)}`, weekday: day };
  if (now >= w.to) return { open: false, label: "Closed now", weekday: day };
  return { open: true, label: `Open until ${formatClock(w.to)}`, weekday: day };
}
