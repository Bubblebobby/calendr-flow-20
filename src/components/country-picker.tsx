import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, flagEmoji } from "@/lib/countries";
import { cn } from "@/lib/utils";

/** Searchable country list, used for countries and phone dialling codes. */
export function CountryPicker({
  value,
  onChange,
  placeholder,
  render,
  id,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
  render: (code: string) => React.ReactNode;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-12 justify-between rounded-full px-5 font-normal hover:bg-secondary hover:text-foreground",
            className,
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? render(value) : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.dial}`}
                  onSelect={() => {
                    onChange(country.code);
                    setOpen(false);
                  }}
                >
                  <span className="mr-2">{flagEmoji(country.code)}</span>
                  <span className="flex-1 truncate">{country.name}</span>
                  <span className="ml-2 text-caption text-muted-foreground">+{country.dial}</span>
                  <Check
                    className={cn(
                      "ml-2 size-4",
                      value === country.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
