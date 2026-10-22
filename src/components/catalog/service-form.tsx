import { useEffect, useMemo, useState } from "react";
import { CaretDown, Plus, PlusCircle, X } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  CategoryDialog,
  emptyCategory,
} from "@/components/catalog/service-dialogs";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/format";
import { TREATMENT_GROUPS } from "@/lib/treatment-types";
import {
  TeamMembersSection,
  reconcileServiceTeam,
  useServiceTeamAssignments,
  useTeamMembers,
} from "@/components/catalog/service-team-members";
import {
  PortfolioImagesSection,
  attachDraftPortfolioImages,
} from "@/components/catalog/service-portfolio-images";
import { useBusiness } from "@/lib/use-business";
import { TaxRateSelect, useTaxRates } from "@/components/settings/tax-settings";
import { cn } from "@/lib/utils";

const SORTED_TREATMENT_GROUPS = [...TREATMENT_GROUPS].sort((a, b) =>
  a.label.localeCompare(b.label),
);

const NAV_PRIMARY = [
  { key: "basic", label: "Basic details" },
  { key: "team", label: "Team members" },
  { key: "resources", label: "Resources" },
  { key: "addons", label: "Service add-ons" },
] as const;

const NAV_SETTINGS = [
  { key: null, label: "Online booking", badge: null as number | null },
  { key: "portfolio", label: "Portfolio images", badge: null },
  { key: null, label: "Forms", badge: 0 },
  { key: null, label: "Commissions", badge: null },
  { key: null, label: "Settings", badge: null },
];

const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

const EXTRA_TIME_TYPES = [
  {
    key: "processing",
    label: "Processing time",
    hint: "Team member is available during this time, included in the client-facing duration",
  },
  {
    key: "blocked",
    label: "Blocked time",
    hint: "Team member stays occupied, excluded from the client-facing duration",
  },
  {
    key: "extra_servicing",
    label: "Extra servicing time",
    hint: "Team member finishes up after the service, added to the total duration",
  },
] as const;

type ExtraTimeKey = (typeof EXTRA_TIME_TYPES)[number]["key"];

type DurationSegment = { id: string; type: ExtraTimeKey; minutes: number };

type SavedSegment = { type: string; minutes: number };

const soon = (label: string) => () => toast(`${label} — coming soon`);

const FIELD =
  "h-12 rounded-[8px] border border-input bg-card text-body transition-colors";

