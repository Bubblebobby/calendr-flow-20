import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { CountryPicker } from "@/components/country-picker";
import { CustomerHeader, solidPill } from "@/components/customer/customer-ui";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { countryByCode, flagEmoji, guessCountryCode } from "@/lib/countries";
import { safeNext } from "@/lib/safe-next";
import { cn } from "@/lib/utils";

type Search = { next?: string | undefined };

export const Route = createFileRoute("/create-account")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["next"] === "string" ? { next: search["next"] } : {},
  beforeLoad: async ({ search }) => {
    const next = safeNext(search.next) ?? "/account/appointments";
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/sign-in", search: { next } });
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type, onboarded_at")
      .eq("id", data.session.user.id)
      .maybeSingle();
    if (profile?.user_type !== "customer")
      throw redirect({ to: "/account-type", search: { expected: "customer" } });
    if (profile.onboarded_at) throw redirect({ href: next });
    return { email: data.session.user.email ?? "", userId: data.session.user.id, next };
  },
  head: () => ({ meta: [{ title: "Create your account — Bookly" }] }),
  component: CreateAccountPage,
});

const field =
  "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function CreateAccountPage() {
  const { email, userId, next } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dialCountry, setDialCountry] = useState("NG");
  const [phone, setPhone] = useState("");
  const [offers, setOffers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const guess = guessCountryCode();
    if (guess && countryByCode(guess)) setDialCountry(guess);
  }, []);

  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  const valid =
    first.trim().length > 0 && last.trim().length > 0 && digits.length >= 6 && digits.length <= 15;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    const dial = countryByCode(dialCountry);
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        full_name: `${first.trim()} ${last.trim()}`,
        phone: dial ? `+${dial.dial}${digits}` : digits,
        marketing_emails: offers,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setSaving(false);
    if (saveError) {
      setError("Couldn't save your details. Please try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["customer"] });
    window.location.replace(next);
  }

  return (
    <div className="min-h-screen bg-surface">
      <CustomerHeader search={false} />
      <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <form
          onSubmit={save}
          className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)] sm:p-8"
        >
          <h1 className="text-title font-semibold">Create your account</h1>
          <p className="mt-2 text-body text-muted-foreground">
            You&apos;re almost there! Add your details to finish setting up your account for{" "}
            <span className="font-semibold text-foreground">{email}</span>.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-body font-semibold">
              First name
              <input
                required
                autoFocus
                maxLength={60}
                autoComplete="given-name"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-body font-semibold">
              Last name
              <input
                required
                maxLength={60}
                autoComplete="family-name"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                className={field}
              />
            </label>
          </div>

          <div className="mt-4">
            <label htmlFor="mobile" className="block text-body font-semibold">
              Mobile number
            </label>
            <div className="mt-2 flex gap-2">
              <CountryPicker
                value={dialCountry}
                onChange={setDialCountry}
                placeholder="Code"
                className="h-12 w-[124px] shrink-0 rounded-[8px]"
                render={(code) => (
                  <span className="flex items-center gap-1.5">
                    <span>{flagEmoji(code)}</span>
                    <span>+{countryByCode(code)?.dial}</span>
                  </span>
                )}
              />
              <input
                id="mobile"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel-national"
                placeholder="801 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={cn(field, "mt-0 flex-1")}
              />
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              Salons use this to reach you about your bookings.
            </p>
          </div>

          <label className="mt-5 flex items-start gap-3 text-body">
            <Checkbox
              checked={offers}
              onCheckedChange={(value) => setOffers(value === true)}
              className="mt-0.5"
            />
            <span>
              Send me offers and news from salons I book with
              <span className="block text-caption text-muted-foreground">
                You can change this any time in Settings.
              </span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="mt-4 text-body text-destructive">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!valid || saving}
            className={cn(solidPill, "mt-6 h-12 w-full text-heading")}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
      </main>
    </div>
  );
}
