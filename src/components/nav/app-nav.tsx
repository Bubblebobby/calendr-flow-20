import { useEffect, useState } from "react";
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

  const activeItem = navItems.find((item) => pathname.startsWith(item.to));
  const [openKey, setOpenKey] = useState<string | null>(
    activeItem?.groups ? activeItem.key : null,
  );
  const [renderedItem, setRenderedItem] = useState<NavItem | null>(
    activeItem?.groups ? activeItem : null,
  );

  const openItem = navItems.find((item) => item.key === openKey && item.groups);

  useEffect(() => {
    if (!openItem) {
      const timer = window.setTimeout(() => {
        setRenderedItem(null);
      }, 300);
      return () => window.clearTimeout(timer);
    }
    setRenderedItem(openItem);
    return;
  }, [openItem]);

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
    <div className="relative flex h-full shrink-0">
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
      <div className="relative hidden md:flex">
        <div
          className={cn(
            "relative flex flex-col border-r border-border bg-card transition-all duration-500 ease-in-out",
            openItem ? "w-60 opacity-100" : "w-0 opacity-0",
          )}
        >
          <div className="h-full w-full overflow-hidden">
            {renderedItem ? (
              <div
                key={renderedItem.key}
                className="flex h-full w-60 flex-col animate-fade-in"
              >
                <div className="flex items-center px-5 py-5 shrink-0">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {renderedItem.title}
                  </h2>
                </div>

                <div className="flex-1 overflow-y-auto pb-6">
                  {renderedItem.groups?.map((group) => (
                    <div key={group.title} className="mb-4">
                      <p className="px-5 pb-1 text-sm font-semibold text-foreground">
                        {group.title}
                      </p>
                      <ul>
                        {group.children.map((child) => {
                          const isChildActive = pathname === child.to || (child.search && pathname.startsWith(child.to));
                          return (
                            <li key={child.title}>
                              <Link
                                to={child.to}
                                search={child.search as never}
                                activeOptions={{ includeSearch: Boolean(child.search) }}
                                className="block mx-3 rounded-lg px-4 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:font-medium data-[status=active]:text-foreground"
                              >
                                {child.title}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Floating collapse tab on the panel's right edge, aligned with the title */}
        <button
          type="button"
          aria-label={renderedItem ? `Collapse ${renderedItem.title} menu` : "Collapse menu"}
          onClick={() => setOpenKey(null)}
          className={cn(
            "absolute right-0 top-[34px] z-10 translate-x-1/2 -translate-y-1/2",
            "flex size-8 items-center justify-center rounded-full",
            "border border-border bg-card text-muted-foreground shadow-md",
            "transition-all duration-300 hover:text-foreground hover:shadow-lg",
            openItem ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none",
          )}
        >
          <CaretLeft size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
