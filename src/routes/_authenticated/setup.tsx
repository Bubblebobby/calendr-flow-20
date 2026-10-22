import { createFileRoute } from "@tanstack/react-router";

import { SetupPage } from "@/components/home/setup-guide";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [{ title: "Setup guide — Bookly" }],
  }),
  component: SetupPage,
});
