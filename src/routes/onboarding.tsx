import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, countryByCode, flagEmoji, guessCountryCode } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Complete your profile — Bookly" },
      {
        name: "description",
        content: "Add your name, mobile number and country to finish setting up your Bookly account.",
      },
      { property: "og:title", content: "Complete your profile — Bookly" },
      {
        property: "og:description",
        content: "Add your name, mobile number and country to finish setting up your Bookly account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  dialCountry: z.string().length(2),
  phone: z
    .string()
    .trim()
    .min(5, "Enter a valid mobile number")
    .max(20)
    .regex(/^[0-9\s-]+$/, "Digits only"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  country: z.string().length(2, "Select your country"),
  terms: z.literal(true),
});

function CountryPicker({
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
          className={cn("h-12 justify-between rounded-full px-5 font-normal hover:bg-secondary hover:text-foreground", className)}
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
                  <Check className={cn("ml-2 size-4", value === country.code ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dialCountry, setDialCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [terms, setTerms] = useState(false);

  // Session required; anyone who already finished goes straight to the dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", data.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.onboarded_at) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      const guess = guessCountryCode();
      if (guess) {
        setCountry(guess);
        setDialCountry(guess);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const values = { firstName, lastName, dialCountry, phone, password, country, terms };
  const valid = useMemo(() => schema.safeParse(values).success, [
    firstName,
    lastName,
    dialCountry,
    phone,
    password,
    country,
    terms,
  ]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete every field");
      return;
    }

    setSaving(true);
    const selected = countryByCode(parsed.data.country)!;
    const dial = countryByCode(parsed.data.dialCountry)!;
    const e164 = `+${dial.dial}${parsed.data.phone.replace(/\D/g, "")}`;

    const { data: userData, error: passwordError } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { full_name: `${parsed.data.firstName} ${parsed.data.lastName}` },
    });
    if (passwordError || !userData.user) {
      setSaving(false);
      toast.error(passwordError?.message ?? "Could not set your password");
      return;
    }

    // The sign-up trigger creates the profile row, so update it (users can't write "id").
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
        phone: e164,
        country: selected.code,
        timezone: selected.timezone,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", userData.user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/business-setup", replace: true });
  }

  if (!ready) {
    return (
      <div className="flex h-[100svh] items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthShell
      title={
        <>
          A few details
          <br />
          to get started
        </>
      }
      subtitle="Tell us who you are so we can set up your workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              autoComplete="given-name"
              className="h-12 rounded-full px-5"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              autoComplete="family-name"
              className="h-12 rounded-full px-5"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Mobile number</Label>
          <div className="flex gap-2">
            <CountryPicker
              value={dialCountry}
              onChange={setDialCountry}
              placeholder="Code"
              className="w-[124px] shrink-0"
              render={(code) => (
                <span className="flex items-center gap-1.5">
                  <span>{flagEmoji(code)}</span>
                  <span>+{countryByCode(code)?.dial}</span>
                </span>
              )}
            />
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="801 234 5678"
              className="h-12 flex-1 rounded-full px-5"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-12 rounded-full pl-5 pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <CountryPicker
            id="country"
            value={country}
            onChange={setCountry}
            placeholder="Select your country"
            className="w-full"
            render={(code) => (
              <span className="flex items-center gap-2">
                <span>{flagEmoji(code)}</span>
                <span>{countryByCode(code)?.name}</span>
              </span>
            )}
          />
        </div>

        <label className="flex items-start gap-2.5 pt-1 text-left">
          <Checkbox
            checked={terms}
            onCheckedChange={(checked) => setTerms(checked === true)}
            className="mt-0.5"
            aria-label="Agree to the terms and privacy policy"
          />
          <span className="text-[13px] leading-relaxed text-muted-foreground">
            I agree to the Terms of Service and Privacy Policy.
          </span>
        </label>

        <Button type="submit" className="h-12 w-full rounded-full text-base font-semibold" disabled={!valid || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}
