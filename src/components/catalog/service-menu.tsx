import { useMemo, useState } from "react";
import {
  CaretDown,
  DotsThreeVertical,
  FadersHorizontal,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  CategoryDialog,
  ServiceDialog,
  emptyCategory,
  emptyService,
  type CategoryDraft,
  type ServiceDraft,
} from "@/components/catalog/service-dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
};

type Service = {
  id: string;
  name: string;
  category_id: string | null;
  pricing_type: string;
  price: number | null;
  duration_minutes: number;
  sort_order: number;
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
  bundle_services: { services: { price: number | null; duration_minutes: number } | null }[];
};

type MenuItem =
  | { kind: "service"; id: string; name: string; categoryId: string | null; service: Service }
  | { kind: "bundle"; id: string; name: string; categoryId: string | null; bundle: Bundle };

const soon = (label: string) => () => toast(`${label} — coming soon`);


export function ServiceMenu() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<CategoryDraft | null>(null);
  const [serviceDialog, setServiceDialog] = useState<ServiceDraft | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["service-categories", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, name, color, description, sort_order")
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
        .select("id, name, category_id, pricing_type, price, duration_minutes, sort_order")
        .eq("business_id", businessId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const bundlesQuery = useQuery({
    queryKey: ["bundles", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Bundle[]> => {
      const { data, error } = await supabase
        .from("bundles")
        .select(
          "id, name, category_id, schedule_type, pricing_mode, custom_price, discount_percentage, sort_order, bundle_services(services(price, duration_minutes))",
        )
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Bundle[];
    },
  });

  const categories = categoriesQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const bundles = bundlesQuery.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["service-categories", businessId] });
    queryClient.invalidateQueries({ queryKey: ["services", businessId] });
    queryClient.invalidateQueries({ queryKey: ["bundles", businessId] });
  };


  const saveCategory = useMutation({
    mutationFn: async (draft: CategoryDraft) => {
      const payload = {
        business_id: businessId!,
        name: draft.name.trim(),
        color: draft.color,
        description: draft.description.trim() || null,
      };
      const { error } = draft.id
        ? await supabase.from("service_categories").update(payload).eq("id", draft.id)
        : await supabase.from("service_categories").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setCategoryDialog(null);
      refresh();
      toast.success("Category saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveService = useMutation({
    mutationFn: async (draft: ServiceDraft) => {
      const minutes =
        (Number(draft.hours) || 0) * 60 + (Number(draft.minutes) || 0);
      const payload = {
        business_id: businessId!,
        category_id: draft.categoryId,
        name: draft.name.trim(),
        pricing_type: draft.pricingType,
        price: draft.pricingType === "fixed" ? Number(draft.price) || 0 : null,
        duration_minutes: minutes || 15,
      };
      const { error } = draft.id
        ? await supabase.from("services").update(payload).eq("id", draft.id)
        : await supabase.from("services").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setServiceDialog(null);
      refresh();
      toast.success("Service saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Service deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteBundle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bundles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Bundle deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = useMemo<MenuItem[]>(() => {
    const serviceItems: MenuItem[] = services.map((service) => ({
      kind: "service",
      id: service.id,
      name: service.name,
      categoryId: service.category_id,
      service,
    }));
    const bundleItems: MenuItem[] = bundles.map((bundle) => ({
      kind: "bundle",
      id: bundle.id,
      name: bundle.name,
      categoryId: bundle.category_id,
      bundle,
    }));
    return [...serviceItems, ...bundleItems];
  }, [services, bundles]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory && item.categoryId !== selectedCategory) return false;
      if (term && !item.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, search, selectedCategory]);

  const countFor = (categoryId: string) =>
    items.filter((item) => item.categoryId === categoryId).length;

  const activeCategory = categories.find((c) => c.id === selectedCategory) ?? null;

  const bundleServices = (bundle: Bundle) =>
    bundle.bundle_services
      .map((row) => row.services)
      .filter((service): service is { price: number | null; duration_minutes: number } =>
        Boolean(service),
      );

  const itemDuration = (item: MenuItem) =>
    item.kind === "service"
      ? item.service.duration_minutes
      : bundleDuration(bundleServices(item.bundle), item.bundle.schedule_type);

  const priceLabel = (item: MenuItem) => {
    if (item.kind === "bundle") {
      if (!business) return "—";
      const amount = bundlePrice(
        {
          pricing_mode: item.bundle.pricing_mode,
          custom_price: item.bundle.custom_price,
          discount_percentage: item.bundle.discount_percentage,
        },
        bundleServices(item.bundle),
      );
      return amount === 0 ? "Free" : formatMoney(amount, business.currency, business.country);
    }
    const service = item.service;
    if (service.pricing_type === "free") return "Free";
    if (service.pricing_type === "free-form") return "Free-form";
    if (!business) return "—";
    return formatMoney(Number(service.price ?? 0), business.currency, business.country);
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Service menu</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            View and manage the services offered by your business.{" "}
            <a href="#" className="font-semibold text-primary hover:underline">
              Learn more
            </a>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-12 gap-2 rounded-full bg-white px-6 text-base font-semibold text-foreground hover:bg-white hover:text-foreground border border-border"
              >
                Options
                <CaretDown size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-3">
              {[
                "Quick booking link",
                "Set menu order",
                "Set booking sequence",
                "Bulk edit services",
                "Settings",
              ].map((label) => (
                <DropdownMenuItem
                  key={label}
                  className="px-4 py-2.5 text-sm font-medium text-foreground gap-3"
                  onClick={soon(label)}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-12 gap-2 rounded-full px-6 text-base font-semibold">
                Add
                <CaretDown size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-3">
              <DropdownMenuItem
                className="px-4 py-2.5 text-sm font-medium text-foreground gap-3"
                onClick={() => navigate({ to: "/service/new" })}
              >
                Single service
              </DropdownMenuItem>
              <DropdownMenuItem
                className="px-4 py-2.5 text-sm font-medium text-foreground gap-3"
                onClick={soon("Bundle")}
              >
                Bundle
              </DropdownMenuItem>
              <DropdownMenuItem
                className="px-4 py-2.5 text-sm font-medium text-foreground gap-3"
                onClick={() => setCategoryDialog({ ...emptyCategory })}
              >
                Category
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search / filter row */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-11 rounded-full pl-10"
            placeholder="Search service name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2" onClick={soon("Filters")}>
          Filters
          <FadersHorizontal size={16} />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Categories */}
        <aside className="h-fit rounded-2xl border border-border bg-card p-4">
          <h3 className="px-2 text-lg font-bold text-foreground">Categories</h3>
          <ul className="mt-3 space-y-1">
            <li>
              <CategoryRow
                label="All categories"
                count={services.length}
                active={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
              />
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <CategoryRow
                  label={category.name}
                  color={category.color}
                  count={countFor(category.id)}
                  active={selectedCategory === category.id}
                  onClick={() => setSelectedCategory(category.id)}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 px-2 py-1 text-sm font-semibold text-primary hover:underline"
            onClick={() => setCategoryDialog({ ...emptyCategory })}
          >
            Add category
          </button>
        </aside>

        {/* Services */}
        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-foreground">
              {activeCategory ? activeCategory.name : "All services"}
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  Actions
                  <CaretDown size={14} weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {["Edit category", "Delete category", "Reorder services"].map((label) => (
                  <DropdownMenuItem key={label} onClick={soon(label)}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-4 space-y-3">
            {servicesQuery.isLoading || bundlesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading services…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <p className="text-sm font-medium text-foreground">No services yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a single service or a bundle to start building your menu.
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const category = categories.find((c) => c.id === item.categoryId);
                return (
                  <article
                    key={`${item.kind}-${item.id}`}
                    className="flex items-center gap-4 overflow-hidden rounded-3xl border border-border bg-card"
                  >
                    <span
                      aria-hidden
                      className="h-[76px] w-1.5 shrink-0 rounded-r-full"
                      style={{ backgroundColor: category?.color ?? "hsl(var(--muted))" }}
                    />
                    <div className="min-w-0 flex-1 py-4">
                      <p className="flex items-center gap-2 truncate font-semibold text-foreground">
                        <span className="truncate">{item.name}</span>
                        {item.kind === "bundle" ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            Bundle
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatDuration(itemDuration(item))}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-sm font-semibold text-foreground">
                      {priceLabel(item)}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-3 rounded-full"
                          aria-label={`Actions for ${item.name}`}
                        >
                          <DotsThreeVertical size={18} weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => {
                            if (item.kind === "bundle") {
                              navigate({ to: "/bundle/new", search: { id: item.id } });
                              return;
                            }
                            const service = item.service;
                            setServiceDialog({
                              id: service.id,
                              name: service.name,
                              categoryId: service.category_id,
                              pricingType:
                                (service.pricing_type as ServiceDraft["pricingType"]) ?? "fixed",
                              price: service.price != null ? String(service.price) : "",
                              hours: String(Math.floor(service.duration_minutes / 60)),
                              minutes: String(service.duration_minutes % 60),
                            });
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            item.kind === "bundle"
                              ? deleteBundle.mutate(item.id)
                              : deleteService.mutate(item.id)
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </article>
                );
              })
            )}

            )}
          </div>
        </section>
      </div>

      <CategoryDialog
        open={categoryDialog !== null}
        onOpenChange={(open) => !open && setCategoryDialog(null)}
        initial={categoryDialog ?? emptyCategory}
        saving={saveCategory.isPending}
        onSubmit={(draft) => saveCategory.mutate(draft)}
      />

      <ServiceDialog
        open={serviceDialog !== null}
        onOpenChange={(open) => !open && setServiceDialog(null)}
        initial={serviceDialog ?? emptyService}
        categories={categories}
        saving={saveService.isPending}
        onSubmit={(draft) => saveService.mutate(draft)}
        onCreateCategory={() => setCategoryDialog({ ...emptyCategory })}
      />
    </div>
  );
}

function CategoryRow({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors active:scale-[0.99]",
        active ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {color ? (
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
      <span className="h-6 w-6 rounded-full border border-border bg-card text-center text-xs font-medium leading-6 text-muted-foreground">
        {count}
      </span>
    </button>
  );
}
