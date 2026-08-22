import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const HEARD_ABOUT_SOURCES = [
  { value: "friend", label: "Recommended by a friend" },
  { value: "search-engine", label: "Search engine (e.g. Google, Bing)" },
  { value: "social-media", label: "Social media" },
  { value: "mail-advert", label: "Advert in the mail" },
  { value: "magazine-ad", label: "Magazine ad" },
  { value: "ratings-website", label: "Ratings website (e.g. Capterra, Trustpilot)" },
  { value: "ai-chatbot", label: "AI Chatbot (e.g. ChatGPT, Gemini, DeepSeek)" },
  { value: "other", label: "Other" },
] as const;

type Props = {
  value: string | null;
  otherValue: string;
  onChange: (value: string) => void;
  onOtherValueChange: (value: string) => void;
};

/** Final account-setup step: capture how the business owner discovered the platform. */
export function HeardAboutStep({ value, otherValue, onChange, onOtherValueChange }: Props) {
  const [otherInputFocused, setOtherInputFocused] = useState(false);

  return (
    <>
      <p className="text-base text-muted-foreground">Account setup</p>
      <h1 className="mt-2 step-title text-foreground">
        How did you hear about us?
      </h1>

      <div className="mt-8 space-y-1">
        {HEARD_ABOUT_SOURCES.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/60"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary bg-primary" : "border-border bg-background",
                )}
                aria-hidden="true"
              >
                {selected ? <span className="size-2 rounded-full bg-primary-foreground" /> : null}
              </span>
              <span className="text-base text-foreground">{option.label}</span>
            </button>
          );
        })}
      </div>

      {value === "other" || otherInputFocused ? (
        <div className="mt-8 space-y-2">
          <Label htmlFor="heard-about-other" className="text-[15px] font-semibold">
            Tell us more
          </Label>
          <Input
            id="heard-about-other"
            autoFocus={value === "other"}
            placeholder="Where did you hear about us?"
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
