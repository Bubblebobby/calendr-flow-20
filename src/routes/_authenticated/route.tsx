import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppNav } from "@/components/nav/app-nav";
import { TopBar } from "@/components/nav/top-bar";
import { requireOnboardedUser } from "@/lib/auth-guard";
import { useApplyBrand, useBranding } from "@/lib/brand";
import { useBusiness } from "@/lib/use-business";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: requireOnboardedUser,

  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // The salon's brand colour tints the whole dashboard (buttons, highlights, focus rings).
  const { data: business } = useBusiness();
  const { data: branding } = useBranding(business?.id);
  useApplyBrand(branding?.brandColor);
  return (
    <div className="flex h-[100svh] w-full flex-col overflow-hidden bg-background">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <AppNav />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
