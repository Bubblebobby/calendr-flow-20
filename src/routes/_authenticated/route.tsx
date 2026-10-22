import { useEffect, useRef } from "react";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { AppNav } from "@/components/nav/app-nav";
import { TopBar } from "@/components/nav/top-bar";
import { requireOnboardedUser } from "@/lib/auth-guard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: requireOnboardedUser,

  component: AuthenticatedLayout,
});


function AuthenticatedLayout() {
  // Each page or sub-tab opens at the top-left. Without this, main kept the previous page's
  // scroll (e.g. a wide table scrolled sideways carried over to the next Sales tab).
  const main = useRef<HTMLElement>(null);
  const page = useRouterState({
    select: (s) =>
      `${s.location.pathname}?${(s.location.search as Record<string, unknown>)["tab"] ?? ""}`,
  });
  useEffect(() => {
    main.current?.scrollTo({ top: 0, left: 0 });
  }, [page]);
  return (
    <div className="flex h-[100svh] w-full flex-col overflow-hidden bg-background">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <AppNav />
        <main ref={main} className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
