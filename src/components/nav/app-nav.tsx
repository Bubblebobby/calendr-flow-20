import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CaretLeft, Question } from "@phosphor-icons/react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { navItems, type NavChild, type NavItem } from "./nav-items";

/**
 * Fresha-style navigation: a 72px black icon rail (active item = purple square)
 * plus a 208px sub-menu for sections that have pages.
 */
export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentTab = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)["tab"] as string | undefined,
  });

  const activeItem = navItems.find((item) => pathname.startsWith(item.to));
  const [openKey, setOpenKey] = useState<string | null>(activeItem?.groups ? activeItem.key : null);
  const [renderedItem, setRenderedItem] = useState<NavItem | null>(
    activeItem?.groups ? activeItem : null,
  );
  const openItem = navItems.find((item) => item.key === openKey && item.groups);

  useEffect(() => {
    if (!openItem) {
      const timer = window.setTimeout(() => setRenderedItem(null), 300);
      return () => window.clearTimeout(timer);
    }
    setRenderedItem(openItem);
    return;
  }, [openItem]);

  // Follow the route: open the current section's sub-menu, close it for sections without one.
  useEffect(() => {
    const current = navItems.find((item) => pathname.startsWith(item.to));
    setOpenKey(current?.groups ? current.key : null);
  }, [pathname]);

  /** One highlighted sub-item: the child whose tab matches, else the first child for this page. */
  function isChildActive(item: NavItem, child: NavChild) {
    if (!pathname.startsWith(child.to)) return false;
    const children = item.groups?.flatMap((group) => group.children) ?? [];
    const samePage = children.filter((entry) => pathname.startsWith(entry.to));
    const byTab = samePage.find(
      (entry) => entry.search?.["tab"] && entry.search["tab"] === currentTab,
    );
    return (byTab ?? samePage[0]) === child;
  }

  function handleClick(item: NavItem) {
    if (item.groups)
      setOpenKey((current) =>
        current === item.key && pathname.startsWith(item.to) ? null : item.key,
      );
    else setOpenKey(null);
  }

  return (
    <div className="relative flex h-full shrink-0">
      {/* Icon rail */}
      <nav
        aria-label="Main"
        className="flex w-[72px] flex-col items-center border-r border-border bg-card py-2 text-foreground"
      >
        <ul className="flex w-full flex-1 flex-col items-center">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.to);
            return (
              <li
                key={item.key}
                className="group/nav relative flex h-[52px] w-full items-center justify-center"
              >
                <Link
                  to={item.to}
                  onClick={() => handleClick(item)}
                  aria-label={item.title}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon size={24} weight={isActive ? "fill" : "regular"} />
                </Link>
                <span className="pointer-events-none absolute left-[calc(100%-4px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-caption font-medium text-ink-foreground shadow-lg group-hover/nav:block">
                  {item.title}
                </span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          aria-label="Help"
          onClick={() => toast("Help centre is coming soon")}
          className="mb-2 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Question size={24} />
        </button>
      </nav>

      {/* Sub-menu */}
      <div className="relative hidden md:flex">
        <div
          className={cn(
            "relative flex flex-col bg-card transition-all duration-300 ease-in-out",
            openItem ? "w-52 border-r border-border opacity-100" : "w-0 opacity-0",
          )}
        >
          <div className="h-full w-full overflow-hidden">
            {renderedItem ? (
              <div
                key={renderedItem.key}
                className="flex h-full w-52 flex-col overflow-y-auto px-2 pb-6 pt-6 animate-fade-in"
              >
                {renderedItem.groups?.map((group, index) => (
                  <div key={group.title}>
                    {index > 0 ? <div className="mx-4 my-4 border-t border-border" /> : null}
                    <p className="px-3 pb-2 text-caption font-medium uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </p>
                    <ul className="space-y-1">
                      {group.children.map((child) => (
                        <li key={child.title}>
                          <Link
                            to={child.to}
                            search={child.search as never}
                            activeProps={{}}
                            className={cn(
                              "flex h-9 items-center rounded-md px-3 text-body font-medium tracking-[-0.011em] text-foreground transition-colors",
                              isChildActive(renderedItem, child)
                                ? "bg-accent"
                                : "hover:bg-secondary",
                            )}
                          >
                            {child.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Collapse tab on the sub-menu's edge, like Fresha */}
        <button
          type="button"
          aria-label={renderedItem ? `Collapse ${renderedItem.title} menu` : "Collapse menu"}
          onClick={() => setOpenKey(null)}
          className={cn(
            "absolute right-0 top-[18px] z-10 translate-x-1/2",
            "flex size-9 items-center justify-center rounded-full border border-input bg-card text-foreground",
            "transition-all duration-200 hover:bg-secondary",
            openItem ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0",
          )}
        >
          <CaretLeft size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
