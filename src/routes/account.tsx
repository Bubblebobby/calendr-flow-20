import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ACCOUNT_LINKS, CustomerHeader } from "@/components/customer/customer-ui";
import { supabase } from "@/integrations/supabase/client";
import { requireCustomer } from "@/lib/customer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  ssr: false,
  beforeLoad: requireCustomer,
  component: AccountLayout,
});

function AccountLayout() {
  const queryClient = useQueryClient();
  // Claim the salons' client records that use this account's email, once per visit.
  useQuery({
    queryKey: ["link-my-clients"],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("link_my_clients");
      if (error) return 0;
      if (data) {
        void queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
        void queryClient.invalidateQueries({ queryKey: ["my-wallet"] });
      }
      return data ?? 0;
    },
  });

  return (
    <div className="min-h-screen bg-surface">
      <CustomerHeader />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-8 lg:flex-row lg:gap-10 lg:pt-10">
        <nav
          aria-label="Account"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-1 lg:px-0"
        >
          {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex h-10 shrink-0 items-center gap-3 rounded-full border border-border bg-card px-4 text-body font-medium",
                "lg:h-11 lg:rounded-lg lg:border-0 lg:bg-transparent lg:px-3 lg:hover:bg-secondary",
              )}
              activeProps={{
                className: "border-ink bg-ink text-ink-foreground lg:bg-accent lg:text-foreground",
              }}
            >
              <Icon size={20} /> {label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
