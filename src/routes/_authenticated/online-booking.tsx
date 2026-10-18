import { createFileRoute } from "@tanstack/react-router";

import {
  BookingProfile,
  LinkBuilder,
  ReserveWithGoogle,
  SmartWebsite,
  SocialBookings,
} from "@/components/online-booking/online-booking-pages";

const TABS = ["profile", "google", "social", "links", "website"] as const;
type OnlineBookingTab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/online-booking")({
  validateSearch: (search: Record<string, unknown>): { tab?: OnlineBookingTab } =>
    typeof search["tab"] === "string" && (TABS as readonly string[]).includes(search["tab"])
      ? { tab: search["tab"] as OnlineBookingTab }
      : {},
  head: () => ({
    meta: [
      { title: "Online booking — Bookly" },
      { name: "description", content: "Your public booking page, booking links and QR codes." },
    ],
  }),
  component: OnlineBookingPage,
});

function OnlineBookingPage() {
  const { tab = "profile" } = Route.useSearch();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-[1088px] px-8 pb-10 pt-8">
        {tab === "links" ? (
          <LinkBuilder />
        ) : tab === "social" ? (
          <SocialBookings />
        ) : tab === "google" ? (
          <ReserveWithGoogle />
        ) : tab === "website" ? (
          <SmartWebsite />
        ) : (
          <BookingProfile />
        )}
      </div>
    </div>
  );
}
