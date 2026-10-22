import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarCheck,
  CalendarX,
  ClockCounterClockwise,
  MagnifyingGlass,
  Package,
  Scissors,
  UserCircle,
  ArrowRight,
  Star,
} from "@phosphor-icons/react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

const iconButton =
  "relative flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const KIND_ICON: Record<string, React.ReactNode> = {
  online_booking: <CalendarCheck size={20} className="text-primary" />,
  client_cancelled: <CalendarX size={20} className="text-destructive" />,
  client_rescheduled: <ClockCounterClockwise size={20} className="text-info" />,
  low_stock: <Package size={20} className="text-warning" />,
  review: <Star size={20} weight="fill" className="text-rating" />,
};

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Bell with unread count; polls every minute so new online bookings show up. */
export function NotificationsMenu() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ["notifications", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) return [];
      return data ?? [];
    },
  });
  const unread = (list.data ?? []).filter((n) => !n.read_at).length;
  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className={iconButton}
      >
        <Bell size={24} />
        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-caption font-semibold text-destructive-foreground ring-2 ring-card">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] rounded-xl p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-heading font-semibold">Notifications</p>
          {unread ? (
            <button
              type="button"
              onClick={() =>
                markRead.mutate((list.data ?? []).filter((n) => !n.read_at).map((n) => n.id))
              }
              className="text-caption font-semibold text-primary hover:underline"
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <ul className="max-h-[26rem] overflow-y-auto">
          {(list.data ?? []).map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.read_at) markRead.mutate([n.id]);
                  setOpen(false);
                  if (n.link) {
                    const [path, query] = n.link.split("?");
                    navigate({
                      to: path as never,
                      search: Object.fromEntries(new URLSearchParams(query ?? "")) as never,
                    });
                  }
                }}
                className={cn(
                  "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary",
                  !n.read_at && "bg-accent/50",
                )}
              >
                <span className="mt-0.5 shrink-0">{KIND_ICON[n.kind] ?? <Bell size={20} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">{n.title}</span>
                  {n.body ? (
                    <span className="block text-caption text-muted-foreground">{n.body}</span>
                  ) : null}
                  <span className="mt-0.5 block text-caption text-muted-foreground">
                    {timeAgo(n.created_at)}
                  </span>
                </span>
                {!n.read_at ? (
                  <span
                    aria-label="Unread"
                    className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                  />
                ) : null}
              </button>
            </li>
          ))}
          {list.data && list.data.length === 0 ? (
            <li className="px-4 py-10 text-center text-body text-muted-foreground">
              You&apos;re all caught up. New online bookings, client changes and low stock show
              here.
            </li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

type Result = { key: string; label: string; detail: string; icon: React.ReactNode; go: () => void };

const PAGES: Array<{ label: string; to: string; search?: Record<string, string> }> = [
  { label: "Calendar", to: "/calendar" },
  { label: "Sales", to: "/sales" },
  { label: "Clients", to: "/clients" },
  { label: "Service menu", to: "/catalog" },
  { label: "Products", to: "/catalog", search: { tab: "products" } },
  { label: "Gift cards sold", to: "/sales", search: { tab: "gift-cards" } },
  { label: "Booking profile", to: "/online-booking", search: { tab: "profile" } },
  { label: "Deals", to: "/marketing", search: { tab: "deals" } },
  { label: "Scheduled shifts", to: "/team", search: { tab: "shifts" } },
  { label: "Reports", to: "/reports" },
  { label: "Settings", to: "/settings" },
  { label: "Opening hours", to: "/settings", search: { section: "scheduling", page: "hours" } },
];

/** Search for clients, services, products and pages. Opens with the button or Ctrl/⌘+K. */
export function SearchMenu() {
  const { data: business } = useBusiness();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) {
      setTerm("");
      setActive(0);
    }
  }, [open]);

  const query = term.trim();
  const results = useQuery({
    queryKey: ["global-search", business?.id, query],
    enabled: Boolean(business?.id && open && query.length >= 2),
    queryFn: async () => {
      const like = `%${query.replace(/[%_,()]/g, " ")}%`;
      const [clients, services, products] = await Promise.all([
        supabase
          .from("clients")
          .select("id, first_name, last_name, email, phone")
          .eq("business_id", business!.id)
          .or(
            `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("services")
          .select("id, name")
          .eq("business_id", business!.id)
          .ilike("name", like)
          .limit(5),
        supabase
          .from("products")
          .select("id, name")
          .eq("business_id", business!.id)
          .ilike("name", like)
          .limit(5),
      ]);
      return {
        clients: clients.data ?? [],
        services: services.data ?? [],
        products: products.error ? [] : (products.data ?? []),
      };
    },
  });

  const items = useMemo<Result[]>(() => {
    const close = (fn: () => void) => () => {
      setOpen(false);
      fn();
    };
    const lower = query.toLowerCase();
    const pages = PAGES.filter((p) => !lower || p.label.toLowerCase().includes(lower)).slice(
      0,
      lower ? 4 : 6,
    );
    const data = results.data;
    return [
      ...(data?.clients ?? []).map((c) => ({
        key: `c-${c.id}`,
        label: [c.first_name, c.last_name].filter(Boolean).join(" "),
        detail: c.email || c.phone || "Client",
        icon: <UserCircle size={20} />,
        go: close(() => navigate({ to: "/client/$clientId", params: { clientId: c.id } })),
      })),
      ...(data?.services ?? []).map((s) => ({
        key: `s-${s.id}`,
        label: s.name,
        detail: "Service",
        icon: <Scissors size={20} />,
        go: close(() => navigate({ to: "/service/$serviceId", params: { serviceId: s.id } })),
      })),
      ...(data?.products ?? []).map((p) => ({
        key: `p-${p.id}`,
        label: p.name,
        detail: "Product",
        icon: <Package size={20} />,
        go: close(() => navigate({ to: "/catalog", search: { tab: "products" } as never })),
      })),
      ...pages.map((p) => ({
        key: `page-${p.label}`,
        label: p.label,
        detail: "Go to page",
        icon: <ArrowRight size={20} />,
        go: close(() => navigate({ to: p.to as never, search: (p.search ?? {}) as never })),
      })),
    ];
  }, [results.data, query, navigate]);

  useEffect(() => setActive(0), [items.length]);

  return (
    <>
      <button
        type="button"
        aria-label="Search (Ctrl+K)"
        className={iconButton}
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlass size={24} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12vh] max-w-[36rem] translate-y-0 gap-0 overflow-hidden rounded-2xl border-0 p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search clients, services, products and pages
          </DialogDescription>
          <label className="flex h-14 items-center gap-3 border-b border-border px-5">
            <MagnifyingGlass size={20} className="text-muted-foreground" />
            <input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((i) => Math.min(items.length - 1, i + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (event.key === "Enter") {
                  items[active]?.go();
                }
              }}
              placeholder="Search clients, services, products or pages"
              className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-placeholder"
            />
            <kbd className="rounded border border-border px-1.5 text-caption text-muted-foreground">
              Esc
            </kbd>
          </label>
          <ul className="max-h-[24rem] overflow-y-auto p-2">
            {items.map((item, index) => (
              <li key={item.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={item.go}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
                    index === active ? "bg-secondary" : "",
                  )}
                >
                  <span className="text-muted-foreground">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium">{item.label}</span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {query.length >= 2 && results.isFetching ? (
              <li className="px-3 py-2 text-caption text-muted-foreground">Searching…</li>
            ) : null}
            {query.length >= 2 && !results.isFetching && items.length === 0 ? (
              <li className="px-3 py-6 text-center text-body text-muted-foreground">
                No results for “{query}”
              </li>
            ) : null}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
