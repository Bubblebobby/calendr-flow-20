import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const MIGRATION_SOURCES = [
  { value: "acuity", label: "Acuity" },
  { value: "booksy", label: "Booksy" },
  { value: "calendly", label: "Calendly" },
  { value: "fresha", label: "Fresha" },
  { value: "goldie", label: "Goldie" },
  { value: "janeapp", label: "Janeapp" },
  { value: "mindbody", label: "Mindbody" },
  { value: "salon-iris", label: "Salon Iris" },
  { value: "setmore", label: "Setmore" },
  { value: "shortcuts", label: "Shortcuts" },
  { value: "square", label: "Square" },
  { value: "styleseat", label: "Styleseat" },
  { value: "timely", label: "Timely" },
  { value: "treatwell", label: "Treatwell" },
  { value: "vagaro", label: "Vagaro" },
  { value: "zenoti", label: "Zenoti" },
  { value: "none", label: "I'm not using any software" },
  { value: "other", label: "Other" },
] as const;

type Props = {
  value: string | null;
  otherValue: string;
  onChange: (value: string) => void;
  onOtherValueChange: (value: string) => void;
};

/** Step 5b of business setup: capture which booking platform the business is migrating from. */
export function MigrationSourceStep({
  value,
  otherValue,
  onChange,
  onOtherValueChange,
}: Props) {
  const [otherInputFocused, setOtherInputFocused] = useState(false);

  return (
    <>
      <p className="text-base text-muted-foreground">Account setup</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-[2.9rem]">
        Which software are you currently using?
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        If you&apos;re looking to switch, we can help speed up your business setup and import your
        data into your new account.
      </p>

      <div className="mt-10 space-y-3">
        {MIGRATION_SOURCES.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full items-center gap-4 rounded-xl border bg-card px-5 py-4 text-left transition-colors",
                selected
                  ? "border-primary bg-secondary ring-1 ring-primary"
                  : "border-border hover:border-foreground/25",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary bg-primary" : "border-border bg-background",
                )}
                aria-hidden="true"
              >
                {selected ? (
                  <span className="size-2 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
              <span className="text-base font-semibold text-foreground">{option.label}</span>
            </button>
          );
        })}
      </div>

      {value === "other" || otherInputFocused ? (
        <div className="mt-8 space-y-2">
          <Label htmlFor="other-software" className="text-[15px] font-semibold">
            Other software
          </Label>
          <Input
            id="other-software"
            autoFocus={value === "other"}
            placeholder="e.g., Shedul, Appointy"
            className="h-12 rounded-full px-5 text-base"
            value={otherValue}
            onChange={(e) => onOtherValueChange(e.target.value)}
            onFocus={() => setOtherInputFocused(true)}
            onBlur={() => {
              if (!otherValue.trim()) setOtherInputFocused(false);
            }}
          />
        </div>
      ) : null}
    </>
  );
}
