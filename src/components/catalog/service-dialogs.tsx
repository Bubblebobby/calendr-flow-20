import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const CATEGORY_COLORS = [
  "#7BD3F7",
  "#6950F3",
  "#F7B500",
  "#F2664F",
  "#38B87C",
  "#E45FA3",
  "#8B93A7",
  "#111827",
];

export type CategoryDraft = {
  id?: string;
  name: string;
  color: string;
  description: string;
};

export type ServiceDraft = {
  id?: string;
  name: string;
  categoryId: string | null;
  pricingType: "free" | "free-form" | "fixed";
  price: string;
  hours: string;
  minutes: string;
};

export const emptyCategory: CategoryDraft = {
  name: "",
  color: CATEGORY_COLORS[0]!,
  description: "",
};

export const emptyService: ServiceDraft = {
  name: "",
  categoryId: null,
  pricingType: "fixed",
  price: "",
  hours: "1",
  minutes: "0",
};

const inputClass = "h-11 rounded-xl";

export function CategoryDialog({
  open,
  onOpenChange,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CategoryDraft;
  saving: boolean;
  onSubmit: (draft: CategoryDraft) => void;
}) {
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            Categories group services on your menu and in online booking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Category name</Label>
            <Input
              id="category-name"
              className={inputClass}
              value={draft.name}
              placeholder="e.g. Hair & styling"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Colour ${color}`}
                  aria-pressed={draft.color === color}
                  onClick={() => setDraft({ ...draft, color })}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-transform active:scale-95",
                    draft.color === color ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              className="rounded-xl"
              rows={3}
              value={draft.description}
              placeholder="Optional"
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!draft.name.trim() || saving} onClick={() => onSubmit(draft)}>
            {saving ? "Saving…" : initial.id ? "Save category" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ServiceDialog({
  open,
  onOpenChange,
  initial,
  categories,
  saving,
  onSubmit,
  onCreateCategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ServiceDraft;
  categories: { id: string; name: string; color: string }[];
  saving: boolean;
  onSubmit: (draft: ServiceDraft) => void;
  onCreateCategory: () => void;
}) {
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const pricingOptions: { key: ServiceDraft["pricingType"]; label: string; hint: string }[] = [
    { key: "free", label: "Free", hint: "No charge" },
    { key: "free-form", label: "Free-form", hint: "Priced at checkout" },
    { key: "fixed", label: "Fixed", hint: "Set a price" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Edit service" : "Add single service"}</DialogTitle>
          <DialogDescription>
            Basic details clients see when booking this service.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-name">Service name</Label>
            <Input
              id="service-name"
              className={inputClass}
              value={draft.name}
              placeholder="e.g. Haircut"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="service-category">Category</Label>
              <button
                type="button"
                className="text-sm font-semibold text-primary hover:underline"
                onClick={onCreateCategory}
              >
                Create new category
              </button>
            </div>
            <select
              id="service-category"
              value={draft.categoryId ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, categoryId: event.target.value || null })
              }
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Pricing type</Label>
            <div className="grid grid-cols-3 gap-2">
              {pricingOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDraft({ ...draft, pricingType: option.key })}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors active:scale-[0.99]",
                    draft.pricingType === option.key
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {draft.pricingType === "fixed" ? (
            <div className="space-y-2">
              <Label htmlFor="service-price">Price</Label>
              <Input
                id="service-price"
                className={inputClass}
                inputMode="decimal"
                value={draft.price}
                placeholder="0.00"
                onChange={(event) => setDraft({ ...draft, price: event.target.value })}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  aria-label="Hours"
                  className={inputClass}
                  inputMode="numeric"
                  value={draft.hours}
                  onChange={(event) => setDraft({ ...draft, hours: event.target.value })}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  hr
                </span>
              </div>
              <div className="relative">
                <Input
                  aria-label="Minutes"
                  className={inputClass}
                  inputMode="numeric"
                  value={draft.minutes}
                  onChange={(event) => setDraft({ ...draft, minutes: event.target.value })}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  min
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!draft.name.trim() || saving} onClick={() => onSubmit(draft)}>
            {saving ? "Saving…" : initial.id ? "Save service" : "Add service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
