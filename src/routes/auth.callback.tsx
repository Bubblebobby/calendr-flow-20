import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { safeNext } from "@/lib/safe-next";


export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — Bookly" },
      { name: "description", content: "Completing your secure sign-in to Bookly." },
      { property: "og:title", content: "Signing you in — Bookly" },
      { property: "og:description", content: "Completing your secure sign-in to Bookly." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [next] = useState(() =>
    typeof window === "undefined"
      ? null
      : safeNext(new URLSearchParams(window.location.search).get("next")),
  );

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        window.location.replace(next ? `/auth?next=${encodeURIComponent(next)}` : "/auth");
        return;
      }

      // A pending OAuth consent (or any preserved destination) wins over the
      // normal post-sign-in routing.
      if (next) {
        window.location.replace(next);
        return;
      }

      // Profiles are created by a trigger on signup, so completeness is the
      // onboarding timestamp, not the row's existence.
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (cancelled) return;
      navigate({ to: profile?.onboarded_at ? "/dashboard" : "/onboarding", replace: true });

    }

    resolve();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") resolve();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, next]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-body text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
