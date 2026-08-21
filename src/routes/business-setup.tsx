import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { BusinessCategoriesStep } from "@/components/business-categories-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryByCode } from "@/lib/countries";
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

const TOTAL_STEPS = 5;

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
  return (
    <div className="flex gap-3">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < step ? "bg-primary" : "bg-border",
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
          .select("id, name, website, setup_step, categories, other_category")
          .eq("id", profile.business_id)
          .maybeSingle();
        if (cancelled) return;
        if (business) {
          setBusinessId(business.id);
          setName(business.name ?? "");
          setWebsite(business.website ?? "");
          setCategories(Array.isArray(business.categories) ? (business.categories as string[]) : []);
          setOtherLabel(business.other_category ?? "");
          setStep(Math.min(Math.max(business.setup_step ?? 1, 1), TOTAL_STEPS));
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
  const canContinue = step === 1 ? parsed.success : step === 2 ? categoriesValid : true;

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

  async function handleContinue() {
    if (step === 2) {
      await handleCategoriesContinue();
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

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 pt-5 sm:px-10">
        <ProgressBar step={step} />
      </div>

      <div className="flex justify-end px-6 pt-4 sm:px-10">
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
              Continue
              <ArrowRight className="ml-1 size-4" />
            </>
          )}
        </Button>
      </div>

      <main className="mx-auto w-full max-w-[820px] px-6 pb-24 pt-6">
        {step === 1 ? (
          <form
            id="business-setup-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleContinue();
            }}
          >
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
                  className="h-14 rounded-xl text-base"
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
                  className="h-14 rounded-xl text-base"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>
          </form>
        ) : (
          <div className="pt-10">
            <p className="text-base text-muted-foreground">Account setup</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">
              {name} is saved
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              The next setup step is coming soon — you can head to your dashboard in the meantime.
            </p>
            <Button
              className="mt-8 h-12 rounded-full px-7"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              Go to dashboard
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
