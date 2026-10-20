import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowClockwise,
  ArrowLeft,
  CalendarBlank,
  CalendarX,
  Star,
  Storefront,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  EmptyState,
  outlinePill,
  SalonVisual,
  solidPill,
  Stars,
} from "@/components/customer/customer-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  bookAgainHref,
  formatInZone,
  isUpcoming,
  STATUS_LABEL,
  useMyAppointments,
  type MyAppointment,
} from "@/lib/customer";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Search = { id?: string };

export const Route = createFileRoute("/account/appointments")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["id"] === "string" ? { id: search["id"] } : {},
  head: () => ({ meta: [{ title: "Appointments — Bookly" }] }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const appointments = useMyAppointments();
  const list = appointments.data ?? [];
  const upcoming = list.filter((a) => isUpcoming(a)).reverse(); // soonest first
  const past = list.filter((a) => !isUpcoming(a));
  const selected = list.find((a) => a.id === id) ?? null;
  const open = (appointmentId: string | undefined) =>
    void navigate({ search: appointmentId ? { id: appointmentId } : {}, replace: true });

  if (appointments.isLoading)
    return <p className="text-body text-muted-foreground">Loading your appointments…</p>;
  if (appointments.isError)
    return (
      <p className="text-body text-destructive">
        Couldn&apos;t load your appointments. Please refresh.
      </p>
    );

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,360px)_1fr]">
      <div className={cn("space-y-8", selected && "hidden xl:block")}>
        <h1 className="text-display font-semibold">Appointments</h1>
        <section>
          <SectionTitle label="Upcoming" count={upcoming.length} />
          {upcoming.length ? (
            <div className="mt-3 space-y-3">
              {upcoming.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  active={a.id === id}
                  onOpen={() => open(a.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState
                icon={CalendarBlank}
                title="No upcoming appointments"
                text="Your upcoming appointments will appear here when you book."
                action={
                  <Link to="/discover" className={outlinePill}>
                    Search salons
                  </Link>
                }
              />
            </div>
          )}
        </section>
        {past.length ? (
          <section>
            <SectionTitle label="Past" count={past.length} />
            <div className="mt-3 space-y-3">
              {past.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  active={a.id === id}
                  onOpen={() => open(a.id)}
                />
              ))}
            </div>
          </section>
        ) : null}
        {list.length === 0 ? (
          <p className="text-caption text-muted-foreground">
            Booked before with this email? Salons link past bookings automatically when the email on
            your booking matches your account.
          </p>
        ) : null}
      </div>

      {selected ? (
        <AppointmentDetail appointment={selected} onBack={() => open(undefined)} />
      ) : list.length ? (
        <div className="hidden items-center justify-center rounded-2xl border border-dashed border-border text-body text-muted-foreground xl:flex">
          Select an appointment to see the details
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="flex items-center gap-2 text-title font-semibold">
      {label}
      <span className="rounded-full bg-secondary px-2 text-caption font-medium text-muted-foreground">
        {count}
      </span>
    </h2>
  );
}

function when(a: MyAppointment, options: Intl.DateTimeFormatOptions) {
  return formatInZone(a.start, a.business.timezone, options);
}

function AppointmentCard({
  appointment: a,
  active,
  onOpen,
}: {
  appointment: MyAppointment;
  active: boolean;
  onOpen: () => void;
}) {
  const money = (n: number) => formatMoney(n, a.business.currency, a.business.country);
  const again = !isUpcoming(a) ? bookAgainHref(a) : null;
  const status = a.status === "cancelled" || a.status === "no_show" ? STATUS_LABEL[a.status] : null;
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--color-border)]",
        active && "shadow-[inset_0_0_0_2px_var(--color-primary)]",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-stretch text-left"
      >
        <SalonVisual name={a.business.name} className="w-24 shrink-0 [&>span]:text-title" />
        <span className="min-w-0 flex-1 px-4 py-3">
          <span className="block truncate text-heading font-semibold">{a.business.name}</span>
          <span className="block text-caption text-muted-foreground">
            {when(a, {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="block text-caption text-muted-foreground">
            {money(Number(a.total))} · {a.items.length} {a.items.length === 1 ? "item" : "items"}
          </span>
          {status ? (
            <span
              className={cn(
                "mt-1 inline-block rounded-full px-2 text-caption font-medium",
                status.tone,
              )}
            >
              {status.label}
            </span>
          ) : null}
        </span>
      </button>
      {again ? (
        <div className="flex items-center pr-3">
          <a href={again} className={cn(outlinePill, "h-9 px-3 text-caption")}>
            Book again
          </a>
        </div>
      ) : null}
    </div>
  );
}

function AppointmentDetail({
  appointment: a,
  onBack,
}: {
  appointment: MyAppointment;
  onBack: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const money = (n: number) => formatMoney(n, a.business.currency, a.business.country);
  const status = STATUS_LABEL[a.status] ?? { label: a.status, tone: "bg-secondary" };
  const minutes = Math.round((new Date(a.end).getTime() - new Date(a.start).getTime()) / 60000);
  const upcoming = isUpcoming(a);
  const again = bookAgainHref(a);
  const canChange =
    upcoming && (a.business.allow_cancel !== false || a.business.allow_reschedule !== false);
  const address = [a.business.location?.address, a.business.location?.city]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="overflow-hidden rounded-2xl bg-card shadow-[inset_0_0_0_1px_var(--color-border)]">
      <div className="relative">
        <SalonVisual name={a.business.name} className="h-44 w-full sm:h-56" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to appointments"
          className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/90 xl:hidden"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="absolute bottom-4 left-6 right-6 text-display font-semibold text-white">
          {a.business.name}
        </h2>
      </div>
      <div className="space-y-6 p-6">
        <div>
          <span
            className={cn(
              "inline-block rounded-full px-3 py-1 text-caption font-medium",
              status.tone,
            )}
          >
            {status.label}
          </span>
          <p className="mt-3 text-title font-semibold">
            {when(a, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} at{" "}
            {when(a, { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-body text-muted-foreground">{formatDuration(minutes)} duration</p>
          {a.status === "cancelled" && a.cancellation_reason ? (
            <p className="mt-2 text-body text-muted-foreground">Reason: {a.cancellation_reason}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {canChange ? (
            <a href={`/book/manage/${a.manage_token}`} className={solidPill}>
              <CalendarX size={18} /> Reschedule or cancel
            </a>
          ) : null}
          {again ? (
            <a href={again} className={upcoming ? outlinePill : solidPill}>
              <ArrowClockwise size={18} /> Book again
            </a>
          ) : null}
          {a.status === "completed" && !a.review ? (
            <button type="button" onClick={() => setReviewing(true)} className={outlinePill}>
              <Star size={18} /> Leave a review
            </button>
          ) : null}
          {a.business.slug ? (
            <Link to="/salon/$slug" params={{ slug: a.business.slug }} className={outlinePill}>
              <Storefront size={18} /> View salon
            </Link>
          ) : null}
        </div>

        {a.review ? (
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-body font-semibold">Your review</p>
            <Stars value={a.review.rating} size={16} />
            {a.review.comment ? (
              <p className="mt-1 text-body text-muted-foreground">{a.review.comment}</p>
            ) : null}
          </div>
        ) : null}

        <section>
          <h3 className="text-heading font-semibold">Overview</h3>
          <ul className="mt-3 divide-y divide-border">
            {a.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-4 py-3">
                <span>
                  <span className="block text-body font-medium">{item.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {formatDuration(item.minutes)}
                    {item.with ? ` with ${item.with}` : ""}
                  </span>
                </span>
                <span className="text-body tabular-nums">
                  {item.price != null ? money(Number(item.price)) : "—"}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-border pt-3 text-heading font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{money(Number(a.total))}</span>
          </p>
        </section>

        {address ? (
          <section>
            <h3 className="text-heading font-semibold">Location</h3>
            <p className="mt-1 text-body text-muted-foreground">{address}</p>
          </section>
        ) : null}

        {upcoming && (a.business.notice_hours || a.business.policy) ? (
          <section>
            <h3 className="text-heading font-semibold">Cancellation policy</h3>
            {a.business.notice_hours ? (
              <p className="mt-1 text-body text-muted-foreground">
                Please change or cancel at least {a.business.notice_hours} hours before your
                appointment.
              </p>
            ) : null}
            {a.business.policy ? (
              <p className="mt-2 whitespace-pre-line text-body text-muted-foreground">
                {a.business.policy}
              </p>
            ) : null}
          </section>
        ) : null}

        <p className="text-caption text-muted-foreground">
          Booking reference {a.id.slice(0, 8).toUpperCase()}
        </p>
      </div>
      <ReviewDialog appointment={a} open={reviewing} onOpenChange={setReviewing} />
    </article>
  );
}

const REVIEW_ERRORS: Record<string, string> = {
  already_reviewed: "You've already reviewed this appointment.",
  not_completed: "You can review an appointment once it's completed.",
  not_found: "This appointment isn't linked to your account.",
};

function ReviewDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: MyAppointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submit_review", {
        p_appointment: appointment.id,
        p_rating: rating,
        p_comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks for your review!");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    },
    onError: (error: Error) => {
      const key = Object.keys(REVIEW_ERRORS).find((k) => error.message.includes(k));
      toast.error(key ? REVIEW_ERRORS[key]! : "Couldn't send your review. Please try again.");
    },
  });
  const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogTitle className="text-title">Review {appointment.business.name}</DialogTitle>
        <DialogDescription>
          {appointment.items.map((i) => i.name).join(", ")}. Your first name and last initial are
          shown with your review.
        </DialogDescription>
        <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className="rounded-full p-1 text-[#f5a623] hover:bg-secondary"
            >
              <Star size={32} weight={rating >= n ? "fill" : "regular"} />
            </button>
          ))}
          <span className="ml-2 text-body text-muted-foreground">{LABELS[rating]}</span>
        </div>
        <label className="block text-body font-semibold">
          Tell others about your visit{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea
            rows={4}
            maxLength={2000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="mt-2 w-full resize-none rounded-[8px] border border-input p-3 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <button
          type="button"
          disabled={rating === 0 || submit.isPending}
          onClick={() => submit.mutate()}
          className={cn(solidPill, "h-12 w-full")}
        >
          {submit.isPending ? "Sending…" : "Submit review"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
