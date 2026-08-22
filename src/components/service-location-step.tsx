import { cn } from "@/lib/utils";

export const SERVICE_LOCATIONS = [
  { value: "physical", label: "Clients come to me at a physical location" },
  { value: "mobile", label: "I visit my clients as a mobile operator" },
  { value: "online", label: "I provide virtual services online" },
] as const;

export function ServiceLocationStep({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  return (
    <>
      <p className="text-base text-muted-foreground">Account setup</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-[2.9rem]">
        Where do you provide your services?
      </h1>

      <div className="mt-10 space-y-4">
        {SERVICE_LOCATIONS.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(option.value)}
              className={cn(
                "flex w-full items-center rounded-2xl border bg-card px-6 py-5 text-left text-base font-semibold text-foreground transition-colors",
                isSelected
                  ? "border-primary bg-secondary ring-1 ring-primary"
                  : "border-border hover:border-foreground/25",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
