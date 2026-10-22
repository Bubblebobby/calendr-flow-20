import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarBlank, CheckCircle, XCircle } from "@phosphor-icons/react";

import { SalonContact } from "@/components/customer/salon-contact";
import { pillButton } from "@/components/sales/list-ui";
import { supabase } from "@/integrations/supabase/client";
import { useApplyBrand } from "@/lib/brand";
import { SalonLogo } from "@/components/customer/salon-logo";
import { policySummary, type BookingPolicy } from "@/lib/booking-policy";
import {
  formatClock,
  freeSlots,
  localDay,
  zonedToUtc,
  type Busy,
  type MemberShifts,
  type OpeningHours,
} from "@/lib/booking-slots";
import { formatAddress, fullName, useBusinessContact, type BusinessContact } from "@/lib/business-contact";
import { sendBookingEmail } from "@/lib/email.functions";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SkeletonPanel, SkeletonSlots } from "@/components/ui/skeletons";

export const Route = createFileRoute("/book/manage/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Your booking" }, { name: "robots", content: "noindex" }] }),
  component: ManageBookingPage,
});

type Manage = {
  appointment: {
    id: string;
    status: string;
    start: string | null;
    end: string | null;
    client_first_name: string | null;
    items: {
      service: string | null;
      duration: number | null;
      price: number | null;
      team_member_id: string;
      team_member: string | null;
      start: string;
      end: string;
    }[];
  };
  business: {
    name: string;
    slug: string | null;
    currency: string;
    country: string;
    timezone: string;
    location: { address?: string; apt?: string; city?: string; state?: string; postcode?: string } | null;
    hours: OpeningHours[];
    brand_color?: string | null;
    logo_path?: string | null;
  };
  policy: BookingPolicy;
};

const ERRORS: Record<string, string> = {
  too_late: "It's too close to your appointment to change it online. Please contact the business.",
  not_allowed: "The business doesn't allow this online. Please contact them.",
  not_changeable: "This booking can no longer be changed.",
  slot_taken: "Sorry, that time was just taken. Please pick another time.",
  outside_hours: "That time isn't available. Please pick another time.",
  invalid_time: "That time isn't available. Please pick another time.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ManageBookingPage() {
  const { token } = Route.useParams();
  const valid = UUID.test(token);
  const data = useQuery({
    queryKey: ["manage-booking", token],
    enabled: valid,
    retry: false,
    queryFn: async (): Promise<Manage | null> => {
      const { data: result, error } = await supabase.rpc("get_manage_booking", { p_token: token });
      if (error) throw error;
      return (result as unknown as Manage | null) ?? null;
    },
  });

  if (valid && data.isLoading)
    return (
      <Shell>
        <SkeletonPanel label="Loading your booking" />
      </Shell>
    );
  if (!valid || !data.data) {
    return (
      <Shell>
        <p className="text-title font-semibold text-foreground">
          We couldn&apos;t find this booking
        </p>
        <p className="mt-2">Check the link, or contact the business directly.</p>
      </Shell>
    );
  }
  return <ManageView token={token} data={data.data} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center text-body text-muted-foreground">
      {children}
    </div>
  );
}

