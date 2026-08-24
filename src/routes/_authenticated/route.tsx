import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppNav } from "@/components/nav/app-nav";
import { TopBar } from "@/components/nav/top-bar";
import { requireOnboardedUser } from "@/lib/auth-guard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: requireOnboardedUser,

  component: AuthenticatedLayout,
});


function AuthenticatedLayout() {
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