export function ServiceForm({ serviceId, initialCategoryId }: { serviceId?: string; initialCategoryId?: string | undefined }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const isEdit = Boolean(serviceId);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId ?? "");
  const [treatmentType, setTreatmentType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [priceType, setPriceType] = useState<"fixed" | "free" | "free-form">("fixed");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState<string>("60");
  const [customDuration, setCustomDuration] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [section, setSection] = useState<"basic" | "team" | "portfolio">("basic");
  const [draftId] = useState(() => crypto.randomUUID());
  const [segments, setSegments] = useState<DurationSegment[]>([]);
  const [taxRateId, setTaxRateId] = useState("");
  const taxRates = useTaxRates();
  const [hydrated, setHydrated] = useState(false);

  const addSegment = (type: ExtraTimeKey) => {
    setSegments((rows) =>
      rows.some((row) => row.type === type)
        ? rows
        : [...rows, { id: crypto.randomUUID(), type, minutes: 15 }],
    );
  };

  const teamQuery = useTeamMembers(businessId);
  const teamMembers = teamQuery.data ?? [];
  const assignmentsQuery = useServiceTeamAssignments(serviceId);
  const existingAssignments = assignmentsQuery.data ?? [];
  const [selectedTeam, setSelectedTeam] = useState<string[] | null>(null);
  const teamSelection = selectedTeam ?? teamMembers.map((m) => m.id);

  const serviceQuery = useQuery({
    queryKey: ["service", serviceId],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "*",
        )
        .eq("id", serviceId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!isEdit || !serviceQuery.data || hydrated) return;
    const service = serviceQuery.data;
    setName(service.name ?? "");
    setCategoryId(service.category_id ?? "");
    setTreatmentType(service.treatment_type ?? "");
    setDescription(service.description ?? "");
    setPriceType((service.pricing_type as typeof priceType) ?? "fixed");
    setPrice(service.price != null ? String(service.price) : "");
    // duration_minutes is the full occupied time; the base duration excludes the extra-time segments.
    const segmentTotal = ((service.duration_segments ?? []) as SavedSegment[]).reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    const minutes = Math.max(5, (service.duration_minutes ?? 0) - segmentTotal);
    if (DURATIONS.includes(minutes)) {
      setDuration(String(minutes));
      setCustomDuration("");
    } else {
      setDuration("custom");
      setCustomDuration(String(minutes));
    }
    const savedSegments = ((service.duration_segments ?? []) as SavedSegment[]).map(
      (segment) => ({
        id: crypto.randomUUID(),
        type: segment.type as ExtraTimeKey,
        minutes: segment.minutes,
      }),
    );
    setSegments(savedSegments);
    setTaxRateId((service as { tax_rate_id?: string | null }).tax_rate_id ?? "");
    setHydrated(true);
  }, [isEdit, serviceQuery.data, hydrated]);

  useEffect(() => {
    if (selectedTeam !== null) return;
    if (isEdit && assignmentsQuery.isSuccess) {
      setSelectedTeam(existingAssignments);
    } else if (!isEdit && teamQuery.isSuccess) {
      setSelectedTeam(teamMembers.map((m) => m.id));
    }
  }, [
    selectedTeam,
    isEdit,
    assignmentsQuery.isSuccess,
    existingAssignments,
    teamQuery.isSuccess,
    teamMembers,
  ]);

  useEffect(() => {
    if (isEdit && serviceQuery.isSuccess && !serviceQuery.data) {
      toast.error("Service not found");
      navigate({ to: "/catalog" });
    }
  }, [isEdit, serviceQuery.isSuccess, serviceQuery.data, navigate]);

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

  const minutes = useMemo(() => {
    if (duration === "custom") return Number(customDuration) || 0;
    return Number(duration) || 0;
  }, [duration, customDuration]);

  const totalDuration = useMemo(
    () =>
      minutes +
      segments
        .filter((row) => row.type !== "blocked")
        .reduce((sum, row) => sum + row.minutes, 0),
    [minutes, segments],
  );

  const errors = {
    name: name.trim() ? null : "Service name is required",
    duration: minutes > 0 ? null : "Enter a duration in minutes",
    price:
      priceType === "fixed" && price !== "" && Number(price) < 0
        ? "Price cannot be negative"
        : null,
  };
  const hasErrors = Boolean(errors.name || errors.duration || errors.price);
  const show = (key: keyof typeof errors) => (touched[key] ? errors[key] : null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        category_id: categoryId || null,
        name: name.trim(),
        description: description.trim() || null,
        treatment_type: treatmentType || null,
        pricing_type: priceType,
        price: priceType === "fixed" ? Number(price) || 0 : null,
        // Store the full time the team member is occupied, so bookings everywhere use it.
        duration_minutes: minutes + segments.reduce((sum, row) => sum + row.minutes, 0),
        duration_segments: segments.map(({ type, minutes: value }) => ({
          type,
          minutes: value,
        })),
        // Only once tax rates exist (the column arrives with the same database update).
        ...(taxRates.data?.length ? { tax_rate_id: taxRateId || null } : {}),
      };

      if (isEdit) {
        const { error } = await supabase
          .from("services")
          .update(payload)
          .eq("id", serviceId!);
        if (error) throw error;
        await reconcileServiceTeam(serviceId!, teamSelection, existingAssignments);
      } else {
        const { data, error } = await supabase
          .from("services")
          .insert({ business_id: businessId!, ...payload })
          .select("id")
          .single();
        if (error) throw error;
        await reconcileServiceTeam(data.id, teamSelection, existingAssignments);
        await attachDraftPortfolioImages(data.id, draftId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", businessId] });
      queryClient.invalidateQueries({ queryKey: ["service", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["service-team-members", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["service-portfolio-images", serviceId ?? draftId] });
      toast.success(isEdit ? "Service saved" : "Service created");
      navigate({ to: "/catalog" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onSave = () => {
    setTouched({ name: true, duration: true, price: true });
    if (hasErrors) {
      toast.error("Check the highlighted fields");
      return;
    }
    save.mutate();
  };

  if (isEdit && serviceQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-base text-muted-foreground">Loading service…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
      <header className="z-20 shrink-0 bg-surface">
        <div className="flex h-[72px] w-full items-center justify-between gap-4 px-8">
          <span className="text-title font-semibold text-foreground">
            {isEdit ? "Edit service" : "New service"}
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-12 rounded-full border-input bg-white px-5 text-heading font-semibold text-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => navigate({ to: "/catalog" })}
            >
              Close
            </Button>
            <Button
              className="h-12 rounded-full px-5 text-heading font-semibold"
              onClick={onSave}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <div className="overflow-y-auto lg:flex-1">
      <div className="mx-auto w-full max-w-[1248px] px-8 pb-16 pt-9">
      <h1 className="text-[2.5rem] font-bold leading-[2.75rem] text-foreground">
        {isEdit ? "Edit service" : "New service"}
      </h1>
      <div className="mt-8 grid items-start gap-x-24 gap-y-6 lg:grid-cols-[296px_1fr]">
        {/* Section nav */}
        <nav className="h-fit self-start rounded-xl bg-card px-4 py-6">
          <ul className="space-y-1">
            {NAV_PRIMARY.map((item) => {
              const selectable = item.key === "basic" || item.key === "team";
              return (
                <li key={item.key}>
                  <NavRow
                    label={item.label}
                    badge={item.key === "team" ? teamSelection.length : null}
                    active={section === item.key}
                    onClick={
                      selectable
                        ? () => {
                            setSection(item.key as "basic" | "team");
                          }
                        : () => {
                            soon(item.label)();
                          }
                    }
                  />
                </li>
              );
            })}
          </ul>
          <div className="mx-4 my-4 h-px bg-border" />
          <p className="px-4 pb-2 text-heading font-semibold text-foreground">Settings</p>
          <ul className="space-y-1">
            {NAV_SETTINGS.map((item) => (
              <li key={item.label}>
                <NavRow
                  label={item.label}
                  badge={item.badge}
                  active={item.key === "portfolio" && section === "portfolio"}
                  onClick={
                    item.key === "portfolio"
                      ? () => {
                          setSection("portfolio");
                        }
                      : () => {
                          soon(item.label)();
                        }
                  }
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          {section === "portfolio" ? (
            <PortfolioImagesSection
              businessId={businessId}
              draftId={draftId}
              serviceId={serviceId}
            />
          ) : section === "team" ? (
            <TeamMembersSection
              businessId={businessId}
              members={teamMembers}
              loading={teamQuery.isLoading}
              selected={teamSelection}
              onChange={setSelectedTeam}
            />
          ) : (
            <>
              {/* Basic details */}
              <section className="rounded-xl border border-border bg-card px-6 py-8 sm:px-10">
                <h2 className="text-[1.5rem] font-semibold leading-8 text-foreground">Basic details</h2>

                <div className="mt-6 space-y-6">
                  <Field
                    label="Service name"
                    counter={`${name.length}/255`}
                    error={show("name")}
                  >
                    <Input
                      className={cn(FIELD, show("name") && "border-destructive")}
                      placeholder="Add a service name, e.g. Men's Haircut"
                      maxLength={255}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    />
                  </Field>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field
                      label="Menu category"
                      hint="The category displayed to you, and to clients online"
                    >
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger className={FIELD}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="p-2">
                          {categories.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={category.id}
                              className="py-2.5"
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  className="size-5 shrink-0 rounded-full"
                                  style={{ backgroundColor: category.color }}
                                />
                                <span className="font-medium">{category.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                          {categories.length > 0 ? (
                            <div className="my-2 h-px bg-border" />
                          ) : null}
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-body font-semibold text-primary hover:bg-primary/10"
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

                    <Field
                      label="Treatment type"
                      hint="Used to help clients find your service when browsing online"
                    >
                      <Select value={treatmentType} onValueChange={setTreatmentType}>
                        <SelectTrigger className={FIELD}>
                          <SelectValue placeholder="Select treatment type" />
                        </SelectTrigger>
                        <SelectContent className="max-h-96 rounded-2xl p-2">
                          {SORTED_TREATMENT_GROUPS.map((group) => (
                            <SelectGroup key={group.label}>
                              <SelectLabel className="px-3 pt-3 pb-2 text-base font-semibold text-foreground">
                                {group.label}
                              </SelectLabel>
                              {group.options.map((type) => (
                                <SelectItem
                                  key={`${group.label}-${type}`}
                                  value={type}
                                  className="rounded-xl px-3 py-2.5 text-base focus:bg-muted"
                                >
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field
                    label="Description"
                    optional
                    counter={`${description.length}/1000`}
                  >
                    <Textarea
                      className="min-h-32 rounded-[8px] border-input bg-card text-body"
                      placeholder="Add a short description"
                      maxLength={1000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </Field>
                </div>
              </section>

              {/* Pricing and duration */}
              <section className="rounded-xl border border-border bg-card px-6 py-8 sm:px-10">
                <h2 className="text-[1.5rem] font-semibold leading-8 text-foreground">Pricing and duration</h2>

                <div className="mt-6 grid gap-6 sm:grid-cols-3">
                  <Field label="Price type">
                    <Select
                      value={priceType}
                      onValueChange={(value) => setPriceType(value as typeof priceType)}
                    >
                      <SelectTrigger className={FIELD}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="free-form">Free-form</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Price" error={show("price")}>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body font-medium text-muted-foreground">
                        {business?.currency ?? ""}
                      </span>
                      <Input
                        className={cn(
                          FIELD,
                          "pl-16",
                          show("price") && "border-destructive",
                        )}
                        inputMode="decimal"
                        placeholder="0.00"
                        disabled={priceType !== "fixed"}
                        value={priceType === "fixed" ? price : ""}
                        onChange={(event) => setPrice(event.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, price: true }))}
                      />
                    </div>
                  </Field>

                  <Field label="Duration" error={show("duration")}>
                    <Select
                      value={duration}
                      onValueChange={(value) => {
                        setDuration(value);
                        setTouched((t) => ({ ...t, duration: true }));
                      }}
                    >
                      <SelectTrigger
                        className={cn(FIELD, show("duration") && "border-destructive")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {DURATIONS.map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            {formatDuration(value)}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom…</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {taxRates.data?.length ? (
                  <div className="mt-6 max-w-sm">
                    <TaxRateSelect value={taxRateId} onChange={setTaxRateId} />
                  </div>
                ) : null}

                {duration === "custom" ? (
                  <div className="mt-4 max-w-xs">
                    <Field label="Custom duration (minutes)" error={show("duration")}>
                      <Input
                        className={cn(FIELD, show("duration") && "border-destructive")}
                        inputMode="numeric"
                        placeholder="e.g. 25"
                        value={customDuration}
                        onChange={(event) => setCustomDuration(event.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, duration: true }))}
                      />
                    </Field>
                  </div>
                ) : null}

                {segments.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    <p className="text-body font-semibold text-foreground">Duration type</p>
                    {segments.map((segment) => {
                      const meta = EXTRA_TIME_TYPES.find((t) => t.key === segment.type)!;
                      return (
                        <div
                          key={segment.id}
                          className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4"
                        >
                          <div className="min-w-52 flex-1">
                            <p className="text-body font-semibold text-foreground">
                              {meta.label}
                            </p>
                            <p className="text-caption text-muted-foreground">{meta.hint}</p>
                          </div>
                          <Select
                            value={String(segment.minutes)}
                            onValueChange={(value) =>
                              setSegments((rows) =>
                                rows.map((row) =>
                                  row.id === segment.id
                                    ? { ...row, minutes: Number(value) }
                                    : row,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className={cn(FIELD, "w-44")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {DURATIONS.map((value) => (
                                <SelectItem key={value} value={String(value)}>
                                  {formatDuration(value)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${meta.label}`}
                            className="size-10 rounded-full text-muted-foreground"
                            onClick={() =>
                              setSegments((rows) =>
                                rows.filter((row) => row.id !== segment.id),
                              )
                            }
                          >
                            <X size={18} weight="bold" />
                          </Button>
                        </div>
                      );
                    })}
                    <p className="text-body text-muted-foreground">
                      Total duration:{" "}
                      <span className="font-semibold text-foreground">
                        {formatDuration(totalDuration)}
                      </span>
                    </p>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-9 gap-2 rounded-full border-input bg-white px-4 text-body font-medium text-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <PlusCircle size={20} />
                        Add extra time
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-80 p-3">
                      {EXTRA_TIME_TYPES.map((type) => (
                        <DropdownMenuItem
                          key={type.key}
                          className="flex-col items-start gap-1 rounded-xl px-4 py-3"
                          disabled={segments.some((row) => row.type === type.key)}
                          onClick={() => addSegment(type.key)}
                        >
                          <span className="text-body font-semibold text-foreground">
                            {type.label}
                          </span>
                          <span className="text-caption text-muted-foreground">{type.hint}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-9 gap-2 rounded-full border-input bg-white px-4 text-body font-medium text-foreground hover:bg-secondary hover:text-foreground"
                      >
                        Options
                        <CaretDown size={16} weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 p-3">
                      {["Pricing per team member", "Tax settings", "Advanced pricing"].map(
                        (label) => (
                          <DropdownMenuItem
                            key={label}
                            className="gap-3 px-4 py-2.5 text-body font-medium text-foreground"
                            onClick={() => {
                              soon(label)();
                            }}
                          >
                            {label}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      </div>
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

function NavRow({
  label,
  badge,
  active,
  onClick,
}: {
  label: string;
  badge?: number | null | undefined;
  active?: boolean | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-[8px] px-4 text-left transition-colors",
        active ? "bg-accent text-foreground" : "text-foreground hover:bg-secondary",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-body font-medium">{label}</span>
      {badge != null ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgba(19,19,19,0.05)] px-1.5 text-caption font-semibold text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </button>
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
        <Label className="text-body font-semibold text-foreground">
          {label}
          {optional ? (
            <span className="ml-1 font-normal text-muted-foreground">(Optional)</span>
          ) : null}
        </Label>
        {counter ? (
          <span className="text-body text-muted-foreground">{counter}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="text-caption font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-caption text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
