import { useMemo, useState } from "react";
import {
  ArrowsDownUp,
  CaretDown,
  DotsThreeVertical,
  FilePdf,
  FileXls,
  FileCsv,
  GearSix,
  LinkSimple,
  ListNumbers,
  PencilSimple,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  CategoryFormDialog,
  ConfirmDialog,
  NAMED_CATEGORY_COLORS,
  NEEDS_DB_UPDATE,
  isMissingColumn,
  type CategoryFormValue,
} from "@/components/catalog/catalog-ui";
import { memberName, useTeamMembers } from "@/components/catalog/service-team-members";
import {
  ChipButton,
  FilterModal,
  FilterSelect,
  FiltersChip,
  PageHeader,
  SearchBox,
  pillButton,
} from "@/components/sales/list-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  bundleDuration,
  bundlePrice,
  type BundlePricingMode,
  type BundleScheduleType,
} from "@/lib/bundle-pricing";
import { formatDuration, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  sort_order: number;
  is_archived?: boolean;
};

type Service = {
  id: string;
  name: string;
  category_id: string | null;
  treatment_type: string | null;
  description: string | null;
  pricing_type: string;
  price: number | null;
  duration_minutes: number;
  duration_segments: unknown;
  sort_order: number;
  is_archived?: boolean;
  service_team_members: { team_member_id: string }[];
};

type Bundle = {
  id: string;
  name: string;
  category_id: string | null;
  schedule_type: BundleScheduleType;
  pricing_mode: BundlePricingMode;
  custom_price: number | null;
  discount_percentage: number | null;
  sort_order: number;
  is_active: boolean;
  bundle_services: { services: { id: string; price: number | null; duration_minutes: number } | null }[];
};

type MenuItem =
  | { kind: "service"; id: string; name: string; categoryId: string | null; archived: boolean; service: Service }
  | { kind: "bundle"; id: string; name: string; categoryId: string | null; archived: boolean; bundle: Bundle };

type Filters = { status: "active" | "all" | "archived"; type: "all" | "services" | "bundles"; team: string };
const DEFAULT_FILTERS: Filters = { status: "active", type: "all", team: "" };

type Confirm =
  | { action: "archive" | "delete"; target: "item"; item: MenuItem }
  | { action: "archive" | "delete"; target: "category"; category: Category };

const UNCATEGORISED = "__none__";

const soon = (label: string) => () => toast(`${label} is coming soon`);

/** Menu items: 40px rows, 15px medium text, 8px radius, like Fresha's popovers. */
const menuItem = "h-10 gap-3 rounded-[8px] px-3 text-body font-medium";

