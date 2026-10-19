import { createFileRoute } from "@tanstack/react-router";

import { SettingsHome, SettingsSection } from "@/components/settings/settings-pages";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>): { section?: string; page?: string } => ({
    ...(typeof search["section"] === "string" ? { section: search["section"] } : {}),
    ...(typeof search["page"] === "string" ? { page: search["page"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Workspace settings — Bookly" },
      { name: "description", content: "Business details, opening hours, closed periods, client tags and more." },
    ],
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const { section, page } = Route.useSearch();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-[1184px] px-8 pb-10 pt-8">
        {section ? <SettingsSection sectionKey={section} pageKey={page} /> : <SettingsHome />}
      </div>
    </div>
  );
}
