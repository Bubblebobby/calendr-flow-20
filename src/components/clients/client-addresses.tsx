import { useEffect, useState } from "react";
import {
  Briefcase,
  Check,
  House,
  MapPin,
  MapPinLine,
  PencilSimple,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, countryByCode, flagEmoji } from "@/lib/countries";
import { cn } from "@/lib/utils";

export type ClientAddressType = "home" | "work" | "other";

export type ClientAddressValue = {
  address_type: ClientAddressType;
  address_name: string;
  street_address: string;
  apartment_suite: string;
  district: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
};

const FIELD = "h-12 rounded-xl border border-[#D3D3D3] bg-transparent text-base";

const TYPES: { value: ClientAddressType; label: string; icon: typeof House }[] = [
  { value: "home", label: "Home", icon: House },
  { value: "work", label: "Work", icon: Briefcase },
  { value: "other", label: "Other", icon: MapPinLine },
];

const BREAKDOWN: { key: keyof ClientAddressValue; label: string }[] = [
  { key: "street_address", label: "Address" },
  { key: "apartment_suite", label: "Apt./Suite etc" },
  { key: "district", label: "District" },
  { key: "city", label: "City" },
  { key: "region", label: "Region" },
  { key: "postcode", label: "Postcode" },
];

export function emptyAddress(country: string): ClientAddressValue {
  return {
    address_type: "home",
    address_name: "Home",
    street_address: "",
    apartment_suite: "",
    district: "",
    city: "",
    region: "",
    postcode: "",
    country,
  };
}

export function formatAddress(value: ClientAddressValue): string {
  return [
    value.street_address,
    value.apartment_suite,
    value.district,
    value.city,
    value.region,
    value.postcode,
    countryByCode(value.country)?.name ?? value.country,
  ]
    .filter((part) => part && part.trim())
    .join(", ");
}

export function ClientAddressesPanel({
  value,
  onChange,
  defaultCountry,
}: {
  value: ClientAddressValue | null;
  onChange: (next: ClientAddressValue | null) => void;
  defaultCountry: string;
}) {
  const [bannerOpen, setBannerOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const TypeIcon = TYPES.find((t) => t.value === value?.address_type)?.icon ?? House;

  return (
    <section className="space-y-6">
      {bannerOpen ? (
        <div className="flex items-start gap-4 rounded-2xl bg-accent/40 p-5">
          <p className="text-sm leading-relaxed text-foreground">
            Client details will be saved exactly as entered. By adding them, you confirm they have
            agreed to receive messages (SMS or email) from your business that the platform may send
            on your behalf.
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setBannerOpen(false)}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      ) : null}

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Addresses</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage your client&apos;s address</p>
      </div>

      {value ? (
        <div className="flex items-start gap-4 rounded-2xl border border-[#D3D3D3] bg-white p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/40 text-primary">
            <TypeIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">{value.address_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatAddress(value)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Edit address"
              onClick={() => setModalOpen(true)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PencilSimple size={18} />
            </button>
            <button
              type="button"
              aria-label="Delete address"
              onClick={() => onChange(null)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <Trash size={18} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 text-base font-semibold text-primary hover:underline"
        >
          <Plus size={16} weight="bold" />
          Add new address
        </button>
      )}

      <AddressModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={value}
        defaultCountry={defaultCountry}
        onSubmit={(next) => {
          onChange(next);
          setModalOpen(false);
        }}
      />
    </section>
  );
}

function AddressModal({
  open,
  onOpenChange,
  initial,
  defaultCountry,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ClientAddressValue | null;
  defaultCountry: string;
  onSubmit: (value: ClientAddressValue) => void;
}) {
  const [draft, setDraft] = useState<ClientAddressValue>(
    initial ?? emptyAddress(defaultCountry),
  );
  const [nameEdited, setNameEdited] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? emptyAddress(defaultCountry));
    setNameEdited(Boolean(initial));
    setExpanded([]);
    setError(null);
  }, [open, initial, defaultCountry]);

  const set = <K extends keyof ClientAddressValue>(key: K, val: ClientAddressValue[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }));

  const pickType = (type: ClientAddressType) => {
    const label = TYPES.find((t) => t.value === type)?.label ?? "Home";
    setDraft((prev) => ({
      ...prev,
      address_type: type,
      address_name: nameEdited ? prev.address_name : label,
    }));
  };

  const submit = () => {
    if (!draft.street_address.trim() || !draft.country) {
      setError("Address and country are required.");
      return;
    }
    onSubmit({ ...draft, address_name: draft.address_name.trim() || "Address" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl p-0 [&>button]:hidden">
        <div className="flex items-start justify-between px-7 pt-7">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">New address</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="space-y-6 px-7 pb-2 pt-6">
          <div className="grid grid-cols-3 gap-3">
            {TYPES.map((type) => {
              const active = draft.address_type === type.value;
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => pickType(type.value)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-colors",
                    active
                      ? "border-primary bg-accent/30"
                      : "border-[#D3D3D3] hover:border-foreground/30",
                  )}
                >
                  {active ? (
                    <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check size={12} weight="bold" />
                    </span>
                  ) : null}
                  <Icon size={22} className={active ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-sm font-semibold text-foreground">{type.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address-name">Address name</Label>
            <Input
              id="address-name"
              className={FIELD}
              value={draft.address_name}
              onChange={(event) => {
                setNameEdited(true);
                set("address_name", event.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address-line">Address</Label>
            <div className="relative">
              <MapPin
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="address-line"
                className={cn(FIELD, "pl-11")}
                placeholder="Start typing the address"
                value={draft.street_address}
                onChange={(event) => set("street_address", event.target.value)}
              />
            </div>
          </div>

          <div className="divide-y divide-[#D3D3D3] rounded-2xl border border-[#D3D3D3]">
            {BREAKDOWN.map((field) => {
              const raw = draft[field.key];
              const current = typeof raw === "string" ? raw : "";
              const isOpen = expanded.includes(field.key) || Boolean(current);
              return (
                <div key={field.key} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-foreground">{field.label}</span>
                    {!isOpen ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => [...prev, field.key])}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        + Add
                      </button>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Edit
                      </span>
                    )}
                  </div>
                  {isOpen ? (
                    <Input
                      className={cn(FIELD, "mt-2 h-11")}
                      value={current}
                      onChange={(event) =>
                        set(field.key, event.target.value as ClientAddressValue[typeof field.key])
                      }
                    />
                  ) : null}
                </div>
              );
            })}

            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-foreground">Country</span>
              </div>
              <Select value={draft.country} onValueChange={(val) => set("country", val)}>
                <SelectTrigger className={cn(FIELD, "mt-2 h-11")}>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {flagEmoji(c.code)} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-3 px-7 pb-7 pt-4">
          <Button
            variant="outline"
            className="h-11 rounded-full border-[#D3D3D3] bg-white px-6 text-base font-semibold text-foreground hover:bg-white hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="h-11 rounded-full px-7 text-base font-semibold" onClick={submit}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
