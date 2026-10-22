import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EnvelopeSimple } from "@phosphor-icons/react";

import { AuthField, AuthShell, authPrimaryButton } from "@/components/auth-shell";
import { supabase } from "@/integrations/supabase/client";
import { safeNext } from "@/lib/customer";

// mode=signup opens straight on "Create your account" (the same emailed-link flow).
type Search = { next?: string | undefined; mode?: "signup" | undefined };

export const Route = createFileRoute("/sign-in")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["next"] === "string" ? { next: search["next"] } : {}),
    ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}),
  }),
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
  // Same passwordless flow either way; only the wording changes.
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");

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
      title={sentTo ? "Check your email" : mode === "signup" ? "Create your account" : "Sign in"}
      subtitle={
        sentTo ? null : mode === "signup" ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="font-semibold underline underline-offset-2"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            New to Bookly?{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="font-semibold underline underline-offset-2"
            >
              Sign up
            </button>
          </>
        )
      }
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
            label="Email address"
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
            className={`${authPrimaryButton} mt-8`}
          >
            {sending ? "Sending…" : "Continue"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

const CUSTOMER_FEATURES = [
  "Find salons near you",
  "Book in seconds",
  "Reschedule anytime",
  "Book again in a tap",
  "Keep your gift cards",
  "Track your sessions",
  "Save favourites",
  "Leave reviews",
];
