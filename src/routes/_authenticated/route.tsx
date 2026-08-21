import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Anyone who has not finished personal + business setup goes back to it.
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at, business_id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.onboarded_at) throw redirect({ to: "/onboarding" });

    if (!profile.business_id) throw redirect({ to: "/business-setup" });

    const { data: business } = await supabase
      .from("businesses")
      .select("setup_step")
      .eq("id", profile.business_id)
      .maybeSingle();

    if (!business || (business.setup_step ?? 1) < 8) throw redirect({ to: "/business-setup" });

    return { user: data.user };
  },

  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium text-muted-foreground">Workspace</span>
        </header>
        <main className="flex-1 bg-background">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
