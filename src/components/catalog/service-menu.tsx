import { useMemo, useState } from "react";
import {
  CaretDown,
  DotsThreeVertical,
  FadersHorizontal,
  MagnifyingGlass,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const soon = (label: string) => () => toast(`${label} — coming soon`);

export function ServiceMenu() {
  const queryClient = useQueryClient();
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

  const categories = categoriesQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["service-categories", businessId] });
    queryClient.invalidateQueries({ queryKey: ["services", businessId] });
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return services.filter((service) => {
      if (selectedCategory && service.category_id !== selectedCategory) return false;
      if (term && !service.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [services, search, selectedCategory]);

  const countFor = (categoryId: string) =>
    services.filter((service) => service.category_id === categoryId).length;

  const activeCategory = categories.find((c) => c.id === selectedCategory) ?? null;

  const priceLabel = (service: Service) => {
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
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                Options
                <CaretDown size={14} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {[
                "Quick booking link",
                "Set menu order",
                "Set booking sequence",
                "Bulk edit services",
                "Settings",
              ].map((label) => (
                <DropdownMenuItem key={label} onClick={soon(label)}>
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {["Download PDF", "Download Excel", "Download CSV"].map((label) => (
                <DropdownMenuItem key={label} onClick={soon(label)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                Add
                <CaretDown size={14} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() =>
                  setServiceDialog({ ...emptyService, categoryId: selectedCategory })
                }
              >
                Single service
              </DropdownMenuItem>
              <DropdownMenuItem onClick={soon("Bundle")}>Bundle</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryDialog({ ...emptyCategory })}>
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
        <Button variant="outline" className="ml-auto gap-2" onClick={soon("Manage order")}>
          <ArrowsDownUp size={16} />
          Manage order
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
            {servicesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading services…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <p className="text-sm font-medium text-foreground">No services yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a single service to start building your menu.
                </p>
              </div>
            ) : (
              filtered.map((service) => {
                const category = categories.find((c) => c.id === service.category_id);
                return (
                  <article
                    key={service.id}
                    className="flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <span
                      aria-hidden
                      className="h-[76px] w-1.5 shrink-0 rounded-r-full"
                      style={{ backgroundColor: category?.color ?? "hsl(var(--muted))" }}
                    />
                    <div className="min-w-0 flex-1 py-4">
                      <p className="truncate font-semibold text-foreground">{service.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatDuration(service.duration_minutes)}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-sm font-semibold text-foreground">
                      {priceLabel(service)}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-3 rounded-full"
                          aria-label={`Actions for ${service.name}`}
                        >
                          <DotsThreeVertical size={18} weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() =>
                            setServiceDialog({
                              id: service.id,
                              name: service.name,
                              categoryId: service.category_id,
                              pricingType:
                                (service.pricing_type as ServiceDraft["pricingType"]) ?? "fixed",
                              price: service.price != null ? String(service.price) : "",
                              hours: String(Math.floor(service.duration_minutes / 60)),
                              minutes: String(service.duration_minutes % 60),
                            })
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteService.mutate(service.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </article>
                );
              })
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
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {count}
      </span>
    </button>
  );
}
