import { createFileRoute } from "@tanstack/react-router";

/*
 * Runs the automated client emails (see src/lib/automations.server.ts). Called every 10 minutes
 * by the Supabase scheduler with `Authorization: Bearer <CRON_SECRET>`. Anything else gets 401.
 */
export const Route = createFileRoute("/api/cron/automations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { timingSafeEqual } = await import("node:crypto");
        const secret = process.env["CRON_SECRET"];
        const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const ok =
          Boolean(secret) &&
          given.length === secret!.length &&
          timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
        if (!ok) return new Response("Unauthorized", { status: 401 });

        const { runAutomations } = await import("@/lib/automations.server");
        try {
          const result = await runAutomations();
          return Response.json(result);
        } catch (error) {
          console.error("[automations] run failed", error);
          return Response.json({ error: "run_failed" }, { status: 500 });
        }
      },
    },
  },
});
