import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { BusinessCategoriesStep } from "@/components/business-categories-step";
import { ServiceLocationStep } from "@/components/service-location-step";
import { VenueLocationStep } from "@/components/venue-location-step";
import { EXAMPLE_EMPLOYEE_NAME, TeamSizeStep } from "@/components/team-size-step";
import { MigrationSourceStep, MIGRATION_SOURCES } from "@/components/migration-source-step";
import { HeardAboutStep, HEARD_ABOUT_SOURCES } from "@/components/heard-about-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryByCode } from "@/lib/countries";
import { EMPTY_ADDRESS, type BusinessAddress } from "@/lib/google-maps";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/business-setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set up your business — Bookly" },
      {
        name: "description",
        content: "Add your business name and website to start setting up your Bookly workspace.",
      },
      { property: "og:title", content: "Set up your business — Bookly" },
      {
        property: "og:description",
        content: "Add your business name and website to start setting up your Bookly workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessSetupPage,
});

const PROGRESS_SEGMENTS = 5;
const MAX_STEP = 8;

const nameSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v.replace(/^https?:\/\//i, "")), {
      message: "Enter a valid website address",
    }),
});

function ProgressBar({ step }: { step: number }) {
  const active = Math.min(step, PROGRESS_SEGMENTS);
  return (
    <div className="flex gap-3">
      {Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < active ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function BusinessSetupPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [ownerCountry, setOwnerCountry] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [otherLabel, setOtherLabel] = useState("");
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [serviceLocations, setServiceLocations] = useState<string[]>([]);
  const [businessCountry, setBusinessCountry] = useState<string | null>(null);
  const [venueAddress, setVenueAddress] = useState<BusinessAddress>(EMPTY_ADDRESS);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [migrationSource, setMigrationSource] = useState<string | null>(null);
  const [otherMigrationSource, setOtherMigrationSource] = useState("");
  const [heardAbout, setHeardAbout] = useState<string | null>(null);
  const [otherHeardAbout, setOtherHeardAbout] = useState("");

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
        .select("onboarded_at, country, business_id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (cancelled) return;

      if (!profile?.onboarded_at) {
        navigate({ to: "/onboarding", replace: true });
        return;
      }
      setOwnerCountry(profile.country ?? null);

      if (profile.business_id) {
        const { data: business } = await supabase
          .from("businesses")
          .select(
            "id, name, website, setup_step, categories, other_category, team_size, service_locations, country, location, latitude, longitude, migration_source, heard_about_source",
          )
          .eq("id", profile.business_id)
          .maybeSingle();
        if (cancelled) return;
        if (business) {
          setBusinessId(business.id);
          setName(business.name ?? "");
          setWebsite(business.website ?? "");
          setCategories(Array.isArray(business.categories) ? (business.categories as string[]) : []);
          setOtherLabel(business.other_category ?? "");
          setTeamSize(business.team_size ?? null);
          setBusinessCountry(business.country ?? null);
          if (business.location) {
            setVenueAddress({ ...EMPTY_ADDRESS, ...(business.location as BusinessAddress) });
          }
          if (business.latitude != null && business.longitude != null) {
            setCoords({ lat: business.latitude, lng: business.longitude });
          }
          setServiceLocations(
            Array.isArray(business.service_locations)
              ? (business.service_locations as string[])
              : [],
          );
          const savedMigration = (business.migration_source as string | null) ?? null;
          setMigrationSource(savedMigration);
          if (savedMigration && !MIGRATION_SOURCES.some((s) => s.value === savedMigration)) {
            setOtherMigrationSource(savedMigration);
            setMigrationSource("other");
          }
          const savedHeard = (business.heard_about_source as string | null) ?? null;
          if (savedHeard && !HEARD_ABOUT_SOURCES.some((s) => s.value === savedHeard)) {
            setOtherHeardAbout(savedHeard);
            setHeardAbout("other");
          } else {
            setHeardAbout(savedHeard);
          }
          setStep(Math.min(Math.max(business.setup_step ?? 1, 1), MAX_STEP));
        }
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const parsed = nameSchema.safeParse({ name, website });
  const categoriesValid =
    categories.length > 0 && (!categories.includes("other") || otherLabel.trim().length > 1);
  const migrationSourceValid =
    migrationSource !== "other" || otherMigrationSource.trim().length > 1;
  const canContinue =
    step === 1
      ? parsed.success
      : step === 2
        ? categoriesValid
        : step === 3
          ? Boolean(teamSize)
          : step === 4
            ? serviceLocations.length > 0
            : step === 5
              ? Boolean(coords)
              : step === 6
                ? migrationSourceValid
                : step === 7
                  ? Boolean(heardAbout) &&
                    (heardAbout !== "other" || otherHeardAbout.trim().length > 1)
                  : true;

  async function handleTeamSizeContinue() {
    if (!businessId || !teamSize) return;
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({ team_size: teamSize, setup_step: 4 })
      .eq("id", businessId);

    if (!error && teamSize !== "independent") {
      const { data: existing } = await supabase
        .from("employees")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_example", true)
        .maybeSingle();
      if (!existing) {
        await supabase.from("employees").insert({
          business_id: businessId,
          first_name: EXAMPLE_EMPLOYEE_NAME,
          job_title: "Team member",
          is_example: true,
        });
      }
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep(4);
  }

  async function handleCategoriesContinue() {
    if (!businessId || !categoriesValid) return;
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        categories,
        other_category: categories.includes("other") ? otherLabel.trim() : null,
        setup_step: 3,
      })
      .eq("id", businessId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep(3);
  }

  async function handleServiceLocationsContinue() {
    if (!businessId || serviceLocations.length === 0) return;
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({ service_locations: serviceLocations, setup_step: 5 })
      .eq("id", businessId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep(5);
  }

  async function handleVenueLocationContinue() {
    if (!businessId || !coords) return;
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        location: venueAddress,
        latitude: coords.lat,
        longitude: coords.lng,
        setup_step: 6,
      })
      .eq("id", businessId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep(6);
  }

  async function handleMigrationSourceContinue() {
    if (!businessId) return;
    setSaving(true);
    const value =
      migrationSource === "other"
        ? otherMigrationSource.trim() || null
        : migrationSource === "none"
          ? null
          : migrationSource;
    const { error } = await supabase
      .from("businesses")
      .update({ migration_source: value, setup_step: 7 })
      .eq("id", businessId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep(7);
  }

  async function handleHeardAboutContinue() {
    if (!businessId || !heardAbout) return;
    setSaving(true);
    const value = heardAbout === "other" ? otherHeardAbout.trim() || null : heardAbout;
    const { error } = await supabase
      .from("businesses")
      .update({ heard_about_source: value, setup_step: 8 })
      .eq("id", businessId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep(8);
  }

  async function handleContinue() {
    if (step === 2) {
      await handleCategoriesContinue();
      return;
    }
    if (step === 3) {
      await handleTeamSizeContinue();
      return;
    }
    if (step === 4) {
      await handleServiceLocationsContinue();
      return;
    }
    if (step === 5) {
      await handleVenueLocationContinue();
      return;
    }
    if (step === 6) {
      await handleMigrationSourceContinue();
      return;
    }
    if (step === 7) {
      await handleHeardAboutContinue();
      return;
    }
    if (step !== 1) return;
    const result = nameSchema.safeParse({ name, website });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setSaving(false);
      navigate({ to: "/auth", replace: true });
      return;
    }

    const country = countryByCode(ownerCountry ?? "");
    const payload = {
      name: result.data.name,
      website: result.data.website || null,
      setup_step: 2,
      ...(country ? { country: country.code, currency: country.currency, timezone: country.timezone } : {}),
    };

    if (businessId) {
      const { error } = await supabase.from("businesses").update(payload).eq("id", businessId);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
    } else {
      const { data: created, error } = await supabase
        .from("businesses")
        .insert({ ...payload, owner_id: user.id })
        .select("id")
        .single();
      if (error || !created) {
        setSaving(false);
        toast.error(error?.message ?? "Could not save your business");
        return;
      }
      setBusinessId(created.id);
      await supabase.from("profiles").update({ business_id: created.id }).eq("id", user.id);
    }

    setSaving(false);
    setStep(2);
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step >= MAX_STEP) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-accent via-primary to-primary shadow-lg">
          <Check className="size-9 text-primary-foreground" strokeWidth={3} />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          Your business is set up!
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {name ? `${name} is ready to start taking bookings` : "You're ready to start taking bookings"}
        </p>
        <Button
          className="mt-6 h-12 rounded-full bg-ink px-8 text-base font-semibold text-ink-foreground hover:bg-ink/90"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="theme-fresha min-h-screen bg-background">
      <div className="px-6 pt-5 sm:px-10">
        <ProgressBar step={step} />
      </div>

      <div className="flex items-center justify-between px-6 pt-4 sm:px-10">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Back"
            className="size-11 rounded-full"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          form="business-setup-form"
          disabled={!canContinue || saving}
          className="h-12 rounded-full bg-ink px-7 text-base font-semibold text-ink-foreground hover:bg-ink/90"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              {step === MAX_STEP - 1 ? "Done" : "Continue"}
              {step === MAX_STEP - 1 ? null : <ArrowRight className="ml-1 size-4" />}
            </>
          )}
        </Button>
      </div>

      <main className="mx-auto w-full max-w-[820px] px-6 pb-24 pt-6">
        <form
            id="business-setup-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleContinue();
            }}
          >
            {step === 1 ? (
              <>
                <p className="text-base text-muted-foreground">Account setup</p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-[2.9rem]">
                  What&apos;s your business name?
                </h1>
                <p className="mt-3 text-lg text-muted-foreground">
                  This is the brand name your clients will see. Your billing and legal name can be added later.
                </p>

                <div className="mt-10 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="business-name" className="text-[15px] font-semibold">
                      Business name
                    </Label>
                    <Input
                      id="business-name"
                      autoFocus
                      className="h-12 rounded-full px-5 text-base"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-website" className="text-[15px] font-semibold">
                      Website <span className="font-normal text-muted-foreground">(Optional)</span>
                    </Label>
                    <Input
                      id="business-website"
                      inputMode="url"
                      placeholder="www.yoursite.com"
                      className="h-12 rounded-full px-5 text-base"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : step === 2 ? (
              <BusinessCategoriesStep
                selected={categories}
                onChange={setCategories}
                otherLabel={otherLabel}
                onOtherLabelChange={setOtherLabel}
              />
            ) : step === 3 ? (
              <TeamSizeStep value={teamSize} onChange={setTeamSize} />
            ) : step === 4 ? (
              <ServiceLocationStep selected={serviceLocations} onChange={setServiceLocations} />
            ) : step === 5 ? (
              <VenueLocationStep
                countryCode={businessCountry ?? ownerCountry}
                address={venueAddress}
                onAddressChange={setVenueAddress}
                coords={coords}
                onCoordsChange={setCoords}
              />
            ) : step === 6 ? (
              <MigrationSourceStep
                value={migrationSource}
                otherValue={otherMigrationSource}
                onChange={setMigrationSource}
                onOtherValueChange={setOtherMigrationSource}
              />
            ) : (
              <HeardAboutStep
                value={heardAbout}
                otherValue={otherHeardAbout}
                onChange={setHeardAbout}
                onOtherValueChange={setOtherHeardAbout}
              />
            )}
        </form>
      </main>
    </div>
  );
}
