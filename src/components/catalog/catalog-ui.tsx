import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { pillButton } from "@/components/sales/list-ui";
import { cn } from "@/lib/utils";

/** Fresha's named appointment colours. "Blue" is measured from Fresha; the rest are matched pastels. */
export const NAMED_CATEGORY_COLORS = [
  { name: "Blue", hex: "#A5DFF8" },
  { name: "Dark Blue", hex: "#8FB8F8" },
  { name: "Jordy Blue", hex: "#A6C4F7" },
  { name: "Indigo", hex: "#B4B0F7" },
  { name: "Lavender", hex: "#CDB8F8" },
  { name: "Purple", hex: "#DDB2F2" },
  { name: "Wisteria", hex: "#E6B6E6" },
  { name: "Pink", hex: "#F7B6D2" },
  { name: "Coral", hex: "#F8B4B4" },
  { name: "Blood Orange", hex: "#F9BBA4" },
  { name: "Orange", hex: "#FBCB9D" },
  { name: "Amber", hex: "#FCDB98" },
  { name: "Yellow", hex: "#FAE8A0" },
  { name: "Lime", hex: "#DDEFA2" },
  { name: "Green", hex: "#B5E5B5" },
  { name: "Teal", hex: "#A8E2D6" },
  { name: "Cyan", hex: "#A3E3EC" },
] as const;

export function colorName(hex: string) {
  return NAMED_CATEGORY_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
      className="flex size-12 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-secondary"
    >
      <X size={20} />
    </button>
  );
}

/** Fresha's confirm modal: 512px, title, one line of copy, Cancel + action side by side. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[32rem] gap-0 rounded-2xl border-0 p-0 [&>button]:hidden">
        <div className="flex items-start justify-between gap-4 px-8 pb-2 pt-6">
          <DialogTitle className="pt-3 text-title font-semibold">{title}</DialogTitle>
          <CloseButton onClick={onClose} />
        </div>
        <DialogDescription className="px-8 text-body text-foreground">{body}</DialogDescription>
        <div className="grid grid-cols-2 gap-3 px-8 pb-8 pt-8">
          <button type="button" onClick={onClose} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              pillButton,
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-ink text-ink-foreground hover:bg-ink/90",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type CategoryFormValue = { id?: string; name: string; color: string; description: string };

/** Fresha's Add/Edit category modal (720px): name + appointment colour side by side, description below. */
export function CategoryFormDialog({
  open,
  initial,
  saving,
  onSubmit,
  onClose,
}: {
  open: boolean;
  initial: CategoryFormValue;
  saving: boolean;
  onSubmit: (value: CategoryFormValue) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  const title = initial.id ? "Edit category" : "Add category";
  const knownColor = colorName(value.color);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[45rem] gap-0 rounded-2xl border-0 p-0 [&>button]:hidden">
        <div className="flex justify-end px-6 pt-6">
          <CloseButton onClick={onClose} />
        </div>
        <form
          className="px-10 pb-10"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.name.trim()) onSubmit(value);
          }}
        >
          <DialogTitle className="text-display font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">Categories group services on your menu.</DialogDescription>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <label className="block text-body font-semibold">
              Category name
              <input
                autoFocus
                value={value.name}
                maxLength={255}
                placeholder="e.g. Hair Services"
                onChange={(event) => setValue({ ...value, name: event.target.value })}
                className="mt-2 h-12 w-full rounded-lg border border-input bg-card px-4 text-body font-normal outline-none placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="block text-body font-semibold">
              Appointment color
              <span className="relative mt-2 block">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: value.color }}
                />
                <select
                  value={value.color}
                  onChange={(event) => setValue({ ...value, color: event.target.value })}
                  className="h-12 w-full appearance-none rounded-lg border border-input bg-card pl-11 pr-10 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  {knownColor ? null : <option value={value.color}>Custom</option>}
                  {NAMED_CATEGORY_COLORS.map((color) => (
                    <option key={color.name} value={color.hex}>
                      {color.name}
                    </option>
                  ))}
                </select>
                <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2">
                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
            </label>
          </div>

          <label className="mt-4 block text-body font-semibold">
            <span className="flex justify-between">
              Description
              <span className="font-normal text-muted-foreground">{value.description.length}/255</span>
            </span>
            <textarea
              value={value.description}
              maxLength={255}
              rows={4}
              onChange={(event) => setValue({ ...value, description: event.target.value })}
              className="mt-2 w-full resize-none rounded-lg border border-input bg-card p-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <div className="mt-8 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.name.trim() || saving}
              className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
            >
              {initial.id ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Thrown-error helper: the archive column arrives with a migration the user runs in Supabase. */
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|could not find the .* column/i.test(error.message ?? "");
}

export const NEEDS_DB_UPDATE =
  "This needs a database update first: run supabase/migrations/20261017090000_catalog_archive.sql in Supabase";