function ManageView({ token, data }: { token: string; data: Manage }) {
  const queryClient = useQueryClient();
  const { appointment, business, policy } = data;
  useApplyBrand(business.brand_color);
  const tz = business.timezone;
  const [mode, setMode] = useState<"view" | "cancel" | "reschedule">("view");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"cancelled" | "rescheduled" | null>(null);
  const contactQuery = useBusinessContact(business.slug);
  const contact: BusinessContact = contactQuery.data ?? {
    name: business.name,
    phone: null,
    email: null,
    website: null,
    location: business.location,
  };
  const hasContact = Boolean(contact.phone || contact.email);
  // Full staff names from the public booking page (this RPC only has first names).
  const team = useQuery({
    queryKey: ["booking-page-team", business.slug],
    enabled: Boolean(business.slug),
    retry: false,
    queryFn: async () => {
      const { data: page, error: e } = await supabase.rpc("get_booking_page", { p_slug: business.slug! });
      if (e) return new Map<string, string>();
      const members = (page as { team?: { id: string; first_name: string; last_name: string | null }[] } | null)?.team ?? [];
      return new Map(members.map((m) => [m.id, fullName(m)]));
    },
  });
  const staffName = (item: Manage["appointment"]["items"][number]) =>
    team.data?.get(item.team_member_id) ?? item.team_member;

  const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: tz }).format(new Date(iso));
  const money = (n: number) => formatMoney(n, business.currency, business.country);
  const total = appointment.items.reduce((s, i) => s + Number(i.price ?? 0), 0);
  const duration = appointment.items.reduce(
    (s, i) => s + Math.round((new Date(i.end).getTime() - new Date(i.start).getTime()) / 60000),
    0,
  );
  const changeable =
    (appointment.status === "booked" || appointment.status === "confirmed") &&
    appointment.start !== null &&
    new Date(appointment.start).getTime() > Date.now() + policy.notice_hours * 3600000;

  const fail = (e: Error) => {
    const code = Object.keys(ERRORS).find((k) => e.message.includes(k));
    setError(code ? ERRORS[code]! : "Something went wrong. Please try again.");
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["manage-booking", token] });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error: e } = await supabase.rpc("cancel_booking", {
        p_token: token,
        p_reason: reason || null,
      });
      if (e) throw e;
    },
    onSuccess: () => {
      void sendBookingEmail({ data: { token, event: "cancelled" } }).catch(() => {});
      setDone("cancelled");
      setMode("view");
      refresh();
    },
    onError: fail,
  });

  const statusLabel: Record<string, string> = {
    booked: "Confirmed",
    confirmed: "Confirmed",
    arrived: "Checked in",
    started: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "Missed",
  };

  return (
    <div className="min-h-screen bg-surface px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-lg space-y-4">
        {done ? (
          <div className="flex items-center gap-3 rounded-xl bg-[#e6f6ea] px-5 py-4 text-body text-[#1f6b33]">
            <CheckCircle size={24} weight="fill" />
            {done === "cancelled"
              ? "Your booking has been cancelled."
              : "Your booking has been moved."}
          </div>
        ) : null}

        <div className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)] sm:p-8">
          <SalonLogo path={business.logo_path} name={business.name} size={48} className="mb-3" />
          <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            {business.name}
          </p>
          <h1 className="mt-2 text-display font-semibold">
            {appointment.client_first_name
              ? `${appointment.client_first_name}, your booking`
              : "Your booking"}
          </h1>
          <span
            className={cn(
              "mt-3 inline-flex rounded-full px-3 py-1 text-caption font-semibold",
              appointment.status === "cancelled" || appointment.status === "no_show"
                ? "bg-[#fdecef] text-destructive"
                : "bg-accent text-primary",
            )}
          >
            {statusLabel[appointment.status] ?? appointment.status}
          </span>

          {appointment.start ? (
            <p className="mt-5 flex items-start gap-3 text-body">
              <CalendarBlank size={22} className="mt-0.5 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-semibold">
                  {fmt(appointment.start, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="block text-muted-foreground">
                  {fmt(appointment.start, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                  –{fmt(appointment.end!, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}{" "}
                  · {formatDuration(duration)}
                </span>
              </span>
            </p>
          ) : null}

          <ul className="mt-6 space-y-3 border-t border-border pt-5">
            {appointment.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-4 text-body">
                <span>
                  <span className="block font-medium">{item.service ?? "Service"}</span>
                  <span className="block text-muted-foreground">
                    {item.duration ? formatDuration(item.duration) : ""}
                    {staffName(item) ? ` · with ${staffName(item)}` : ""}
                  </span>
                </span>
                <span>{item.price ? money(Number(item.price)) : ""}</span>
              </li>
            ))}
          </ul>
          {total > 0 ? (
            <p className="mt-4 flex justify-between border-t border-border pt-4 text-heading font-semibold">
              <span>Total</span>
              <span>{money(total)}</span>
            </p>
          ) : null}
        </div>

        {mode === "view" ? (
          <div className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
            <p className="text-body font-semibold">Cancellation policy</p>
            <p className="mt-1 text-body text-muted-foreground">{policySummary(policy)}</p>
            {policy.text ? (
              <p className="mt-2 whitespace-pre-line text-body text-muted-foreground">
                {policy.text}
              </p>
            ) : null}
            {changeable && (policy.allow_reschedule || policy.allow_cancel) ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {policy.allow_reschedule ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode("reschedule");
                    }}
                    className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
                  >
                    Reschedule
                  </button>
                ) : null}
                {policy.allow_cancel ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode("cancel");
                    }}
                    className={cn(
                      pillButton,
                      "border border-input bg-card text-destructive hover:bg-secondary",
                    )}
                  >
                    Cancel booking
                  </button>
                ) : null}
              </div>
            ) : appointment.status === "booked" || appointment.status === "confirmed" ? (
              <p className="mt-4 text-body text-muted-foreground">
                It&apos;s too close to your appointment to change it online. Please contact{" "}
                {business.name}
                {hasContact ? " using the details below" : ""}.
              </p>
            ) : null}
            {business.slug &&
            (appointment.status === "cancelled" || appointment.status === "completed") ? (
              <a
                href={`/book/${business.slug}`}
                className={cn(pillButton, "mt-5 bg-ink text-ink-foreground hover:bg-ink/90")}
              >
                Book again
              </a>
            ) : null}
          </div>
        ) : mode === "cancel" ? (
          <div className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
            <p className="flex items-center gap-2 text-heading font-semibold">
              <XCircle size={22} className="text-destructive" /> Cancel this booking?
            </p>
            <label className="mt-4 block text-body font-semibold">
              Reason <span className="font-normal text-muted-foreground">(optional)</span>
              <textarea
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2 w-full resize-none rounded-[8px] border border-input p-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("view")}
                className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
              >
                Keep booking
              </button>
              <button
                type="button"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
                className={cn(
                  pillButton,
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                )}
              >
                {cancel.isPending ? "Cancelling…" : "Cancel booking"}
              </button>
            </div>
          </div>
        ) : (
          <Reschedule
            token={token}
            data={data}
            duration={duration}
            onCancel={() => setMode("view")}
            onDone={() => {
              void sendBookingEmail({ data: { token, event: "rescheduled" } }).catch(() => {});
              setDone("rescheduled");
              setMode("view");
              refresh();
            }}
            onError={fail}
          />
        )}
        {error ? (
          <p role="alert" className="rounded-xl bg-[#fdecef] px-4 py-3 text-body text-destructive">
            {error}
          </p>
        ) : null}
        <SalonCard contact={contact} />
      </div>
    </div>
  );
}

