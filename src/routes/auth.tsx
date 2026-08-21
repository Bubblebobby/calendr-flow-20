import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarCheck, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import authPreview from "@/assets/auth-preview.jpg";

export const Route = createFileRoute("/auth")({
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
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    // One passwordless flow for both cases: existing accounts get a sign-in link,
    // new accounts get a link that lands on onboarding via /auth/callback.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: everything centre-aligned */}
      <div className="flex flex-col items-center px-6 py-10 lg:px-16">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Bookly</span>
        </Link>

        <div className="flex w-full max-w-[420px] flex-1 flex-col justify-center text-center">
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-[2.85rem]">
            Your bookings,
            <br />
            handled
          </h1>
          <p className="mt-3.5 text-base text-muted-foreground">
            Scheduling, clients and sales for your business — in one calm workspace.
          </p>

          <div className="surface-card mt-9 p-7 text-center">
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
          </div>
        </div>
      </div>

      {/* Right: centred showcase card (one for now, room for a set later) */}
      <div className="hidden items-center justify-center bg-secondary px-10 py-12 lg:flex">
        <figure className="surface-card w-full max-w-md overflow-hidden text-center">
          <img
            src={authPreview}
            alt="Bright, modern salon reception area"
            width={1024}
            height={1280}
            loading="lazy"
            className="h-[420px] w-full object-cover"
          />
          <figcaption className="space-y-1 px-6 py-5">
            <p className="text-sm font-semibold text-foreground">Built for service businesses</p>
            <p className="text-sm text-muted-foreground">
              Salons, spas, barbers and studios run their day on Bookly.
            </p>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
