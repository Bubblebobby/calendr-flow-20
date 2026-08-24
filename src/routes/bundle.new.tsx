import { useEffect, useMemo, useRef, useState } from "react";
import {
  DotsThreeVertical,
  Image as ImageIcon,
  MagnifyingGlass,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CategoryDialog, emptyCategory } from "@/components/catalog/service-dialogs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { requireOnboardedUser } from "@/lib/auth-guard";
import {
  bundleDuration,
  bundlePrice,
  servicesSubtotal,
  type BundlePricingMode,
  type BundleScheduleType,
} from "@/lib/bundle-pricing";
import { formatDuration, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

const BUCKET = "bundle-portfolio-images";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FIELD =
  "h-12 rounded-xl border border-border bg-transparent text-base transition-colors";

type BundleService = {
  id: string;
  name: string;
  price: number | null;
  pricing_type: string;
  duration_minutes: number;
};

export const Route = createFileRoute("/bundle/new")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New bundle — Bookly" },
      {
        name: "description",
        content: "Group services together into a bookable bundle for your business.",
      },
      { property: "og:title", content: "New bundle — Bookly" },
      {
        property: "og:description",
        content: "Group services together into a bookable bundle for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BundleFormPage,
});

function BundleFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: bundleId } = Route.useSearch();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const editing = Boolean(bundleId);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [scheduleType, setScheduleType] = useState<BundleScheduleType>("sequence");
  const [pricingMode, setPricingMode] = useState<BundlePricingMode>("service_pricing");
  const [customPrice, setCustomPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [onlineBooking, setOnlineBooking] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categoriesQuery = useQuery({
    queryKey: ["service-categories", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, name, color, sort_order")
        .eq("business_id", businessId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const categories = categoriesQuery.data ?? [];

  const servicesQuery = useQuery({
    queryKey: ["services", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<BundleService[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, pricing_type, duration_minutes")
        .eq("business_id", businessId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const allServices = servicesQuery.data ?? [];

  const bundleQuery = useQuery({
    queryKey: ["bundle", bundleId],
    enabled: Boolean(bundleId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles")
        .select(
          "id, name, category_id, description, schedule_type, pricing_mode, custom_price, discount_percentage, online_booking_enabled, portfolio_image_url, portfolio_image_path, bundle_services(service_id)",
        )
        .eq("id", bundleId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Hydrate the form once when editing an existing bundle.
  const hydrated = useRef(false);
  useEffect(() => {
    const bundle = bundleQuery.data;
    if (!bundle || hydrated.current) return;
    hydrated.current = true;
    setName(bundle.name);
    setCategoryId(bundle.category_id ?? "");
    setDescription(bundle.description ?? "");
    setScheduleType(bundle.schedule_type as BundleScheduleType);
    setPricingMode(bundle.pricing_mode as BundlePricingMode);
    setCustomPrice(bundle.custom_price != null ? String(bundle.custom_price) : "");
    setDiscount(
      bundle.discount_percentage != null ? String(bundle.discount_percentage) : "",
    );
    setOnlineBooking(bundle.online_booking_enabled);
    setImagePath(bundle.portfolio_image_path ?? null);
    setImageUrl(bundle.portfolio_image_url ?? null);
    setSelectedIds(
      (bundle.bundle_services ?? []).map((row: { service_id: string }) => row.service_id),
    );
  }, [bundleQuery.data]);

  // Signed preview for the stored cover image (bucket is private).
  useEffect(() => {
    let cancelled = false;
    if (!imagePath) {
      setImagePreview(null);
      return;
    }
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(imagePath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setImagePreview(data?.signedUrl ?? imageUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [imagePath, imageUrl]);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => allServices.find((service) => service.id === id))
        .filter((service): service is BundleService => Boolean(service)),
    [selectedIds, allServices],
  );

  const pickerResults = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();
    return allServices.filter(
      (service) => !term || service.name.toLowerCase().includes(term),
    );
  }, [allServices, serviceSearch]);

  const subtotal = servicesSubtotal(selected);
  const finalPrice = bundlePrice(
    {
      pricing_mode: pricingMode,
      custom_price: Number(customPrice) || 0,
      discount_percentage: Number(discount) || 0,
    },
    selected,
  );
  const totalDuration = bundleDuration(selected, scheduleType);

  const money = (amount: number) =>
    business ? formatMoney(amount, business.currency, business.country) : "—";

  const errors = {
    name: name.trim() ? null : "Bundle name is required",
    services:
      selected.length >= 2 ? null : "Select at least 2 services to create a bundle",
  };
  const hasErrors = Boolean(errors.name || errors.services);

  const createCategory = useMutation({
    mutationFn: async (draft: { name: string; color: string; description: string }) => {
      const { data, error } = await supabase
        .from("service_categories")
        .insert({
          business_id: businessId!,
          name: draft.name.trim(),
          color: draft.color,
          description: draft.description.trim() || null,
          sort_order: categories.length,
        })
        .select("id, name, color, sort_order")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["service-categories", businessId] });
      setCategoryId(created.id);
      setCategoryOpen(false);
      toast.success("Category added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${businessId}/${bundleId ?? "draft"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const previous = imagePath;
      if (previous) await supabase.storage.from(BUCKET).remove([previous]);
      return { path, url: data.publicUrl };
    },
    onSuccess: ({ path, url }) => {
      setImagePath(path);
      setImageUrl(url);
      toast.success("Cover image uploaded");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeImage = async () => {
    if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath]);
    setImagePath(null);
    setImageUrl(null);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError(`${file.name} is not an image file`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`${file.name} is larger than 5MB`);
      return;
    }
    setFileError(null);
    uploadImage.mutate(file);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId!,
        name: name.trim(),
        category_id: categoryId || null,
        description: description.trim() || null,
        schedule_type: scheduleType,
        pricing_mode: pricingMode,
        custom_price: pricingMode === "custom" ? Number(customPrice) || 0 : null,
        discount_percentage:
          pricingMode === "percentage_discount" ? Number(discount) || 0 : null,
        online_booking_enabled: onlineBooking,
        portfolio_image_url: imageUrl,
        portfolio_image_path: imagePath,
      };

      let id = bundleId;
      if (id) {
        const { error } = await supabase.from("bundles").update(payload).eq("id", id);
        if (error) throw error;
        const { error: clearError } = await supabase
          .from("bundle_services")
          .delete()
          .eq("bundle_id", id);
        if (clearError) throw clearError;
      } else {
        const { data, error } = await supabase
          .from("bundles")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }

      const { error: linkError } = await supabase.from("bundle_services").insert(
        selectedIds.map((serviceId, index) => ({
          bundle_id: id!,
          service_id: serviceId,
          sort_order: index,
        })),
      );
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles", businessId] });
      toast.success(editing ? "Bundle updated" : "Bundle created");
      navigate({ to: "/catalog" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onSave = () => {
    setTouched(true);
    if (hasErrors) {
      toast.error("Check the highlighted fields");
      return;
    }
    save.mutate();
  };

  return (
    <div className="bg-background min-h-screen lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
      <header className="shrink-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-8 py-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {editing ? "Edit bundle" : "New bundle"}
          </h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-full bg-white px-6 text-base font-semibold text-foreground hover:bg-white hover:text-foreground"
              onClick={() => navigate({ to: "/catalog" })}
            >
              Close
            </Button>
            <Button
              className="h-11 rounded-full px-7 text-base font-semibold"
              onClick={onSave}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto px-8 pb-16 pt-12 lg:flex-1">
        {/* Basic details */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-foreground">Basic details</h2>
          <div className="mt-6 space-y-6">
            <Field
              label="Bundle name"
              counter={`${name.length}/255`}
              error={touched ? errors.name : null}
            >
              <Input
                className={cn(FIELD, touched && errors.name && "border-destructive")}
                placeholder="Add a bundle name, e.g. Cut & Colour Package"
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <Field label="Category" hint="Groups this bundle on your menu">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className={FIELD}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="p-2">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="py-2.5">
                      <span className="flex items-center gap-3">
                        <span
                          className="size-5 shrink-0 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                  {categories.length > 0 ? <div className="my-2 h-px bg-border" /> : null}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setCategoryOpen(true);
                    }}
                  >
                    <Plus weight="bold" className="size-4" />
                    Add category
                  </button>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Description" optional counter={`${description.length}/1000`}>
              <Textarea
                className="min-h-28 rounded-xl bg-transparent text-base"
                placeholder="Add a short description"
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* Services */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-foreground">Services</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select which services to include in this bundle and how they should be sequenced when
            booked.
          </p>

          <div className="mt-6 space-y-4">
            {selected.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
                No services added yet.
              </div>
            ) : (
              selected.map((service, index) => (
                <div
                  key={service.id}
                  className="flex h-16 items-center gap-4 bg-card"
                >
                  <span
                    aria-hidden
                    className="h-full w-[0.425rem] shrink-0 bg-sky-200"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-foreground">
                      {service.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(service.duration_minutes)}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-base font-medium text-foreground">
                    {service.pricing_type === "fixed"
                      ? money(Number(service.price ?? 0))
                      : service.pricing_type === "free"
                        ? "Free"
                        : "Free-form"}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full text-muted-foreground"
                        aria-label={`Actions for ${service.name}`}
                      >
                        <DotsThreeVertical size={18} weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        disabled={index === 0}
                        onClick={() =>
                          setSelectedIds((ids) => {
                            const next = [...ids];
                            [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                            return next;
                          })
                        }
                      >
                        Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === selected.length - 1}
                        onClick={() =>
                          setSelectedIds((ids) => {
                            const next = [...ids];
                            [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                            return next;
                          })
                        }
                      >
                        Move down
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setSelectedIds((ids) => ids.filter((id) => id !== service.id))
                        }
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>

          {touched && errors.services ? (
            <p className="mt-3 text-xs font-medium text-destructive">{errors.services}</p>
          ) : null}

          {pickerOpen ? (
            <div className="mt-4 rounded-2xl border border-border p-4">
              <div className="relative">
                <MagnifyingGlass
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  autoFocus
                  className="h-11 rounded-full pl-10"
                  placeholder="Search services"
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                />
              </div>
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                {pickerResults.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-muted-foreground">
                    No services match that search.
                  </li>
                ) : (
                  pickerResults.map((service) => {
                    const isSelected = selectedIds.includes(service.id);
                    return (
                      <li key={service.id}>
                        <button
                          type="button"
                          disabled={isSelected}
                          onClick={() => setSelectedIds((ids) => [...ids, service.id])}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                            isSelected
                              ? "cursor-default text-muted-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {service.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(service.duration_minutes)}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {isSelected ? "Added" : money(Number(service.price ?? 0))}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <Button
                variant="ghost"
                className="mt-2 text-sm font-semibold"
                onClick={() => setPickerOpen(false)}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-full bg-white px-6 text-base font-semibold text-foreground hover:bg-white hover:text-foreground"
                onClick={() => setPickerOpen(true)}
              >
                <Plus size={18} weight="bold" />
                Add service
              </Button>
              {selected.length > 0 ? (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Total duration:{" "}
                    <span className="font-semibold text-muted-foreground">
                      {formatDuration(totalDuration)}
                    </span>
                  </span>
                  <span className="text-base font-semibold text-foreground">
                    {money(finalPrice || subtotal)}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* Scheduling */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-foreground">Scheduling</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(
              [
                {
                  value: "sequence" as const,
                  label: "Sequence",
                  hint: "Services are delivered one after another",
                },
                {
                  value: "parallel" as const,
                  label: "Parallel",
                  hint: "Services are delivered at the same time",
                },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScheduleType(option.value)}
                aria-pressed={scheduleType === option.value}
                className={cn(
                  "rounded-2xl border p-5 text-left transition-colors",
                  scheduleType === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <p className="text-base font-semibold text-foreground">{option.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{option.hint}</p>
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Total duration:{" "}
            <span className="font-semibold text-foreground">
              {formatDuration(totalDuration)}
            </span>
          </p>
        </section>

        {/* Pricing */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-foreground">Pricing</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field label="Pricing mode">
              <Select
                value={pricingMode}
                onValueChange={(value) => setPricingMode(value as BundlePricingMode)}
              >
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_pricing">Use service pricing</SelectItem>
                  <SelectItem value="custom">Custom pricing</SelectItem>
                  <SelectItem value="percentage_discount">Percentage discount</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {pricingMode === "custom" ? (
              <Field label="Price">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    {business?.currency ?? ""}
                  </span>
                  <Input
                    className={cn(FIELD, "pl-16")}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={customPrice}
                    onChange={(event) => setCustomPrice(event.target.value)}
                  />
                </div>
              </Field>
            ) : pricingMode === "percentage_discount" ? (
              <Field label="Discount">
                <div className="relative">
                  <Input
                    className={cn(FIELD, "pr-10")}
                    inputMode="decimal"
                    placeholder="0"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    %
                  </span>
                </div>
              </Field>
            ) : (
              <Field label="Price">
                <Input className={cn(FIELD)} readOnly value={money(finalPrice)} />
              </Field>
            )}
          </div>

          <div className="mt-6 space-y-1 rounded-2xl border border-border bg-muted/40 px-5 py-4">
            <p className="flex items-center justify-between text-sm text-muted-foreground">
              Services subtotal
              <span className="font-medium text-foreground">{money(subtotal)}</span>
            </p>
            <p className="flex items-center justify-between text-base font-semibold text-foreground">
              Bundle price
              <span>{money(finalPrice)}</span>
            </p>
          </div>
        </section>

        {/* Online booking */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Online booking</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enable online booking for this bundle so clients can book it directly
                online.
              </p>
            </div>
            <Switch
              checked={onlineBooking}
              onCheckedChange={setOnlineBooking}
              aria-label="Enable online booking for this bundle"
            />
          </div>
        </section>

        {/* Portfolio image */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-foreground">Portfolio image</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One cover image shown to clients when they browse this bundle online.
          </p>

          {imagePath ? (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <img
                src={imagePreview ?? imageUrl ?? ""}
                alt="Bundle cover"
                className="size-32 rounded-2xl border border-border object-cover"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="h-11 rounded-full bg-card px-6 text-base font-semibold"
                  disabled={uploadImage.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  Replace
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 gap-2 rounded-full px-5 text-base font-semibold text-destructive"
                  onClick={() => void removeImage()}
                >
                  <Trash size={18} />
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") fileRef.current?.click();
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFile(event.dataTransfer.files[0]);
              }}
              className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border px-6 py-12 text-center"
            >
              <ImageIcon size={32} className="text-foreground" />
              <p className="mt-3 text-lg font-bold text-foreground">
                Add your cover image here
              </p>
              <Button
                variant="outline"
                className="mt-4 h-11 rounded-full bg-card px-6 text-base font-semibold text-foreground"
                disabled={uploadImage.isPending || !businessId}
                onClick={(event) => {
                  event.stopPropagation();
                  fileRef.current?.click();
                }}
              >
                {uploadImage.isPending ? "Uploading…" : "Choose a file"}
              </Button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {fileError ? (
            <p className="mt-2 text-sm font-medium text-destructive">{fileError}</p>
          ) : null}
        </section>
      </div>

      <CategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        initial={emptyCategory}
        saving={createCategory.isPending}
        onSubmit={(draft) => createCategory.mutate(draft)}
      />
    </div>
  );
}

function Field({
  label,
  optional,
  counter,
  hint,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  counter?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <Label className="text-sm font-semibold text-foreground">
          {label}
          {optional ? (
            <span className="ml-1 font-normal text-muted-foreground">(Optional)</span>
          ) : null}
        </Label>
        {counter ? <span className="text-xs text-muted-foreground">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