function SalonCard({ contact }: { contact: BusinessContact }) {
  if (!formatAddress(contact.location) && !contact.phone && !contact.email && !contact.website) return null;
  return (
    <div className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
      <p className="text-body font-semibold">Contact {contact.name}</p>
      <SalonContact contact={contact} className="mt-2 divide-y divide-border" />
    </div>
  );
}

function Reschedule({
  token,
  data,
  duration,
  onCancel,
  onDone,
  onError,
}: {
  token: string;
  data: Manage;
  duration: number;
  onCancel: () => void;
  onDone: () => void;
  onError: (e: Error) => void;
}) {
  const tz = data.business.timezone;
  const [day, setDay] = useState(() => localDay(tz, Math.ceil(data.policy.notice_hours / 24)));
  const [slot, setSlot] = useState<number | null>(null);
  // Rescheduling keeps the same team members, so all of them must be free.
  const members = [...new Set(data.appointment.items.map((i) => i.team_member_id))];

  const busy = useQuery({
    queryKey: ["manage-busy", token, day],
    queryFn: async (): Promise<Busy[]> => {
      const { data: rows, error } = await supabase.rpc("get_manage_busy", {
        p_token: token,
        p_from: zonedToUtc(day, 0, tz).toISOString(),
        p_to: zonedToUtc(day, 24 * 60, tz).toISOString(),
      });
      if (error) throw error;
      return rows ?? [];
    },
  });
  const shifts = useQuery({
    queryKey: ["manage-availability", token, day],
    queryFn: async (): Promise<MemberShifts> => {
      const { data: rows, error } = await supabase.rpc("get_manage_availability", {
        p_token: token,
        p_from: day,
        p_to: day,
      });
      if (error) throw error;
      const map: MemberShifts = {};
      for (const row of rows ?? [])
        map[row.team_member_id] = row.shifts as unknown as MemberShifts[string];
      return map;
    },
  });

  const slots = useMemo(() => {
    if (!busy.data || !shifts.data) return [];
    const earliest = new Date(Date.now() + data.policy.notice_hours * 3600000);
    const perMember = members.map((id) =>
      freeSlots({
        day,
        tz,
        hours: data.business.hours,
        busy: busy.data,
        memberIds: [id],
        duration,
        shifts: shifts.data,
        now: earliest,
      }).map((s) => s.minutes),
    );
    return (perMember[0] ?? []).filter((m) => perMember.every((list) => list.includes(m)));
  }, [busy.data, shifts.data, members, day, tz, data, duration]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reschedule_booking", {
        p_token: token,
        p_start: zonedToUtc(day, slot!, tz).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: onDone,
    onError: (e: Error) => {
      setSlot(null);
      void busy.refetch();
      onError(e);
    },
  });

  const days = Array.from({ length: 21 }, (_, i) =>
    localDay(tz, i + Math.ceil(data.policy.notice_hours / 24)),
  );
  const label = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
      new Date(`${value}T12:00:00Z`),
    );

  return (
    <div className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
      <p className="text-heading font-semibold">Pick a new time</p>
      <p className="mt-1 text-caption text-muted-foreground">
        With the same team member{members.length > 1 ? "s" : ""}.
      </p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {days.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setDay(value);
              setSlot(null);
            }}
            className={cn(
              "flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl py-2 transition-colors",
              value === day
                ? "bg-primary text-primary-foreground"
                : "shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-secondary",
            )}
          >
            <span className="text-caption">{label(value, { weekday: "short" })}</span>
            <span className="text-heading font-semibold">{label(value, { day: "numeric" })}</span>
          </button>
        ))}
      </div>
      {busy.isLoading || shifts.isLoading ? (
        <div className="mt-4">
          <SkeletonSlots label="Checking availability" />
        </div>
      ) : slots.length === 0 ? (
        <p className="mt-4 text-body text-muted-foreground">
          No times available on {label(day, { weekday: "long", day: "numeric", month: "long" })}.
          Try another day.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {slots.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSlot(m)}
              className={cn(
                "h-11 rounded-xl text-body font-medium",
                slot === m
                  ? "bg-primary text-primary-foreground"
                  : "shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-secondary",
              )}
            >
              {formatClock(m)}
            </button>
          ))}
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
        >
          Back
        </button>
        <button
          type="button"
          disabled={slot === null || save.isPending}
          onClick={() => save.mutate()}
          className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
        >
          {save.isPending ? "Saving…" : "Confirm new time"}
        </button>
      </div>
    </div>
  );
}
