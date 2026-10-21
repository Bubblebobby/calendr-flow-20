import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EnvelopeSimple } from "@phosphor-icons/react";

import { AuthField, AuthShell, authPrimaryButton } from "@/components/auth-shell";
import { supabase } from "@/integrations/supabase/client";
import { safeNext } from "@/lib/customer";

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
      if (data.session) window.location.replace(`/create-account?next=${encodeURIComponent(next)}`);
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
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          `/create-account?next=${encodeURIComponent(next)}`,
        )}`,
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
    <AuthShell
      title={sentTo ? "Check your email" : "Sign in"}
      subtitle={sentTo ? null : "One account for every salon you book with. No password needed."}
      features={CUSTOMER_FEATURES}
      panelTitle="Your bookings, all in one place"
      panelText="Find salons near you, book in seconds, and keep your appointments, gift cards and favourites together."
    >
      {sentTo ? (
        <div>
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-foreground">
            <EnvelopeSimple size={22} />
          </span>
          <p className="mt-4 text-body text-foreground">
            We sent a sign-in link to <span className="font-medium">{sentTo}</span>. Open it on this
            device to continue.
          </p>
          {error ? <p className="mt-4 text-body text-destructive">{error}</p> : null}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <button
              type="button"
              disabled={wait > 0 || sending}
              onClick={() => void send(sentTo)}
              className="text-body font-medium underline underline-offset-2 disabled:text-muted-foreground disabled:no-underline"
            >
              {wait > 0 ? `Resend in ${wait}s` : sending ? "Sending…" : "Resend link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
              className="text-body font-medium underline underline-offset-2"
            >
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(email.trim());
          }}
        >
          <AuthField
            label="Email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? (
            <p role="alert" className="mt-3 text-body text-destructive">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className={`${authPrimaryButton} mt-4`}
          >
            {sending ? "Sending…" : "Continue"}
          </button>
          <p className="mt-4 text-xs leading-[18px] text-[#666]">
            Use the email you give salons when you book, and your past bookings will appear in your
            account.
          </p>
          <p className="mt-8 text-sm text-[#666]">
            Own a salon?{" "}
            <Link to="/auth" className="font-medium text-foreground underline underline-offset-2">
              Sign in to Bookly for business
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

const CUSTOMER_FEATURES = [
  "Find salons near you",
  "Book in seconds",
  "Reschedule anytime",
  "Book again in one tap",
  "Keep your gift cards",
  "Track package sessions",
  "Save your favourites",
  "Leave a review",
];
