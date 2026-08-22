import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUSINESS_CATEGORIES,
  CATEGORY_RANK_LABELS,
  MAX_CATEGORIES,
} from "@/lib/business-categories";
import { cn } from "@/lib/utils";

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  otherLabel: string;
  onOtherLabelChange: (value: string) => void;
};

/** Step 2 of business setup: pick a primary category plus up to three related ones. */
export function BusinessCategoriesStep({
  selected,
  onChange,
  otherLabel,
  onOtherLabelChange,
}: Props) {
  const full = selected.length >= MAX_CATEGORIES;

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((c) => c !== id));
      return;
    }
    if (full) return;
    onChange([...selected, id]);
  }

  return (
    <div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-[2.9rem]">
        Select categories that best describe your business
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Choose your primary and up to 3 related service types
      </p>

      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BUSINESS_CATEGORIES.map((category) => {
          const index = selected.indexOf(category.id);
          const isSelected = index !== -1;
          const disabled = !isSelected && full;
          const Icon = category.icon;

          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => toggle(category.id)}
              className={cn(
                "relative rounded-xl border bg-card p-5 text-left transition-[border-color,background-color,box-shadow] duration-150",
                "hover:border-foreground/25 active:bg-muted",
                isSelected ? "border-primary ring-1 ring-primary" : "border-border",
                disabled && "pointer-events-none opacity-40",
              )}
            >
              {isSelected ? (
                <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                  {CATEGORY_RANK_LABELS[index]}
                </span>
              ) : null}
              <Icon size={26} weight="regular" className="text-foreground" />
              <span className="mt-6 block text-[15px] font-semibold text-foreground">
                {category.label}
              </span>
            </button>
          );
        })}
      </div>

      {selected.includes("other") ? (
        <div className="mt-8 space-y-2">
          <Label htmlFor="other-service-type" className="text-[15px] font-semibold">
            Other service type
          </Label>
          <Input
            id="other-service-type"
            autoFocus
            className="h-12 rounded-full px-5 text-base"
            value={otherLabel}
            onChange={(e) => onOtherLabelChange(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