export function ServiceMenu() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormValue | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["service-categories", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .eq("business_id", businessId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const servicesQuery = useQuery({
    queryKey: ["services", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*, service_team_members(team_member_id)")
        .eq("business_id", businessId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Service[];
    },
  });

  const bundlesQuery = useQuery({
    queryKey: ["bundles", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Bundle[]> => {
      const { data, error } = await supabase
        .from("bundles")
        .select(
          "id, name, category_id, schedule_type, pricing_mode, custom_price, discount_percentage, sort_order, is_active, bundle_services(services(id, price, duration_minutes))",
        )
        .eq("business_id", businessId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Bundle[];
    },
  });

  const teamQuery = useTeamMembers(businessId);
  const team = teamQuery.data ?? [];

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const bundles = useMemo(() => bundlesQuery.data ?? [], [bundlesQuery.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["service-categories", businessId] });
    queryClient.invalidateQueries({ queryKey: ["services", businessId] });
    queryClient.invalidateQueries({ queryKey: ["bundles", businessId] });
  };

  const onError = (error: { code?: string; message: string }) =>
    toast.error(isMissingColumn(error) ? NEEDS_DB_UPDATE : error.message);

  const saveCategory = useMutation({
    mutationFn: async (value: CategoryFormValue) => {
      const payload = {
        business_id: businessId!,
        name: value.name.trim(),
        color: value.color,
        description: value.description.trim() || null,
      };
      const { error } = value.id
        ? await supabase.from("service_categories").update(payload).eq("id", value.id)
        : await supabase
            .from("service_categories")
            .insert({ ...payload, sort_order: categories.length });
      if (error) throw error;
    },
    onSuccess: (_data, value) => {
      setCategoryForm(null);
      refresh();
      toast.success(value.id ? "Category updated" : "Category added");
    },
    onError,
  });

  const runConfirm = useMutation({
    mutationFn: async (job: Confirm) => {
      if (job.target === "category") {
        const query =
          job.action === "delete"
            ? supabase.from("service_categories").delete().eq("id", job.category.id)
            : supabase
                .from("service_categories")
                .update({ is_archived: !job.category.is_archived })
                .eq("id", job.category.id);
        const { error } = await query;
        if (error) throw error;
        return;
      }
      const { item } = job;
      if (item.kind === "service") {
        const { error } =
          job.action === "delete"
            ? await supabase.from("services").delete().eq("id", item.id)
            : await supabase.from("services").update({ is_archived: !item.archived }).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } =
          job.action === "delete"
            ? await supabase.from("bundles").delete().eq("id", item.id)
            : await supabase.from("bundles").update({ is_active: item.archived }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: (_data, job) => {
      setConfirm(null);
      if (job.target === "category" && job.action === "delete" && selectedCategory === job.category.id) {
        setSelectedCategory(null);
      }
      refresh();
      const noun = job.target === "category" ? "Category" : job.item.kind === "bundle" ? "Bundle" : "Service";
      const restored =
        job.action === "archive" &&
        (job.target === "category" ? job.category.is_archived : job.item.archived);
      toast.success(
        job.action === "delete" ? `${noun} deleted` : restored ? `${noun} restored` : `${noun} archived`,
      );
    },
    onError,
  });

  const duplicateService = useMutation({
    mutationFn: async (service: Service) => {
      const { data, error } = await supabase
        .from("services")
        .insert({
          business_id: businessId!,
          name: `${service.name} (copy)`.slice(0, 255),
          category_id: service.category_id,
          treatment_type: service.treatment_type,
          description: service.description,
          pricing_type: service.pricing_type,
          price: service.price,
          duration_minutes: service.duration_minutes,
          duration_segments: service.duration_segments as never,
          sort_order: service.sort_order + 1,
        })
        .select("id")
        .single();
      if (error) throw error;
      const teamRows = service.service_team_members.map((row) => ({
        service_id: data.id,
        team_member_id: row.team_member_id,
      }));
      if (teamRows.length) {
        const { error: teamError } = await supabase.from("service_team_members").insert(teamRows);
        if (teamError) throw teamError;
      }
      return data.id;
    },
    onSuccess: (id) => {
      refresh();
      toast.success("Service duplicated");
      navigate({ to: "/service/$serviceId", params: { serviceId: id } });
    },
    onError,
  });

  // ─── Derived menu ────────────────────────────────────────────────────────

  const items = useMemo<MenuItem[]>(
    () => [
      ...services.map((service) => ({
        kind: "service" as const,
        id: service.id,
        name: service.name,
        categoryId: service.category_id,
        archived: Boolean(service.is_archived),
        service,
      })),
      ...bundles.map((bundle) => ({
        kind: "bundle" as const,
        id: bundle.id,
        name: bundle.name,
        categoryId: bundle.category_id,
        archived: !bundle.is_active,
        bundle,
      })),
    ],
    [services, bundles],
  );

  const archivedCategoryIds = useMemo(
    () => new Set(categories.filter((c) => c.is_archived).map((c) => c.id)),
    [categories],
  );

  const isArchived = (item: MenuItem) =>
    item.archived || (item.categoryId ? archivedCategoryIds.has(item.categoryId) : false);

  const matchesFilters = (item: MenuItem) => {
    if (filters.status === "active" && isArchived(item)) return false;
    if (filters.status === "archived" && !isArchived(item)) return false;
    if (filters.type === "services" && item.kind !== "service") return false;
    if (filters.type === "bundles" && item.kind !== "bundle") return false;
    if (filters.team && item.kind === "service") {
      const assigned = item.service.service_team_members.map((row) => row.team_member_id);
      // No explicit assignment means "all team members" (Fresha's default).
      if (assigned.length && !assigned.includes(filters.team)) return false;
    }
    return true;
  };

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => matchesFilters(item) && (!term || item.name.toLowerCase().includes(term)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, filters, archivedCategoryIds]);

  const visibleCategories = categories.filter((category) =>
    filters.status === "archived"
      ? category.is_archived || visibleItems.some((item) => item.categoryId === category.id)
      : filters.status === "active"
        ? !category.is_archived
        : true,
  );

  const hasUncategorised = visibleItems.some((item) => !item.categoryId);

  const countFor = (categoryId: string | null) =>
    visibleItems.filter((item) => (item.categoryId ?? null) === categoryId).length;

  const groups: Array<{ key: string; category: Category | null; items: MenuItem[] }> = [
    ...visibleCategories.map((category) => ({
      key: category.id,
      category,
      items: visibleItems
        .filter((item) => item.categoryId === category.id)
        .sort((a, b) => sortOrder(a) - sortOrder(b)),
    })),
    ...(hasUncategorised
      ? [{ key: UNCATEGORISED, category: null, items: visibleItems.filter((item) => !item.categoryId) }]
      : []),
  ].filter((group) => (selectedCategory ? group.key === selectedCategory : true));

  const filterCount =
    Number(filters.status !== "active") + Number(filters.type !== "all") + Number(Boolean(filters.team));

  // ─── Display helpers ─────────────────────────────────────────────────────

  const bundleServices = (bundle: Bundle) =>
    bundle.bundle_services
      .map((row) => row.services)
      .filter((service): service is NonNullable<typeof service> => Boolean(service));

  const itemDuration = (item: MenuItem) =>
    item.kind === "service"
      ? item.service.duration_minutes
      : bundleDuration(bundleServices(item.bundle), item.bundle.schedule_type);

  const priceLabel = (item: MenuItem) => {
    if (!business) return "";
    const money = (amount: number) => formatMoney(amount, business.currency, business.country);
    if (item.kind === "bundle") {
      const amount = bundlePrice(
        {
          pricing_mode: item.bundle.pricing_mode,
          custom_price: item.bundle.custom_price,
          discount_percentage: item.bundle.discount_percentage,
        },
        bundleServices(item.bundle),
      );
      return amount === 0 ? "Free" : money(amount);
    }
    const { service } = item;
    if (service.pricing_type === "free") return "Free";
    if (service.pricing_type === "free-form") return "Price at checkout";
    if (service.pricing_type === "from") return `from ${money(Number(service.price ?? 0))}`;
    return money(Number(service.price ?? 0));
  };

  const openItem = (item: MenuItem) =>
    item.kind === "bundle"
      ? navigate({ to: "/bundle/new", search: { id: item.id, categoryId: undefined } })
      : navigate({ to: "/service/$serviceId", params: { serviceId: item.id } });

  const categoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? "") : "Uncategorised";

  // ─── Export ──────────────────────────────────────────────────────────────

  const exportRows = () =>
    groups.flatMap((group) =>
      group.items.map((item) => [
        categoryName(item.categoryId),
        item.name,
        item.kind === "bundle" ? "Bundle" : "Service",
        formatDuration(itemDuration(item)),
        priceLabel(item),
        isArchived(item) ? "Archived" : "Active",
      ]),
    );
  const exportHeader = ["Category", "Name", "Type", "Duration", "Price", "Status"];

  const download = (format: "csv" | "excel" | "pdf") => {
    const rows = exportRows();
    if (!rows.length) {
      toast("There's nothing to export yet");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const escapeHtml = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const table = `<table><thead><tr>${exportHeader.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;

    if (format === "pdf") {
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Allow pop-ups to download the PDF");
        return;
      }
      win.document.write(
        `<!doctype html><title>Service menu ${stamp}</title><style>body{font:14px system-ui,sans-serif;padding:32px}h1{font-size:24px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid #e5e5e5}</style><h1>Service menu</h1>${table}`,
      );
      win.document.close();
      win.focus();
      win.print();
      return;
    }

    const blob =
      format === "csv"
        ? new Blob(
            [
              "﻿" +
                [exportHeader, ...rows]
                  .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
                  .join("\n"),
            ],
            { type: "text/csv;charset=utf-8" },
          )
        : new Blob([`<html><meta charset="utf-8">${table}</html>`], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `service-menu-${stamp}.${format === "csv" ? "csv" : "xls"}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const loading = servicesQuery.isLoading || bundlesQuery.isLoading || categoriesQuery.isLoading;
  const newCategory = (): CategoryFormValue => ({
    name: "",
    color: NAMED_CATEGORY_COLORS[0].hex,
    description: "",
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Service menu"
        subtitle="View and manage the services offered by your business."
        learnMore
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
                Options
                <CaretDown size={16} weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
                <DropdownMenuItem className={menuItem} onSelect={soon("Quick booking links")}>
                  <LinkSimple size={20} /> Quick booking link
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={() => navigate({ to: "/catalog/reorder" })}>
                  <ArrowsDownUp size={20} /> Set menu order
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={soon("Booking sequence")}>
                  <ListNumbers size={20} /> Set booking sequence
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={soon("Bulk edit")}>
                  <PencilSimple size={20} /> Bulk edit services
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={soon("Service menu settings")}>
                  <GearSix size={20} /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem className={menuItem} onSelect={() => download("pdf")}>
                  <FilePdf size={20} /> Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={() => download("excel")}>
                  <FileXls size={20} /> Download Excel
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={() => download("csv")}>
                  <FileCsv size={20} /> Download CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
                Add
                <CaretDown size={16} weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
                <DropdownMenuItem className={menuItem} onSelect={() => navigate({ to: "/service/new" })}>
                  Single service
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={menuItem}
                  onSelect={() => navigate({ to: "/bundle/new", search: { id: undefined, categoryId: undefined } })}
                >
                  Bundle
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem className={menuItem} onSelect={() => setCategoryForm(newCategory())}>
                  Category
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <SearchBox value={search} onChange={setSearch} placeholder="Search service name" />
        <FiltersChip count={filterCount} onClick={() => setDraftFilters(filters)} />
        <div className="ml-auto">
          <ChipButton onClick={() => navigate({ to: "/catalog/reorder" })}>
            <ArrowsDownUp size={16} />
            Manage order
          </ChipButton>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[296px_1fr]">
        {/* Categories */}
        <aside className="rounded-lg bg-card px-8 py-6">
          <p className="pb-2 text-title font-semibold">Categories</p>
          <ul className="-mx-4">
            <CategoryRow
              label="All categories"
              count={visibleItems.length}
              active={selectedCategory === null}
              onClick={() => setSelectedCategory(null)}
            />
            {visibleCategories.map((category) => (
              <CategoryRow
                key={category.id}
                label={category.name}
                count={countFor(category.id)}
                archived={Boolean(category.is_archived)}
                active={selectedCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
              />
            ))}
            {hasUncategorised ? (
              <CategoryRow
                label="Uncategorised"
                count={countFor(null)}
                active={selectedCategory === UNCATEGORISED}
                onClick={() => setSelectedCategory(UNCATEGORISED)}
              />
            ) : null}
            <li>
              <button
                type="button"
                onClick={() => setCategoryForm(newCategory())}
                className="flex h-11 w-full items-center rounded-[8px] px-4 text-body font-medium text-primary transition-colors hover:bg-secondary"
              >
                Add category
              </button>
            </li>
          </ul>
        </aside>

        {/* Services */}
        <section className="min-w-0 space-y-8">
          {loading ? (
            <p className="text-body text-muted-foreground">Loading services…</p>
          ) : groups.length === 0 || groups.every((group) => group.items.length === 0 && !group.category) ? (
            <EmptyMenu
              filtered={Boolean(search.trim()) || filterCount > 0}
              onAdd={() => navigate({ to: "/service/new" })}
            />
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <div className="mb-3.5 flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 truncate text-title font-semibold">
                    {group.category?.name ?? "Uncategorised"}
                    {group.category?.is_archived ? <ArchivedBadge /> : null}
                  </p>
                  {group.category ? (
                    <CategoryActions
                      category={group.category}
                      onEdit={() =>
                        setCategoryForm({
                          id: group.category!.id,
                          name: group.category!.name,
                          color: group.category!.color,
                          description: group.category!.description ?? "",
                        })
                      }
                      onAddService={() =>
                        navigate({ to: "/service/new", search: { categoryId: group.category!.id } })
                      }
                      onAddBundle={() =>
                        navigate({ to: "/bundle/new", search: { id: undefined, categoryId: group.category!.id } })
                      }
                      onArchive={() => setConfirm({ action: "archive", target: "category", category: group.category! })}
                      onDelete={() => setConfirm({ action: "delete", target: "category", category: group.category! })}
                    />
                  ) : null}
                </div>

                {group.items.length === 0 ? (
                  <p className="rounded-lg bg-card px-6 py-8 text-center text-body text-muted-foreground shadow-[inset_0_0_0_1px_var(--color-border)]">
                    No services in this category yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {group.items.map((item) => (
                      <ServiceRow
                        key={`${item.kind}-${item.id}`}
                        name={item.name}
                        bundle={item.kind === "bundle"}
                        archived={isArchived(item)}
                        color={group.category?.color ?? "var(--color-border)"}
                        duration={formatDuration(itemDuration(item))}
                        price={priceLabel(item)}
                        onOpen={() => openItem(item)}
                        menu={
                          <>
                            <DropdownMenuItem className={menuItem} onSelect={() => openItem(item)}>
                              Edit
                            </DropdownMenuItem>
                            {item.kind === "service" ? (
                              <DropdownMenuItem
                                className={menuItem}
                                disabled={duplicateService.isPending}
                                onSelect={() => duplicateService.mutate(item.service)}
                              >
                                Duplicate
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem className={menuItem} onSelect={soon("Quick booking links")}>
                              Quick booking link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-2" />
                            <DropdownMenuItem
                              className={menuItem}
                              onSelect={() => setConfirm({ action: "archive", target: "item", item })}
                            >
                              {item.archived ? "Unarchive" : "Archive"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={cn(menuItem, "text-destructive focus:text-destructive")}
                              onSelect={() => setConfirm({ action: "delete", target: "item", item })}
                            >
                              Permanently delete
                            </DropdownMenuItem>
                          </>
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>
      </div>

      <CategoryFormDialog
        open={categoryForm !== null}
        initial={categoryForm ?? newCategory()}
        saving={saveCategory.isPending}
        onSubmit={(value) => saveCategory.mutate(value)}
        onClose={() => setCategoryForm(null)}
      />

      <FilterModal
        open={draftFilters !== null}
        onClose={() => setDraftFilters(null)}
        onClear={() => {
          setFilters(DEFAULT_FILTERS);
          setDraftFilters(null);
        }}
        onApply={() => {
          if (draftFilters) setFilters(draftFilters);
          setDraftFilters(null);
        }}
      >
        {draftFilters ? (
          <>
            <FilterSelect
              label="Status"
              value={draftFilters.status}
              onChange={(status) => setDraftFilters({ ...draftFilters, status: status as Filters["status"] })}
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
              ]}
            />
            <FilterSelect
              label="Type"
              value={draftFilters.type}
              onChange={(type) => setDraftFilters({ ...draftFilters, type: type as Filters["type"] })}
              options={[
                { value: "all", label: "All types" },
                { value: "services", label: "Services" },
                { value: "bundles", label: "Bundles" },
              ]}
            />
            <FilterSelect
              label="Team member"
              value={draftFilters.team}
              onChange={(teamId) => setDraftFilters({ ...draftFilters, team: teamId })}
              options={[
                { value: "", label: "Any team member" },
                ...team.map((member) => ({ value: member.id, label: memberName(member) })),
              ]}
            />
          </>
        ) : null}
      </FilterModal>

      <ConfirmDialog
        open={confirm !== null}
        busy={runConfirm.isPending}
        destructive={confirm?.action === "delete"}
        {...confirmCopy(confirm)}
        onConfirm={() => confirm && runConfirm.mutate(confirm)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function sortOrder(item: MenuItem) {
  return item.kind === "service" ? item.service.sort_order : item.bundle.sort_order;
}

function confirmCopy(confirm: Confirm | null) {
  if (!confirm) return { title: "", body: "", confirmLabel: "" };
  const noun =
    confirm.target === "category" ? "category" : confirm.item.kind === "bundle" ? "bundle" : "service";
  const archived = confirm.target === "category" ? confirm.category.is_archived : confirm.item.archived;
  if (confirm.action === "delete") {
    return {
      title: `Permanently delete ${noun}`,
      body:
        confirm.target === "category"
          ? "Are you sure you want to delete this category? Its services will move to Uncategorised."
          : `Are you sure you want to delete this ${noun}?`,
      confirmLabel: "Delete",
    };
  }
  if (archived) {
    return {
      title: `Unarchive ${noun}`,
      body: `Are you sure you want to unarchive this ${noun}? It will show on your menu again.`,
      confirmLabel: "Unarchive",
    };
  }
  return {
    title: `Archive ${noun}`,
    body: `Are you sure you want to archive this ${noun}?`,
    confirmLabel: "Archive",
  };
}

function ArchivedBadge() {
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold text-muted-foreground">
      Archived
    </span>
  );
}

function CategoryRow({
  label,
  count,
  active,
  archived,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  archived?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-11 w-full items-center gap-3 rounded-[8px] px-4 text-left transition-colors",
          active ? "bg-accent" : "hover:bg-secondary",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate text-body font-medium", archived && "text-muted-foreground")}>
          {label}
        </span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgba(19,19,19,0.05)] px-1.5 text-caption font-semibold text-muted-foreground">
          {count}
        </span>
      </button>
    </li>
  );
}

function CategoryActions({
  category,
  onEdit,
  onAddService,
  onAddBundle,
  onArchive,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onAddService: () => void;
  onAddBundle: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-input bg-card px-4 text-body font-medium transition-colors hover:bg-secondary data-[state=open]:bg-secondary"
        >
          Actions
          <CaretDown size={14} weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl p-2">
        <DropdownMenuItem className={menuItem} onSelect={onEdit}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItem} onSelect={onAddService}>
          Add service
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItem} onSelect={onAddBundle}>
          Add bundle
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItem} onSelect={onArchive}>
          {category.is_archived ? "Unarchive" : "Archive"}
        </DropdownMenuItem>
        <DropdownMenuItem className={cn(menuItem, "text-destructive focus:text-destructive")} onSelect={onDelete}>
          Permanently delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Fresha's service card: 96px, 12px radius, 1px inset ring, 8px category-colour stripe on the left. */
function ServiceRow({
  name,
  bundle,
  archived,
  color,
  duration,
  price,
  onOpen,
  menu,
}: {
  name: string;
  bundle: boolean;
  archived: boolean;
  color: string;
  duration: string;
  price: string;
  onOpen: () => void;
  menu: React.ReactNode;
}) {
  return (
    <li className="relative flex min-h-24 overflow-hidden rounded-lg bg-card shadow-[inset_0_0_0_1px_var(--color-border)] transition-colors hover:bg-[#fcfcfc]">
      <button type="button" onClick={onOpen} className="absolute inset-0" aria-label={`Edit ${name}`} />
      <span aria-hidden className="w-2 shrink-0" style={{ backgroundColor: color, opacity: archived ? 0.4 : 1 }} />
      <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-4 p-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className={cn("flex items-center gap-2 text-heading font-medium", archived && "text-muted-foreground")}>
            <span className="truncate">{name}</span>
            {bundle ? (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-primary">
                Bundle
              </span>
            ) : null}
            {archived ? <ArchivedBadge /> : null}
          </p>
          <p className="text-body text-muted-foreground">{duration}</p>
        </div>
        <p className="whitespace-nowrap text-body font-medium">{price}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`More actions for ${name}`}
              className="pointer-events-auto relative flex size-9 items-center justify-center rounded-full transition-colors hover:bg-secondary data-[state=open]:bg-secondary"
            >
              <DotsThreeVertical size={22} weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function EmptyMenu({ filtered, onAdd }: { filtered: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-card px-6 py-16 text-center shadow-[inset_0_0_0_1px_var(--color-border)]">
      <p className="text-heading font-semibold">{filtered ? "No services found" : "No services yet"}</p>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">
        {filtered
          ? "Try a different search or change the filters."
          : "Add a single service or a bundle to start building your menu."}
      </p>
      {filtered ? null : (
        <button type="button" onClick={onAdd} className={cn(pillButton, "mt-4 bg-ink text-ink-foreground hover:bg-ink/90")}>
          Add service
        </button>
      )}
    </div>
  );
}
