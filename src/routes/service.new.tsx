import { useMemo, useState } from "react";
import { CaretDown, Plus, PlusCircle } from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { requireOnboardedUser } from "@/lib/auth-guard";
import { formatDuration } from "@/lib/format";
import { TREATMENT_GROUPS } from "@/lib/treatment-types";

const SORTED_TREATMENT_GROUPS = [...TREATMENT_GROUPS].sort((a, b) =>
  a.label.localeCompare(b.label),
);
import {
  TeamMembersSection,
  reconcileServiceTeam,
  useServiceTeamAssignments,
  useTeamMembers,
} from "@/components/catalog/service-team-members";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/service/new")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  head: () => ({
    meta: [
      { title: "New service — Bookly" },
      { name: "description", content: "Create a new bookable service for your business." },
      { property: "og:title", content: "New service — Bookly" },
      {
        property: "og:description",
        content: "Create a new bookable service for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewServicePage,
});

const NAV_PRIMARY = [
  { key: "basic", label: "Basic details" },
  { key: "team", label: "Team members" },
  { key: "resources", label: "Resources" },
  { key: "addons", label: "Service add-ons" },
] as const;

const NAV_SETTINGS = [
  { label: "Online booking", badge: null as number | null },
  { label: "Portfolio images", badge: null },
  { label: "Forms", badge: 0 },
  { label: "Commissions", badge: null },
  { label: "Settings", badge: null },
];

const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];


const soon = (label: string) => () => toast(`${label} — coming soon`);

const FIELD =
  "h-12 rounded-xl border border-border bg-transparent text-base transition-colors";

function NewServicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [treatmentType, setTreatmentType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [priceType, setPriceType] = useState<"fixed" | "free" | "free-form">("fixed");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState<string>("60");
  const [customDuration, setCustomDuration] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [section, setSection] = useState<"basic" | "team">("basic");

  // Creating a service: no saved assignments yet, everyone starts checked.
  const teamQuery = useTeamMembers(businessId);
  const teamMembers = teamQuery.data ?? [];
  const existingAssignments = useServiceTeamAssignments(undefined).data ?? [];
  const [selectedTeam, setSelectedTeam] = useState<string[] | null>(null);
  const teamSelection = selectedTeam ?? teamMembers.map((m) => m.id);

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
      const { data, error } = await supabase
        .from("services")
        .insert({
          business_id: businessId!,
          category_id: categoryId || null,
          name: name.trim(),
          description: description.trim() || null,
          treatment_type: treatmentType || null,
          pricing_type: priceType,
          price: priceType === "fixed" ? Number(price) || 0 : null,
          duration_minutes: minutes,
        })
        .select("id")
        .single();
      if (error) throw error;

      await reconcileServiceTeam(data.id, teamSelection, existingAssignments);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", businessId] });
      toast.success("Service created");
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

  return (
    <div className="bg-background min-h-screen lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
      <header className="shrink-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-8 py-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">New service</h1>
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

      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 overflow-y-auto px-8 pb-8 pt-12 lg:flex-1 lg:grid-cols-[300px_1fr] lg:pb-8 lg:pt-16">
        {/* Section nav */}
        <nav className="h-fit self-start rounded-3xl border border-border bg-card p-3">
          <ul className="space-y-1">
            {NAV_PRIMARY.map((item, index) => (
              <li key={item.label}>
                <NavRow
                  label={item.label}
                  badge={item.badge}
                  active={index === 0}
                  onClick={index === 0 ? undefined : () => { soon(item.label)(); }}
                />
              </li>
            ))}
          </ul>
          <div className="my-3 h-px bg-border" />
          <p className="px-3 py-2 text-base font-bold text-foreground">Settings</p>
          <ul className="space-y-1">
            {NAV_SETTINGS.map((item) => (
              <li key={item.label}>
                <NavRow label={item.label} badge={item.badge} onClick={() => { soon(item.label)(); }} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          {/* Basic details */}
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-foreground">Basic details</h2>

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
                      {categories.length > 0 ? (
                        <div className="my-2 h-px bg-border" />
                      ) : null}
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
                          <SelectLabel className="px-3 pt-3 pb-2 text-base font-bold text-foreground">
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
                  className="min-h-32 rounded-xl bg-transparent text-base"
                  placeholder="Add a short description"
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* Pricing and duration */}
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-foreground">Pricing and duration</h2>

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
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
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
                  <SelectTrigger className={cn(FIELD, show("duration") && "border-destructive")}>
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

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-full bg-white px-6 text-base font-medium text-foreground hover:bg-white hover:text-foreground"
                onClick={() => { soon("Extra time")(); }}
              >
                <PlusCircle size={20} />
                Add extra time
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 gap-2 rounded-full bg-white px-6 text-base font-medium text-foreground hover:bg-white hover:text-foreground"
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
                        className="gap-3 px-4 py-2.5 text-sm font-medium text-foreground"
                        onClick={() => { soon(label)(); }}
                      >
                        {label}
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>
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
        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors active:scale-[0.99]",
        active ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
      {badge != null ? (
        <span className="h-6 w-6 rounded-full border border-border bg-card text-center text-xs font-medium leading-6 text-muted-foreground">
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
        <Label className="text-sm font-semibold text-foreground">
          {label}
          {optional ? (
            <span className="ml-1 font-normal text-muted-foreground">(Optional)</span>
          ) : null}
        </Label>
        {counter ? (
          <span className="text-xs text-muted-foreground">{counter}</span>
        ) : null}
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
