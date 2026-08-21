import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OAuthDetails = {
  client?: { name?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Authorize access — Bookly" },
      { name: "description", content: "Approve or deny an app requesting access to your Bookly account." },
      { property: "og:title", content: "Authorize access — Bookly" },
      {
        property: "og:description",
        content: "Approve or deny an app requesting access to your Bookly account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ href: `/auth?next=${encodeURIComponent(next)}` });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <AuthShell title="Authorization failed" subtitle="We couldn't load this authorization request.">
      <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </AuthShell>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <AuthShell
      title={<>Authorize access</>}
      subtitle={`${clientName} wants to connect to your Bookly account.`}
    >
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          This lets <span className="font-medium text-foreground">{clientName}</span> read and update your
          business profile and team members as you.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button className="h-11 w-full" disabled={busy} onClick={() => decide(true)}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Approve"}
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Deny
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
