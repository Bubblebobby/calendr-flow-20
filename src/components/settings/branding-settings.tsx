import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageSquare, RocketLaunch, Trash, UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

import { SkeletonForm } from "@/components/ui/skeletons";
import { pillButton } from "@/components/sales/list-ui";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_PRESETS, LOGO_BUCKET, brandHex, logoUrl, type BrandKey } from "@/lib/brand";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

/*
 * Settings → Business setup → Branding. The owner picks a brand colour from the presets and can
 * upload a logo; both show on the booking page, salon page, confirmation, manage-booking link and
 * receipts, and the colour tints the dashboard. A live preview shows the choice before saving.
 */

const card = "rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--color-border)]";
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function useBrandingRow() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["branding-row", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const [{ data: session }, row] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from("businesses")
          .select("id, name, owner_id, brand_color, logo_path")
          .eq("id", business!.id)
          .single(),
      ]);
      if (row.error) throw row.error;
      return { ...row.data, isOwner: row.data.owner_id === session.session?.user.id };
    },
  });
}

export function BrandingSettings() {
  const row = useBrandingRow();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [color, setColor] = useState<BrandKey>("black");
  const [newLogo, setNewLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  useEffect(() => {
    if (row.data) setColor((row.data.brand_color as BrandKey) ?? "black");
  }, [row.data]);

  const newLogoUrl = useMemo(() => (newLogo ? URL.createObjectURL(newLogo) : null), [newLogo]);
  useEffect(() => () => void (newLogoUrl && URL.revokeObjectURL(newLogoUrl)), [newLogoUrl]);
  const shownLogo = newLogoUrl ?? (removeLogo ? null : logoUrl(row.data?.logo_path));

  const dirty =
    Boolean(row.data) && (color !== row.data?.brand_color || Boolean(newLogo) || removeLogo);

  const save = useMutation({
    mutationFn: async () => {
      const current = row.data!;
      let logoPath = removeLogo ? null : current.logo_path;
      if (newLogo) {
        const ext =
          newLogo.type === "image/png" ? "png" : newLogo.type === "image/webp" ? "webp" : "jpg";
        const path = `${current.id}/logo-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(LOGO_BUCKET)
          .upload(path, newLogo, { contentType: newLogo.type, upsert: false });
        if (error) throw error;
        logoPath = path;
      }
      const { error } = await supabase
        .from("businesses")
        .update({ brand_color: color, logo_path: logoPath })
        .eq("id", current.id);
      if (error) throw error;
      // Tidy up the file that was replaced or removed.
      if (current.logo_path && current.logo_path !== logoPath) {
        await supabase.storage.from(LOGO_BUCKET).remove([current.logo_path]);
      }
    },
    onSuccess: () => {
      setNewLogo(null);
      setRemoveLogo(false);
      queryClient.invalidateQueries({ queryKey: ["branding-row"] });
      queryClient.invalidateQueries({ queryKey: ["business-branding"] });
      toast.success("Branding saved");
    },
    onError: (error: Error) =>
      toast.error(
        /brand_color|logo_path|bucket/i.test(error.message)
          ? "Branding isn't switched on yet. Run the latest database update in Supabase, then try again."
          : error.message,
      ),
  });

  function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("That image is over 2 MB. Try a smaller one.");
      return;
    }
    setNewLogo(file);
    setRemoveLogo(false);
  }

  if (row.isError)
    return (
      <p className="text-body text-muted-foreground">
        Branding couldn't load. Run the latest database update in Supabase, then refresh.
      </p>
    );
  if (!row.data) return <SkeletonForm fields={3} label="Loading branding" />;
  const canEdit = row.data.isOwner;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[1.5rem] font-semibold leading-8">Branding</h2>
          <p className="mt-1 max-w-2xl text-body text-muted-foreground">
            Your colour and logo on your booking page, salon page, confirmations, the manage-booking
            link and receipts. The colour is used across your dashboard too.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        ) : null}
      </div>

      {!canEdit ? (
        <p className={cn(card, "p-4 text-body text-muted-foreground")}>
          Only the business owner can change branding.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Colour */}
          <div className={cn(card, "p-6 sm:p-8")}>
            <h3 className="text-heading font-semibold">Brand colour</h3>
            <p className="mt-1 text-body text-muted-foreground">
              Used for buttons, selected times and highlights. Each colour keeps white text easy to
              read.
            </p>
            <div
              role="radiogroup"
              aria-label="Brand colour"
              className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2"
            >
              {BRAND_PRESETS.map((preset) => {
                const selected = color === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!canEdit}
                    onClick={() => setColor(preset.key)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl p-3 text-caption font-medium transition-colors disabled:cursor-not-allowed",
                      selected ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-card",
                        selected && "ring-2 ring-foreground",
                      )}
                      style={{ background: preset.hex }}
                    >
                      {selected ? <Check size={18} weight="bold" /> : null}
                    </span>
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logo */}
          <div className={cn(card, "p-6 sm:p-8")}>
            <h3 className="text-heading font-semibold">Logo</h3>
            <p className="mt-1 text-body text-muted-foreground">
              PNG, JPG or WebP, up to 2 MB. A square logo on a plain background works best.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                {shownLogo ? (
                  <img src={shownLogo} alt="Your logo" className="size-full object-contain" />
                ) : (
                  <ImageSquare size={28} className="text-muted-foreground" />
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept={LOGO_TYPES.join(",")}
                className="hidden"
                onChange={(event) => {
                  pickLogo(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => fileInput.current?.click()}
                className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
              >
                <UploadSimple size={16} /> {shownLogo ? "Replace logo" : "Upload logo"}
              </button>
              {shownLogo ? (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => {
                    setNewLogo(null);
                    setRemoveLogo(Boolean(row.data?.logo_path));
                  }}
                  className={cn(pillButton, "text-destructive hover:bg-secondary")}
                >
                  <Trash size={16} /> Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <BrandPreview color={color} logo={shownLogo} name={row.data.name} />
      </div>
    </section>
  );
}

/** A small booking page and dashboard button in the chosen colour, before saving. */
function BrandPreview({
  color,
  logo,
  name,
}: {
  color: BrandKey;
  logo: string | null;
  name: string;
}) {
  const hex = brandHex(color);
  const style = { "--primary": hex, "--ink": hex } as CSSProperties;
  return (
    <aside aria-label="Preview" className="lg:sticky lg:top-6 lg:h-fit">
      <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
        Preview
      </p>
      <div style={style} className={cn(card, "overflow-hidden")}>
        <div className="flex items-center gap-3 border-b border-border p-4">
          {logo ? (
            <img src={logo} alt="" className="size-10 rounded-lg bg-white object-contain" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-body font-semibold">{name}</p>
            <p className="text-caption text-muted-foreground">Book an appointment</p>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between rounded-lg border border-primary p-3">
            <div>
              <p className="text-body font-medium">Silk press</p>
              <p className="text-caption text-muted-foreground">1 hr</p>
            </div>
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check size={14} weight="bold" />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-caption font-medium">
            <span className="rounded-full border border-border py-2">10:00</span>
            <span className="rounded-full bg-primary py-2 text-primary-foreground">11:30</span>
            <span className="rounded-full border border-border py-2">14:00</span>
          </div>
          <span className="flex h-11 items-center justify-center rounded-full bg-ink text-body font-semibold text-ink-foreground">
            Continue
          </span>
        </div>
        <div className="border-t border-border bg-surface p-4">
          <p className="mb-2 text-caption text-muted-foreground">In your dashboard</p>
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-body font-semibold text-primary-foreground">
            <RocketLaunch size={16} /> Continue setup
          </span>
        </div>
      </div>
    </aside>
  );
}
