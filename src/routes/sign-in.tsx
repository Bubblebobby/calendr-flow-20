import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EnvelopeSimple } from "@phosphor-icons/react";

import { CustomerHeader, solidPill } from "@/components/customer/customer-ui";
import { supabase } from "@/integrations/supabase/client";
import { safeNext } from "@/lib/customer";
import { cn } from "@/lib/utils";

type Search = { next?: string | undefined };

export const Route = createFileRoute("/sign-in")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["next"] === "string" ? { next: search["next"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Bookly" },
      {
        name: "description",
        content: "Sign in to see your appointments, wallet and favourite salons.",
      },
    ],
  }),
  component: SignInPage,
});

const RESEND_SECONDS = 60;

function SignInPage() {
  const search = Route.useSearch();
  const next = safeNext(search.next) ?? "/account/appointments";
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  // Already signed in: go straight on.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(next);
    });
  }, [next]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait(wait - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function send(address: string) {
    setSending(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Only used when the account is new: marks it as a customer, not a business.
        data: { user_type: "customer" },
      },
    });
    setSending(false);
    if (otpError) {
      setError(
        /rate|limit|seconds/i.test(otpError.message)
          ? "Too many emails just now. Please wait a minute and try again."
          : otpError.message,
      );
      return;
    }
    setSentTo(address);
    setWait(RESEND_SECONDS);
  }

  return (
    <div className="min-h-screen bg-surface">
      <CustomerHeader search={false} />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-20">
        <div className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)] sm:p-8">
          {sentTo ? (
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent">
                <EnvelopeSimple size={28} className="text-primary" />
              </span>
              <h1 className="mt-4 text-title font-semibold">Check your email</h1>
              <p className="mt-2 text-body text-muted-foreground">
                We sent a sign-in link to{" "}
                <span className="font-semibold text-foreground">{sentTo}</span>. Open it on this
                device to continue.
              </p>
              {error ? <p className="mt-4 text-body text-destructive">{error}</p> : null}
              <button
                type="button"
                disabled={wait > 0 || sending}
                onClick={() => void send(sentTo)}
                className="mt-6 text-body font-semibold text-primary disabled:text-muted-foreground"
              >
                {wait > 0 ? `Resend in ${wait}s` : sending ? "Sending…" : "Resend link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setError(null);
                }}
                className="mt-2 block w-full text-body text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(email.trim());
              }}
            >
              <h1 className="text-title font-semibold">Sign in or create an account</h1>
              <p className="mt-2 text-body text-muted-foreground">
                One account for every salon you book with on Bookly. No password needed.
              </p>
              <label className="mt-6 block text-body font-semibold">
                Email
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 h-12 w-full rounded-[8px] border border-input px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              {error ? (
                <p role="alert" className="mt-3 text-body text-destructive">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className={cn(solidPill, "mt-6 h-12 w-full text-heading")}
              >
                {sending ? "Sending…" : "Continue"}
              </button>
              <p className="mt-4 text-caption text-muted-foreground">
                Use the email you give salons when you book, and your past bookings will appear in
                your account.
              </p>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-body text-muted-foreground">
          Own a salon?{" "}
          <Link to="/auth" className="font-semibold text-primary">
            Sign in to Bookly for business
          </Link>
        </p>
      </main>
    </div>
  );
}
