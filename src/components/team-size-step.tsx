import { Lightbulb } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export const TEAM_SIZES = [
  { value: "independent", label: "I'm an independent" },
  { value: "2-5", label: "2-5 people" },
  { value: "6-10", label: "6-10 people" },
  { value: "11-20", label: "11-20 people" },
  { value: "20+", label: "20+ people" },
] as const;

export const EXAMPLE_EMPLOYEE_NAME = "Aye";

export function TeamSizeStep({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  const showNotice = value !== null && value !== "independent";

  return (
    <>
      <p className="text-base text-muted-foreground">Account setup</p>
      <h1 className="mt-2 step-title text-foreground">
        What&apos;s your team size?
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        This will help us set up your calendar correctly
      </p>

      <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
        {TEAM_SIZES.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full items-center rounded-2xl border bg-card px-5 py-4 text-left text-base font-semibold sm:px-6 sm:py-5 text-foreground transition-colors",
                selected
                  ? "border-primary bg-secondary ring-1 ring-primary"
                  : "border-border hover:border-foreground/25",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {showNotice ? (
        <div className="mt-6 flex gap-3 rounded-xl bg-secondary px-5 py-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" weight="regular" />
          <p className="text-[15px] leading-relaxed text-foreground">
            We&apos;ll add &apos;{EXAMPLE_EMPLOYEE_NAME}&apos; as an example employee so you can see
            how the system works. You can manage employees later once you&apos;re in!
          </p>
        </div>
      ) : null}
    </>
  );
}
