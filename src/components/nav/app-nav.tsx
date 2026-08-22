import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CaretLeft, ChatCircleDots, SignOut, User } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navItems, type NavItem } from "./nav-items";

export function AppNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const activeItem =
    navItems.find((item) => pathname.startsWith(item.to)) ?? navItems[0];
  const [openKey, setOpenKey] = useState<string | null>(
    activeItem.groups ? activeItem.key : null,
  );

  const openItem = navItems.find((item) => item.key === openKey && item.groups);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function handleClick(item: NavItem) {
    if (item.groups) {
      setOpenKey((current) => (current === item.key ? null : item.key));
    } else {
      setOpenKey(null);
    }
  }

  return (
    <div className="relative flex h-[100svh] shrink-0">
      {/* Icon rail */}
      <nav
        aria-label="Main"
        className="flex w-16 flex-col items-center bg-ink py-4 text-ink-foreground"
      >
        <Link to="/home" className="mb-6 flex size-9 items-center justify-center">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            B
          </span>
        </Link>

        <ul className="flex w-full flex-1 flex-col items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.to);
            const isOpen = openKey === item.key;
            return (
              <li key={item.key} className="group/nav relative w-full">
                <Link
                  to={item.to}
                  onClick={() => handleClick(item)}
                  aria-label={item.title}
                  className={cn(
                    "mx-auto flex size-11 items-center justify-center rounded-xl transition-colors",
                    "text-ink-foreground/70 hover:bg-white/10 hover:text-ink-foreground",
                    (isActive || isOpen) && "bg-white/15 text-ink-foreground",
                  )}
                >
                  <item.icon size={22} weight={isActive ? "fill" : "regular"} />
                </Link>
                <span className="pointer-events-none absolute left-[calc(100%+6px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-ink-foreground shadow-lg group-hover/nav:block">
                  {item.title}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-label="Support chat"
            className="flex size-11 items-center justify-center rounded-xl text-ink-foreground/70 transition-colors hover:bg-white/10 hover:text-ink-foreground"
          >
            <ChatCircleDots size={22} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account"
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-ink-foreground transition-colors hover:bg-white/25"
            >
              <User size={18} weight="fill" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end">
              <DropdownMenuItem onSelect={handleSignOut}>
                <SignOut size={16} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Submenu panel */}
      {openItem ? (
        <div className="relative hidden w-60 flex-col border-r border-border bg-card md:flex">
          <div className="flex items-center justify-between px-5 py-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {openItem.title}
            </h2>
            <button
              type="button"
              aria-label={`Collapse ${openItem.title} menu`}
              onClick={() => setOpenKey(null)}
              className="flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            >
              <CaretLeft size={12} weight="bold" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-6">
            {openItem.groups?.map((group) => (
              <div key={group.title} className="mb-4">
                <p className="px-5 pb-1 text-sm font-semibold text-foreground">
                  {group.title}
                </p>
                <ul>
                  {group.children.map((child) => (
                    <li key={child.title}>
                      <Link
                        to={child.to}
                        search={child.search as never}
                        activeOptions={{ includeSearch: Boolean(child.search) }}
                        className="block px-5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:font-medium data-[status=active]:text-primary"
                      >
                        {child.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
