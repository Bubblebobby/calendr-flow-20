import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChartLine,
  ChatsCircle,
  CreditCard,
  Door,
  GlobeSimple,
  GoogleLogo,
  Headset,
  Heart,
  Plugs,
  Star,
  UsersFour,
  X,
} from "@phosphor-icons/react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { pillButton } from "@/components/sales/list-ui";
import { cn } from "@/lib/utils";

type AddOn = {
  key: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  status?: "Included" | "Coming soon";
  /** Where to go for features Bookly already has. */
  to?: { to: string; search?: Record<string, string> };
};

const ADD_ONS: AddOn[] = [
  { key: "payments", title: "Payments", body: "Take card payments online and in your salon, with payouts straight to your bank.", icon: <CreditCard size={28} />, status: "Coming soon" },
  { key: "insights", title: "Insights", body: "Sales, appointment, team and client reports, plus a performance dashboard.", icon: <ChartLine size={28} />, status: "Included", to: { to: "/reports" } },
  { key: "google-boost", title: "Google rating boost", body: "Ask happy clients for a Google review after their visit.", icon: <Star size={28} />, status: "Coming soon" },
  { key: "loyalty", title: "Client loyalty", body: "Reward repeat visits with points and offers that bring clients back.", icon: <Heart size={28} />, status: "Included", to: { to: "/clients", search: { tab: "loyalty" } } },
  { key: "client-connect", title: "Client messaging", body: "Two-way messaging with clients from one shared inbox.", icon: <ChatsCircle size={28} />, status: "Coming soon" },
  { key: "website", title: "Smart website", body: "A website that updates itself as your services and team change.", icon: <GlobeSimple size={28} />, status: "Coming soon", to: { to: "/online-booking", search: { tab: "website" } } },
  { key: "team-connect", title: "Team chat", body: "Group chats and file sharing for your team.", icon: <UsersFour size={28} />, status: "Coming soon" },
  { key: "resources", title: "Bookable resources", body: "Manage rooms and equipment, and assign them to services.", icon: <Door size={28} />, status: "Coming soon" },
  { key: "support", title: "Priority support", body: "Hands-on help from people who know salons.", icon: <Headset size={28} />, status: "Coming soon" },
];

const INTEGRATIONS: AddOn[] = [
  { key: "google-reserve", title: "Reserve with Google", body: "Let clients book from Google Search and Maps.", icon: <GoogleLogo size={28} />, status: "Coming soon", to: { to: "/online-booking", search: { tab: "google" } } },
  { key: "social", title: "Facebook and Instagram bookings", body: "Add a Book now button to your social pages.", icon: <GlobeSimple size={28} />, status: "Coming soon", to: { to: "/online-booking", search: { tab: "social" } } },
  { key: "accounting", title: "Accounting", body: "Send your sales to your accounting software.", icon: <Plugs size={28} />, status: "Coming soon" },
  { key: "analytics", title: "Google Analytics", body: "Track booking page visits and conversions.", icon: <ChartLine size={28} />, status: "Coming soon" },
];

export function AddOnsPage({ tab }: { tab: "add-ons" | "integrations" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState<AddOn | null>(null);
  const items = tab === "integrations" ? INTEGRATIONS : ADD_ONS;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display font-semibold">Bookly add-ons</h1>
        <p className="mt-1 text-body text-muted-foreground">Take your business to the next level with add-ons.</p>
      </div>
      <div className="flex gap-2">
        {(["add-ons", "integrations"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate({ to: "/add-ons", search: key === "add-ons" ? {} : { tab: key } })}
            className={cn("h-9 rounded-full px-4 text-body font-medium", tab === key ? "bg-ink text-ink-foreground" : "border border-input bg-card hover:bg-secondary")}
          >
            {key === "add-ons" ? "Add-ons" : "Integrations"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col rounded-xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">{item.icon}</span>
              {item.status ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-caption font-semibold",
                    item.status === "Included" ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {item.status}
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-heading font-semibold">{item.title}</p>
            <p className="mt-1 flex-1 text-body text-muted-foreground">{item.body}</p>
            <button type="button" onClick={() => setOpen(item)} className="mt-5 self-start text-body font-medium text-primary hover:underline">
              View
            </button>
          </div>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-[32rem] gap-0 rounded-2xl border-0 p-0 [&>button]:hidden">
          {open ? (
            <>
              <div className="flex items-start justify-between gap-4 px-8 pt-6">
                <span className="mt-2 flex size-12 items-center justify-center rounded-xl bg-accent text-primary">{open.icon}</span>
                <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="flex size-12 items-center justify-center rounded-full hover:bg-secondary">
                  <X size={20} />
                </button>
              </div>
              <DialogTitle className="px-8 pt-4 text-title font-semibold">{open.title}</DialogTitle>
              <DialogDescription className="px-8 pt-2 text-body text-muted-foreground">{open.body}</DialogDescription>
              <p className="px-8 pt-4 text-body">
                {open.status === "Included" ? "Included with Bookly at no extra cost." : "This isn't available yet. It's on the list for a later update."}
              </p>
              <div className="flex justify-end gap-2 px-8 pb-8 pt-8">
                <button type="button" onClick={() => setOpen(null)} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
                  Close
                </button>
                {open.to ? (
                  <button
                    type="button"
                    onClick={() => navigate({ to: open.to!.to, search: (open.to!.search ?? {}) as never })}
                    className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
                  >
                    Open
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
