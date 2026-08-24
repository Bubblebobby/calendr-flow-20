import { createFileRoute } from "@tanstack/react-router";

import { ServiceForm } from "@/components/catalog/service-form";
import { requireOnboardedUser } from "@/lib/auth-guard";

export const Route = createFileRoute("/service/new")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  head: () => ({
    meta: [
      { title: "New service — Bookly" },
      { name: "description", content: "Create a new bookable service for your business." },
      { property: "og:title", content: "New service — Bookly" },
      {
        property: "og:description",
        content: "Create a new bookable service for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewServicePage,
});

function NewServicePage() {
  return <ServiceForm />;
}
