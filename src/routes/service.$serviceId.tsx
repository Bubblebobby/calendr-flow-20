import { createFileRoute } from "@tanstack/react-router";

import { ServiceForm } from "@/components/catalog/service-form";
import { requireOnboardedUser } from "@/lib/auth-guard";

export const Route = createFileRoute("/service/$serviceId")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  head: () => ({
    meta: [
      { title: "Edit service — Bookly" },
      { name: "description", content: "Update an existing service for your business." },
      { property: "og:title", content: "Edit service — Bookly" },
      {
        property: "og:description",
        content: "Update an existing service for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditServicePage,
});

function EditServicePage() {
  const { serviceId } = Route.useParams();
  return <ServiceForm serviceId={serviceId} />;
}
