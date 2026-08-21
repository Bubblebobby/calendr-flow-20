import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";


function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s['next']) ?? undefined }),
  head: () => ({
    meta: [
      { title: "Sign in — Bookly" },
      {
        name: "description",
        content: "Sign in to Bookly to manage your bookings, clients, catalog and sales in one place.",
      },
      { property: "og:title", content: "Sign in — Bookly" },
      {
        property: "og:description",
        content: "Sign in to Bookly to manage your bookings, clients, catalog and sales in one place.",
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
  const { next } = Route.useSearch();
  const callback = (origin: string) =>
    `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      title={
        <>
          Your bookings,
          <br />
          handled
        </>
      }
      subtitle="Scheduling, clients and sales for your business — in one calm workspace."
    >
      {sentTo ? (
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MailCheck className="size-5" />
          </span>
          <h2 className="text-base font-semibold text-foreground">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a secure link to <span className="font-medium text-foreground">{sentTo}</span>. Open it to
            continue.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
            Continue with Google
          </Button>

          <div className="my-4 flex items-center gap-2.5">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <label htmlFor="auth-email" className="sr-only">
              Email address
            </label>
            <Input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="Enter your personal or work email"
              className="h-11 text-center"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Continue with email"}
            </Button>
          </form>

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link to="/" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            and acknowledge our{" "}
            <Link to="/" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </>
      )}
    </AuthShell>
  );
}

