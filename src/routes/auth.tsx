import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AuthDivider,
  AuthField,
  AuthShell,
  authPrimaryButton,
  authSecondaryButton,
} from "@/components/auth-shell";
import { supabase } from "@/integrations/supabase/client";
import { safeNext } from "@/lib/safe-next";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Bookly" },
      {
        name: "description",
        content:
          "Sign in to Bookly to manage your bookings, clients, catalog and sales in one place.",
      },
      { property: "og:title", content: "Sign in — Bookly" },
      {
        property: "og:description",
        content:
          "Sign in to Bookly to manage your bookings, clients, catalog and sales in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [next] = useState(() =>
    typeof window === "undefined"
      ? null
      : safeNext(new URLSearchParams(window.location.search).get("next")),
  );
  const callback = (origin: string) =>
    `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Same passwordless flow either way; only the wording changes.
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (next) window.location.replace(next);
      else navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate, next]);

  async function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    // One passwordless flow for both cases: existing accounts get a sign-in link,
    // new accounts get a link that lands on onboarding via /auth/callback.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callback(window.location.origin),
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentTo(email);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(window.location.origin) },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message);
    }
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
    >
      {sentTo ? (
        <div>
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-foreground">
            <MailCheck className="size-5" />
          </span>
          <p className="mt-4 text-body text-foreground">
            We sent a secure link to <span className="font-medium">{sentTo}</span>. Open it on this
            device to continue.
          </p>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="mt-6 text-body font-medium underline underline-offset-2"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={handleEmail}>
            <AuthField
              label="Email address"
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={loading} className={`${authPrimaryButton} mt-8`}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
            </button>
          </form>

          <AuthDivider />

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className={authSecondaryButton}
          >
            {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
            Continue with Google
          </button>
        </>
      )}
    </AuthShell>
  );
}
