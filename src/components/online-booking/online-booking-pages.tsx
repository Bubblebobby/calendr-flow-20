import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, Copy, DownloadSimple, Globe, LinkSimple, QrCode, X } from "@phosphor-icons/react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { isMissingColumn } from "@/components/catalog/catalog-ui";
import { memberName, useTeamMembers } from "@/components/catalog/service-team-members";
import { FeatureIntro, PageHeader, pillButton } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

const NEEDS_DB =
  "Online booking needs a database update first: run supabase/migrations/20261018090000_online_booking.sql in Supabase.";

type BookingSettings = {
  id: string;
  name: string;
  booking_slug: string | null;
  online_booking_enabled: boolean;
  booking_description: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export function bookingUrl(slug: string, params?: Record<string, string>) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const query = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${origin}/book/${slug}${query}`;
}

function useBookingSettings() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["booking-settings", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<BookingSettings> => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, booking_slug, online_booking_enabled, booking_description")
        .eq("id", business!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

function DbNotice() {
  return (
    <div className="rounded-xl bg-[#fff7e6] px-5 py-4 text-body text-[#7a4b00] shadow-[inset_0_0_0_1px_#f5d9a6]">{NEEDS_DB}</div>
  );
}

const card = "rounded-xl bg-card px-6 py-6 shadow-[inset_0_0_0_1px_var(--color-border)] sm:px-8";

// ─── Booking profile (Fresha's Marketplace profile) ─────────────────────────

export function BookingProfile() {
  const settings = useBookingSettings();
  const queryClient = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);

  if (settings.isLoading) return <p className="text-body text-muted-foreground">Loading…</p>;
  if (settings.error && isMissingColumn(settings.error as { code?: string; message?: string })) return <DbNotice />;
  if (!settings.data) return null;

  const s = settings.data;
  const configured = Boolean(s.booking_slug);

  if (!configured && !setupOpen) {
    return (
      <FeatureIntro
        title="Let clients book online, day or night"
        body="Publish a booking page for your business and share it anywhere. Clients choose a service, a team member and a time, and the appointment lands straight in your calendar."
        bullets={[
          "Free up your phone: clients book themselves 24/7",
          "Only free times are offered, so there's no double booking",
          "Share one link on WhatsApp, Instagram or your website",
        ]}
        onStart={() => setSetupOpen(true)}
        art={
          <div className="rounded-3xl bg-card p-5 shadow-lg">
            <p className="text-heading font-semibold">{s.name}</p>
            <p className="text-caption text-muted-foreground">Select time</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["10:00", "10:15", "10:30", "11:00", "11:15", "12:30"].map((time, index) => (
                <span
                  key={time}
                  className={cn(
                    "rounded-lg py-2 text-center text-caption font-medium",
                    index === 2 ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1px_var(--color-border)]",
                  )}
                >
                  {time}
                </span>
              ))}
            </div>
          </div>
        }
      />
    );
  }

  return (
    <ProfileEditor
      settings={s}
      onSaved={() => {
        setSetupOpen(false);
        queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      }}
    />
  );
}

function ProfileEditor({ settings, onSaved }: { settings: BookingSettings; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState(settings.booking_slug ?? slugify(settings.name));
  const [description, setDescription] = useState(settings.booking_description ?? "");
  const [enabled, setEnabled] = useState(settings.online_booking_enabled || !settings.booking_slug);
  const slugValid = SLUG_PATTERN.test(slug);
  const dirty =
    slug !== (settings.booking_slug ?? "") ||
    description !== (settings.booking_description ?? "") ||
    enabled !== settings.online_booking_enabled;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("businesses")
        .update({
          booking_slug: slug,
          booking_description: description.trim() || null,
          online_booking_enabled: enabled,
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(enabled ? "Booking page published" : "Booking page saved");
      onSaved();
    },
    onError: (error: { code?: string; message: string }) => {
      if (error.code === "23505") toast.error("That link is already taken. Try another one.");
      else if (isMissingColumn(error)) toast.error(NEEDS_DB);
      else toast.error(error.message);
    },
  });

  const servicesQuery = useBookableServices();
  const toggleService = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = await supabase.from("services").update({ online_booking_enabled: on }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookable-services"] }),
    onError: (error: { code?: string; message: string }) => toast.error(isMissingColumn(error) ? NEEDS_DB : error.message),
  });

  const published = settings.online_booking_enabled && settings.booking_slug;
  const services = servicesQuery.data ?? [];
  const onlineCount = services.filter((s) => s.online_booking_enabled).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Booking profile"
        subtitle="Your public booking page, where clients book appointments online."
        actions={
          <>
            {published ? (
              <a
                href={bookingUrl(settings.booking_slug!)}
                target="_blank"
                rel="noreferrer"
                className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
              >
                View page
                <ArrowSquareOut size={18} />
              </a>
            ) : null}
            <button
              type="button"
              disabled={!slugValid || !dirty || save.isPending}
              onClick={() => save.mutate()}
              className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      />

      <section className={card}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[1.5rem] font-semibold leading-8">Online booking</h2>
            <p className="mt-1 text-body text-muted-foreground">
              {enabled ? "Clients can book online using your link." : "Your booking page is hidden. Clients can't book online."}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable online booking" className="mt-2 scale-125" />
        </div>

        <label className="mt-6 block text-body font-semibold">
          Booking page link
          <span className="mt-2 flex h-12 items-center overflow-hidden rounded-[8px] border border-input bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <span className="hidden h-full items-center border-r border-input bg-secondary px-4 font-normal text-muted-foreground sm:flex">
              {typeof window === "undefined" ? "" : window.location.host}/book/
            </span>
            <input
              value={slug}
              maxLength={50}
              onChange={(event) => setSlug(slugify(event.target.value))}
              className="h-full min-w-0 flex-1 px-4 font-normal outline-none"
            />
          </span>
          <span className={cn("mt-2 block text-caption font-normal", slugValid ? "text-muted-foreground" : "text-destructive")}>
            {slugValid ? "Letters, numbers and dashes. Changing it breaks links you've already shared." : "Use 3–50 lowercase letters, numbers or dashes."}
          </span>
        </label>

        <label className="mt-4 block text-body font-semibold">
          <span className="flex justify-between">
            About your business <span className="font-normal text-muted-foreground">{description.length}/500</span>
          </span>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            placeholder="A line or two clients see at the top of your booking page"
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2 w-full resize-none rounded-[8px] border border-input p-4 text-body font-normal outline-none placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </section>

      <section className={card}>
        <h2 className="text-[1.5rem] font-semibold leading-8">Services available online</h2>
        <p className="mt-1 text-body text-muted-foreground">
          {onlineCount} of {services.length} services can be booked online. Opening hours come from your business settings, and only
          free times are offered.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {services.map((service) => (
            <li key={service.id} className="flex items-center gap-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium">{service.name}</span>
                <span className="block text-caption text-muted-foreground">{formatDuration(service.duration_minutes)}</span>
              </span>
              <Switch
                checked={service.online_booking_enabled}
                onCheckedChange={(on) => toggleService.mutate({ id: service.id, on })}
                aria-label={`Online booking for ${service.name}`}
              />
            </li>
          ))}
          {services.length === 0 ? <li className="py-3 text-body text-muted-foreground">Add services in Catalog first.</li> : null}
        </ul>
      </section>
    </div>
  );
}

type BookableService = { id: string; name: string; duration_minutes: number; online_booking_enabled: boolean };

function useBookableServices() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["bookable-services", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async (): Promise<BookableService[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", business!.id)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? [])
        .filter((row) => !row.is_archived)
        .map((row) => ({
          id: row.id,
          name: row.name,
          duration_minutes: row.duration_minutes,
          online_booking_enabled: row.online_booking_enabled ?? true,
        }));
    },
  });
}

// ─── Link builder ───────────────────────────────────────────────────────────

export function LinkBuilder() {
  const settings = useBookingSettings();
  const [dialog, setDialog] = useState<"everything" | "services" | null>(null);
  const published = Boolean(settings.data?.booking_slug && settings.data.online_booking_enabled);

  if (settings.error && isMissingColumn(settings.error as { code?: string; message?: string })) return <DbNotice />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Link builder"
        subtitle="Create shareable links and QR codes for anything your clients can book online."
        learnMore
      />
      {!settings.isLoading && !published ? (
        <div className="rounded-xl bg-accent px-5 py-4 text-body">
          Publish your booking page in <span className="font-semibold">Booking profile</span> first, then come back to create links.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <LinkCard
          icon={<Globe size={28} />}
          title="Link to everything"
          body="One simple link covering everything clients can book online."
          disabled={!published}
          onCreate={() => setDialog("everything")}
        />
        <LinkCard
          icon={<LinkSimple size={28} />}
          title="Link to services"
          body="Booking links for certain services or team members."
          disabled={!published}
          onCreate={() => setDialog("services")}
        />
      </div>
      {settings.data?.booking_slug ? (
        <LinkDialog mode={dialog} slug={settings.data.booking_slug} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function LinkCard({
  icon,
  title,
  body,
  disabled,
  onCreate,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <div className={cn(card, "flex flex-col")}>
      <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">{icon}</span>
      <p className="mt-4 text-title font-semibold">{title}</p>
      <p className="mt-1 flex-1 text-body text-muted-foreground">{body}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onCreate}
        className={cn(pillButton, "mt-6 self-start border border-input bg-card hover:bg-secondary")}
      >
        Create link
      </button>
    </div>
  );
}

function LinkDialog({ mode, slug, onClose }: { mode: "everything" | "services" | null; slug: string; onClose: () => void }) {
  const { data: business } = useBusiness();
  const services = useBookableServices().data?.filter((s) => s.online_booking_enabled) ?? [];
  const team = useTeamMembers(business?.id).data ?? [];
  const [picked, setPicked] = useState<string[]>([]);
  const [memberId, setMemberId] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (mode) {
      setPicked([]);
      setMemberId("");
    }
  }, [mode]);

  const url = useMemo(() => {
    if (mode === "services") {
      const params: Record<string, string> = {};
      if (picked.length) params["services"] = picked.join(",");
      if (memberId) params["team"] = memberId;
      return bookingUrl(slug, params);
    }
    return bookingUrl(slug);
  }, [mode, slug, picked, memberId]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#0d0d0d", light: "#ffffff" } })
      .then((data) => !cancelled && setQr(data))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  };

  const ready = mode === "everything" || picked.length > 0 || Boolean(memberId);

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[45rem] gap-0 overflow-y-auto rounded-2xl border-0 p-0 [&>button]:hidden">
        <div className="flex items-start justify-between gap-4 px-8 pt-6">
          <DialogTitle className="pt-3 text-title font-semibold">
            {mode === "services" ? "Link to services" : "Link to everything"}
          </DialogTitle>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-12 items-center justify-center rounded-full hover:bg-secondary">
            <X size={20} />
          </button>
        </div>
        <DialogDescription className="px-8 text-body text-muted-foreground">
          {mode === "services"
            ? "Pick services and, optionally, a team member. Clients who open the link start with these already selected."
            : "Share this link anywhere clients can tap it, or print the QR code for your front desk."}
        </DialogDescription>

        <div className="grid gap-8 px-8 pb-8 pt-6 sm:grid-cols-[1fr_200px]">
          <div className="min-w-0 space-y-5">
            {mode === "services" ? (
              <>
                <div>
                  <p className="text-body font-semibold">Services</p>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-[8px] border border-input p-2">
                    {services.map((service) => (
                      <li key={service.id}>
                        <label className="flex h-10 cursor-pointer items-center gap-3 rounded-[8px] px-2 text-body hover:bg-secondary">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--color-primary)]"
                            checked={picked.includes(service.id)}
                            onChange={(event) =>
                              setPicked((ids) => (event.target.checked ? [...ids, service.id] : ids.filter((id) => id !== service.id)))
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">{service.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                <label className="block text-body font-semibold">
                  Team member
                  <select
                    value={memberId}
                    onChange={(event) => setMemberId(event.target.value)}
                    className="mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 font-normal"
                  >
                    <option value="">Any team member</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {memberName(member)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <div>
              <p className="text-body font-semibold">Link</p>
              <div className="mt-2 flex gap-2">
                <input readOnly value={ready ? url : ""} placeholder="Choose at least one service or team member" onFocus={(event) => event.target.select()} className="h-12 min-w-0 flex-1 rounded-[8px] border border-input bg-secondary px-4 text-body" />
                <button type="button" disabled={!ready} onClick={copy} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
                  <Copy size={18} /> Copy
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-[200px] items-center justify-center rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--color-border)]">
              {qr && ready ? <img src={qr} alt="QR code for the booking link" className="size-[180px]" /> : <QrCode size={48} className="text-placeholder" />}
            </div>
            <a
              href={qr && ready ? qr : undefined}
              download={`booking-qr-${slug}.png`}
              aria-disabled={!qr || !ready}
              className={cn(pillButton, "h-10 border border-input bg-card text-body hover:bg-secondary", (!qr || !ready) && "pointer-events-none opacity-50")}
            >
              <DownloadSimple size={18} /> Download QR
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Intro pages ────────────────────────────────────────────────────────────

const later = (feature: string) => () => toast(`${feature} is coming in a later update`);

export function SocialBookings() {
  return (
    <FeatureIntro
      title="Get booked on Facebook and Instagram"
      body="Add a Book now button to your social pages that opens your Bookly booking page."
      bullets={[
        "Free online bookings from new and returning clients",
        "Connect your pages in a few minutes",
        "Promote your Book now button in posts and ads",
      ]}
      cta="Set up now"
      onStart={later("Facebook and Instagram bookings")}
    />
  );
}

export function ReserveWithGoogle() {
  return (
    <FeatureIntro
      title="Get booked from Google Search and Maps"
      body="Let clients who find you on Google book straight away, without leaving Google."
      bullets={[
        "A Book button on your Google Business Profile",
        "Bookings land in your Bookly calendar",
        "Reach clients searching for salons near them",
      ]}
      onStart={later("Reserve with Google")}
    />
  );
}

export function SmartWebsite() {
  return (
    <FeatureIntro
      title="A website that keeps itself up to date"
      body="A professional site for your business that updates as your services, team and prices change."
      bullets={["Your services, prices and team, always current", "Online booking built in", "Your own web address"]}
      onStart={later("Smart website")}
    />
  );
}
