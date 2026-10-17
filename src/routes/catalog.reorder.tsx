import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretDown, DotsSixVertical } from "@phosphor-icons/react";
import { toast } from "sonner";

import { pillButton } from "@/components/sales/list-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { requireOnboardedUser } from "@/lib/auth-guard";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/catalog/reorder")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  head: () => ({
    meta: [
      { title: "Set menu order — Bookly" },
      { name: "description", content: "Define the order that services appear to clients when booking online." },
    ],
  }),
  component: SetMenuOrderPage,
});

type Entry = { kind: "service" | "bundle"; id: string; name: string };
type Group = { id: string | null; name: string; color: string; entries: Entry[] };
type Drag = { type: "group"; index: number } | { type: "entry"; group: number; index: number };

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function SetMenuOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const [mode, setMode] = useState<"all" | "categories">("all");
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dirty, setDirty] = useState(false);

  const menu = useQuery({
    queryKey: ["menu-order", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Group[]> => {
      const [categories, services, bundles] = await Promise.all([
        supabase.from("service_categories").select("*").eq("business_id", businessId!).order("sort_order").order("created_at"),
        supabase.from("services").select("*").eq("business_id", businessId!).order("sort_order").order("created_at"),
        supabase
          .from("bundles")
          .select("id, name, category_id, sort_order, is_active")
          .eq("business_id", businessId!)
          .order("sort_order")
          .order("created_at"),
      ]);
      const error = categories.error ?? services.error ?? bundles.error;
      if (error) throw error;
      const items = [
        ...(services.data ?? [])
          .filter((s) => !s.is_archived)
          .map((s) => ({ kind: "service" as const, id: s.id, name: s.name, category: s.category_id, order: s.sort_order })),
        ...(bundles.data ?? [])
          .filter((b) => b.is_active)
          .map((b) => ({ kind: "bundle" as const, id: b.id, name: b.name, category: b.category_id, order: b.sort_order })),
      ].sort((a, b) => a.order - b.order);
      const result: Group[] = (categories.data ?? [])
        .filter((c) => !c.is_archived)
        .map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          entries: items.filter((i) => i.category === c.id).map(({ kind, id, name }) => ({ kind, id, name })),
        }));
      const loose = items.filter((i) => !i.category || !result.some((g) => g.id === i.category));
      if (loose.length) {
        result.push({
          id: null,
          name: "Uncategorised",
          color: "var(--color-border)",
          entries: loose.map(({ kind, id, name }) => ({ kind, id, name })),
        });
      }
      return result;
    },
  });

  useEffect(() => {
    if (menu.data && !dirty) setGroups(menu.data);
  }, [menu.data, dirty]);

  const save = useMutation({
    mutationFn: async (ordered: Group[]) => {
      const updates = [
        ...ordered
          .filter((group) => group.id)
          .map((group, index) => supabase.from("service_categories").update({ sort_order: index }).eq("id", group.id!)),
        ...ordered.flatMap((group) =>
          group.entries.map((entry, index) =>
            entry.kind === "service"
              ? supabase.from("services").update({ sort_order: index }).eq("id", entry.id)
              : supabase.from("bundles").update({ sort_order: index }).eq("id", entry.id),
          ),
        ),
      ];
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-categories", businessId] });
      queryClient.invalidateQueries({ queryKey: ["services", businessId] });
      queryClient.invalidateQueries({ queryKey: ["bundles", businessId] });
      queryClient.invalidateQueries({ queryKey: ["menu-order", businessId] });
      toast.success("Menu order saved");
      navigate({ to: "/catalog" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const close = () => {
    if (dirty && !window.confirm("Discard your changes to the menu order?")) return;
    navigate({ to: "/catalog" });
  };

  const dropOnGroup = (index: number) => {
    if (!groups || !drag) return;
    if (drag.type === "group" && drag.index !== index) {
      setGroups(move(groups, drag.index, index));
      setDrag({ type: "group", index });
      setDirty(true);
    }
  };

  const dropOnEntry = (group: number, index: number) => {
    if (!groups || !drag || drag.type !== "entry" || drag.group !== group || drag.index === index) return;
    setGroups(groups.map((g, i) => (i === group ? { ...g, entries: move(g.entries, drag.index, index) } : g)));
    setDrag({ type: "entry", group, index });
    setDirty(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-end gap-2 bg-white/95 px-8 backdrop-blur">
        <button type="button" onClick={close} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
          Close
        </button>
        <button
          type="button"
          disabled={!groups || save.isPending}
          onClick={() => groups && save.mutate(groups)}
          className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </header>

      <main className="mx-auto w-full max-w-[600px] px-6 pb-16 pt-4">
        <h1 className="text-[2.5rem] font-bold leading-[2.75rem]">Set menu order</h1>
        <p className="mt-3 text-body text-muted-foreground">
          Define the order that services will appear to clients when booking online.
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger className="mt-8 inline-flex h-9 items-center gap-2 rounded-full border border-input bg-card px-4 text-body font-medium hover:bg-secondary">
            {mode === "all" ? "Categories and services" : "Categories only"}
            <CaretDown size={14} weight="bold" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 rounded-xl p-2">
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-body font-medium" onSelect={() => setMode("all")}>
              Categories and services
            </DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-body font-medium" onSelect={() => setMode("categories")}>
              Categories only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!groups ? (
          <p className="mt-6 text-body text-muted-foreground">Loading menu…</p>
        ) : groups.length === 0 ? (
          <p className="mt-6 text-body text-muted-foreground">Add services to your menu first.</p>
        ) : (
          <div className="mt-6 space-y-3">
            {groups.map((group, groupIndex) => (
              <section
                key={group.id ?? "none"}
                draggable={group.id !== null}
                onDragStart={(event) => {
                  event.stopPropagation();
                  setDrag({ type: "group", index: groupIndex });
                }}
                onDragOver={(event) => {
                  if (drag?.type !== "group") return;
                  event.preventDefault();
                  dropOnGroup(groupIndex);
                }}
                onDragEnd={() => setDrag(null)}
                className={cn(
                  "rounded-xl bg-card p-4 shadow-[inset_0_0_0_1px_var(--color-border)]",
                  drag?.type === "group" && drag.index === groupIndex && "opacity-60",
                )}
              >
                <p className="flex items-center gap-2 text-heading font-semibold">
                  {group.id ? (
                    <DotsSixVertical size={18} className="cursor-grab text-muted-foreground" />
                  ) : null}
                  {group.name}
                </p>
                {mode === "all" ? (
                  <ul className="mt-3 space-y-2">
                    {group.entries.map((entry, entryIndex) => (
                      <li
                        key={`${entry.kind}-${entry.id}`}
                        draggable
                        onDragStart={(event) => {
                          event.stopPropagation();
                          setDrag({ type: "entry", group: groupIndex, index: entryIndex });
                        }}
                        onDragOver={(event) => {
                          if (drag?.type !== "entry" || drag.group !== groupIndex) return;
                          event.preventDefault();
                          event.stopPropagation();
                          dropOnEntry(groupIndex, entryIndex);
                        }}
                        onDragEnd={() => setDrag(null)}
                        className={cn(
                          "flex h-12 cursor-grab items-center gap-3 overflow-hidden rounded-lg bg-card pr-4 text-body shadow-[inset_0_0_0_1px_var(--color-border)]",
                          drag?.type === "entry" && drag.group === groupIndex && drag.index === entryIndex && "opacity-60",
                        )}
                      >
                        <span aria-hidden className="h-full w-1.5 shrink-0" style={{ backgroundColor: group.color }} />
                        <DotsSixVertical size={18} className="text-muted-foreground" />
                        <span className="truncate">{entry.name}</span>
                        {entry.kind === "bundle" ? (
                          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-primary">
                            Bundle
                          </span>
                        ) : null}
                      </li>
                    ))}
                    {group.entries.length === 0 ? (
                      <li className="px-1 text-body text-muted-foreground">No services in this category.</li>
                    ) : null}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
