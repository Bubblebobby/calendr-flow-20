import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretRight, ChartBar, ChatCircleDots, RocketLaunch, SignOut } from "@phosphor-icons/react";

import { NotificationsMenu, SearchMenu } from "./top-bar-menus";
import { SetupButton } from "@/components/home/setup-guide";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const iconButton =
  "relative flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary";

/** Fresha-style top bar: logo left; setup, search, insights, notifications, messages, avatar right. */
export function TopBar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["top-bar-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = data?.full_name?.trim() || user.email || "You";
      return { name, email: user.email ?? "" };
    },
    staleTime: Infinity,
  });
  const initials =
    me?.name
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "B";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card pl-4 pr-6 sm:pr-8">
      <Link to="/home" className="text-[1.625rem] font-bold text-foreground">
        bookly
      </Link>

      <div className="flex items-center gap-1.5">
        <SetupButton />
        <SearchMenu />
        <button
          type="button"
          aria-label="Performance insights"
          className={iconButton}
          onClick={() =>
            navigate({ to: "/reports/$reportId", params: { reportId: "performance-dashboard" } })
          }
        >
          <ChartBar size={24} />
        </button>
        <NotificationsMenu />
        <button
          type="button"
          aria-label="Messages"
          className={iconButton}
          onClick={() =>
            toast("Client messaging needs an SMS or WhatsApp provider. Coming in a later update.")
          }
        >
          <ChatCircleDots size={24} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account"
            className="ml-1 flex size-12 items-center justify-center rounded-full border border-white bg-info-soft text-[1rem] font-semibold leading-6 text-info transition-shadow hover:ring-2 hover:ring-border"
          >
            {initials}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
            <DropdownMenuLabel className="px-3 py-2">
              <span className="block truncate text-body font-semibold">{me?.name}</span>
              <span className="block truncate text-caption font-normal text-muted-foreground">
                {me?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void signOut()}
              className="gap-3 rounded-lg px-3 py-2 text-body"
            >
              <SignOut size={18} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
