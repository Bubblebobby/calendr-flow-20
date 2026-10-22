import { useState } from "react";
import { ArrowDown, ArrowUp, DotsSixVertical, SlidersHorizontal } from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  DASHBOARD_CARDS,
  DEFAULT_LAYOUT,
  useDashboardLayout,
  type LayoutItem,
} from "@/lib/dashboard-layout";
import { cn } from "@/lib/utils";
import { pillButton } from "@/components/sales/list-ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

const TITLES = Object.fromEntries(DASHBOARD_CARDS.map((card) => [card.id, card.title]));

/**
 * "Customise" on Home: show or hide each card, put them in order (drag, or the arrows on touch
 * screens and keyboards), and make any card half or full width. Saved for this person only.
 */
export function CustomiseDashboard() {
  const { layout, save, reset } = useDashboardLayout();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LayoutItem[]>(layout);
  const [dragging, setDragging] = useState<number | null>(null);

  function openSheet(next: boolean) {
    if (next) setDraft(layout);
    setOpen(next);
  }
  function update(index: number, patch: Partial<LayoutItem>) {
    setDraft((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= draft.length || from === to) return;
    setDraft((items) => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }
  const visibleCount = draft.filter((item) => !item.hidden).length;

  return (
    <Sheet open={open} onOpenChange={openSheet}>
      <SheetTrigger
        className={cn(pillButton, "h-10 border border-input bg-card text-body hover:bg-secondary")}
      >
        <SlidersHorizontal size={16} /> Customise
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-6 text-left">
          <SheetTitle>Customise your Home</SheetTitle>
          <SheetDescription>
            Choose the cards you see, drag them into order and set their width. Only you see this
            layout.
          </SheetDescription>
        </SheetHeader>

        <ul className="flex-1 space-y-2 overflow-y-auto p-4">
          {draft.map((item, index) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragging(index)}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragging !== null && dragging !== index) {
                  move(dragging, index);
                  setDragging(index);
                }
              }}
              onDragEnd={() => setDragging(null)}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-shadow",
                dragging === index && "shadow-lg ring-2 ring-primary/30",
                item.hidden && "bg-secondary/40",
              )}
            >
              <DotsSixVertical
                size={18}
                className="shrink-0 cursor-grab text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-body font-medium",
                    item.hidden && "text-muted-foreground",
                  )}
                >
                  {TITLES[item.id]}
                </p>
                <div
                  role="radiogroup"
                  aria-label={`${TITLES[item.id]} width`}
                  className="mt-1.5 inline-flex rounded-full bg-secondary p-0.5 text-caption font-medium"
                >
                  {(["Half", "Full"] as const).map((label) => {
                    const wide = label === "Full";
                    const selected = item.wide === wide;
                    return (
                      <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={item.hidden}
                        onClick={() => update(index, { wide })}
                        className={cn(
                          "rounded-full px-3 py-1 transition-colors disabled:opacity-50",
                          selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                        )}
                      >
                        {label} width
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${TITLES[item.id]} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${TITLES[item.id]} down`}
                  disabled={index === draft.length - 1}
                  onClick={() => move(index, index + 1)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <Switch
                checked={!item.hidden}
                aria-label={`Show ${TITLES[item.id]}`}
                disabled={!item.hidden && visibleCount === 1}
                onCheckedChange={(checked) => update(index, { hidden: !checked })}
              />
            </li>
          ))}
        </ul>

        <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-border p-4 sm:justify-between">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_LAYOUT)}
            className={cn(pillButton, "h-10 text-body hover:bg-secondary")}
          >
            Reset to default
          </button>
          <button
            type="button"
            disabled={save.isPending || reset.isPending}
            onClick={() => {
              const isDefault = JSON.stringify(draft) === JSON.stringify(DEFAULT_LAYOUT);
              const done = {
                onSuccess: () => {
                  setOpen(false);
                  toast.success("Home layout saved");
                },
                onError: () =>
                  toast.error(
                    "Your layout couldn't be saved. Run the latest database update in Supabase, then try again.",
                  ),
              };
              if (isDefault) reset.mutate(undefined, done);
              else save.mutate(draft, done);
            }}
            className={cn(pillButton, "h-10 bg-ink text-body text-ink-foreground hover:bg-ink/90")}
          >
            Save
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
