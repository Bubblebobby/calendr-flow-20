import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle, Eye, EyeSlash, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { acceptTeamInvite, lookupTeamInvite } from "@/lib/team-invites.functions";

export const Route = createFileRoute("/accept-invite")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accept your invite — Bookly" },
      {
        name: "description",
        content: "Set your password and join your team's Bookly workspace.",
      },
      { property: "og:title", content: "Accept your invite — Bookly" },
      {
        property: "og:description",
        content: "Set your password and join your team's Bookly workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
    const code = params.get("code");
    if (code) void supabase.auth.exchangeCodeForSession(code);
  }, []);

  const invite = useQuery({
    queryKey: ["team-invite", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: () => lookupTeamInvite({ data: { token: token! } }),
  });

  const accept = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Your invite link has expired. Ask your manager to resend it.");
      }
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw new Error(passwordError.message);
      return acceptTeamInvite({ data: { token: token! } });
    },
    onSuccess: () => {
      toast.success("You're all set! Welcome to the team.");
      navigate({ to: "/dashboard" });
    },
    onError: (err: Error) => setError(err.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("Those passwords don't match.");
    setError(null);
    accept.mutate();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-14">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-sm">
        {invite.isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Checking your invite…</p>
        )}

        {(!token || invite.isError) && !invite.isLoading && (
          <div className="space-y-4 py-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">
              This invite link is invalid or has expired
            </h1>
            <p className="text-sm text-muted-foreground">
              Ask your manager to send you a fresh invite — it only takes a moment.
            </p>
            <Link
              to="/auth"
              className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {invite.data && (
          <>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkle size={24} weight="fill" />
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">
              Welcome, {invite.data.first_name}!
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              You've been invited to join{" "}
              <span className="font-semibold text-foreground">{invite.data.business_name}</span>.
              Pick a password and you're in.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-semibold">
                  Create a password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? "text" : "password"}
                    value={password}
                    autoComplete="new-password"
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-xl pr-12 text-base"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {show ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-semibold">
                  Confirm password
                </Label>
                <Input
                  id="confirm-password"
                  type={show ? "text" : "password"}
                  value={confirm}
                  autoComplete="new-password"
                  onChange={(event) => setConfirm(event.target.value)}
                  className="h-12 rounded-xl text-base"
                  placeholder="Type it once more"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={accept.isPending}
                className="h-12 w-full rounded-full text-base font-semibold"
              >
                {accept.isPending ? "Setting you up…" : "Join the team"}
              </Button>

              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <CheckCircle size={14} weight="fill" className="text-primary" />
                Your password is private — only you will know it.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
