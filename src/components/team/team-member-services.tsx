import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration, formatMoney } from "@/lib/format";

export type CatalogService = {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
  category_id: string | null;
  category_name: string;
};

const UNCATEGORISED = "__uncategorised__";

/** Every service in the business, with its category name resolved for grouping. */
export function useBusinessServices(businessId: string | undefined) {
  return useQuery({
    queryKey: ["team-services", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<CatalogService[]> => {
      const [{ data: services, error }, { data: categories }] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, price, duration_minutes, category_id, sort_order")
          .eq("business_id", businessId!)
          .order("sort_order"),
        supabase
          .from("service_categories")
          .select("id, name, sort_order")
          .eq("business_id", businessId!)
          .order("sort_order"),
      ]);
      if (error) throw error;

      const names = new Map((categories ?? []).map((c) => [c.id, c.name]));
      return (services ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        price: service.price,
        duration_minutes: service.duration_minutes,
        category_id: service.category_id,
        category_name: service.category_id
          ? (names.get(service.category_id) ?? "Uncategorised")
          : "Uncategorised",
      }));
    },
  });
}

/** Services already linked to a saved team member (empty for a new one). */
export function useTeamMemberServices(teamMemberId: string | undefined) {
  return useQuery({
    queryKey: ["team-member-services", teamMemberId],
    enabled: Boolean(teamMemberId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("service_team_members")
        .select("service_id")
        .eq("team_member_id", teamMemberId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.service_id);
    },
  });
}

/**
 * Same reconciliation as the Service form, from the team member's side:
 * insert newly checked services, delete unchecked ones, leave the rest alone.
 */
export async function reconcileTeamMemberServices(
  teamMemberId: string,
  selected: string[],
  previous: string[],
) {
  const added = selected.filter((id) => !previous.includes(id));
  const removed = previous.filter((id) => !selected.includes(id));

  if (added.length) {
    const { error } = await supabase
      .from("service_team_members")
      .insert(added.map((service_id) => ({ service_id, team_member_id: teamMemberId })));
    if (error) throw error;
  }
  if (removed.length) {
    const { error } = await supabase
      .from("service_team_members")
      .delete()
      .eq("team_member_id", teamMemberId)
      .in("service_id", removed);
    if (error) throw error;
  }
}

function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

export function TeamMemberServicesSection({
  services,
  loading,
  selected,
  onChange,
  currency,
  country,
}: {
  services: CatalogService[];
  loading?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
  currency: string;
  country?: string | null;
}) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? services.filter((s) => s.name.toLowerCase().includes(term)) : services;
  }, [services, search]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: CatalogService[] }>();
    for (const service of visible) {
      const key = service.category_id ?? UNCATEGORISED;
      const group = map.get(key) ?? { name: service.category_name, items: [] };
      group.items.push(service);
      map.set(key, group);
    }
    return Array.from(map.entries()).map(([id, group]) => ({ id, ...group }));
  }, [visible]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const allChecked = services.length > 0 && selected.length === services.length;
  const allIndeterminate = selected.length > 0 && !allChecked;

  const toggleAll = () => onChange(allChecked ? [] : services.map((s) => s.id));

  const toggleService = (id: string) =>
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const toggleGroup = (ids: string[], fullyChecked: boolean) => {
    onChange(
      fullyChecked
        ? selected.filter((id) => !ids.includes(id))
        : Array.from(new Set([...selected, ...ids])),
    );
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground">Services</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the services this team member provides
        </p>
      </div>

      <div className="relative">
        <MagnifyingGlass
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="h-12 rounded-xl border border-border bg-transparent pl-11 text-base"
          placeholder="Search services"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-3 py-3">
          <Checkbox
            checked={allChecked ? true : allIndeterminate ? "indeterminate" : false}
            onCheckedChange={toggleAll}
            disabled={services.length === 0}
            className="size-5 rounded-md border-2"
          />
          <span className="flex-1 text-sm font-bold text-foreground">All services</span>
          <CountBadge>{services.length}</CountBadge>
        </label>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading services…</p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {services.length === 0
              ? "No services yet — add services in your catalog first."
              : "No services match your search."}
          </p>
        ) : (
          groups.map((group) => {
            const ids = group.items.map((s) => s.id);
            const checkedCount = ids.filter((id) => selectedSet.has(id)).length;
            const fully = checkedCount === ids.length && ids.length > 0;
            const partial = checkedCount > 0 && !fully;

            return (
              <div key={group.id} className="mt-4">
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <Checkbox
                    checked={fully ? true : partial ? "indeterminate" : false}
                    onCheckedChange={() => toggleGroup(ids, fully)}
                    className="size-5 rounded-md border-2"
                  />
                  <span className="flex-1 text-sm font-bold text-foreground">
                    {group.name}
                  </span>
                  <CountBadge>
                    {checkedCount}/{ids.length}
                  </CountBadge>
                </label>

                <ul className="divide-y divide-border">
                  {group.items.map((service) => (
                    <li key={service.id}>
                      <label className="flex cursor-pointer items-center gap-3 py-3.5 pl-8">
                        <Checkbox
                          checked={selectedSet.has(service.id)}
                          onCheckedChange={() => toggleService(service.id)}
                          className="size-5 rounded-md border-2"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {service.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDuration(service.duration_minutes)}
                          </span>
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {service.price === null
                            ? "Free"
                            : formatMoney(Number(service.price), currency, country)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
