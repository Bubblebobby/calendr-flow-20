import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CaretRight, ChartBar, ChatCircleDots, MagnifyingGlass, RocketLaunch, SignOut } from "@phosphor-icons/react";
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
export function TopBar({ notifications = 3 }: { notifications?: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["top-bar-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
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
      <Link to="/home" className="text-[1.625rem] font-bold tracking-tight text-foreground">
        bookly
      </Link>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="mr-1 hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-[0.9375rem] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
        >
          <RocketLaunch size={18} />
          Continue setup
          <CaretRight size={14} weight="bold" />
        </button>
        <button type="button" aria-label="Search" className={iconButton} onClick={() => toast("Search is coming soon")}>
          <MagnifyingGlass size={24} />
        </button>
        <button type="button" aria-label="Performance insights" className={iconButton} onClick={() => toast("Performance insights arrive with Reports")}>
          <ChartBar size={24} />
        </button>
        <button type="button" aria-label={`Notifications (${notifications})`} className={iconButton}>
          <Bell size={24} />
          {notifications > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[0.6875rem] font-semibold leading-5 text-destructive-foreground ring-2 ring-card">
              {notifications}
            </span>
          ) : null}
        </button>
        <button type="button" aria-label="Messages" className={iconButton} onClick={() => toast("Messages arrive with Marketing")}>
          <ChatCircleDots size={24} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account"
            className="ml-1 flex size-10 items-center justify-center rounded-full bg-[#e5f0fb] text-[0.875rem] font-semibold text-[#2d5f99] transition-shadow hover:ring-2 hover:ring-border"
          >
            {initials}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
            <DropdownMenuLabel className="px-3 py-2">
              <span className="block truncate text-[0.9375rem] font-semibold">{me?.name}</span>
              <span className="block truncate text-[0.8125rem] font-normal text-muted-foreground">{me?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="gap-3 rounded-lg px-3 py-2 text-[0.9375rem]">
              <SignOut size={18} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
