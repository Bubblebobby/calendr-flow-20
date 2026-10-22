import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "@phosphor-icons/react";

import { pillButton } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { isoDay } from "@/lib/team-shifts";
import { cn } from "@/lib/utils";

/** What a checkout line represents, beyond services and products. */
export type LineExtra =
  | { kind: "gift_card"; recipientName: string; message: string; expiresOn: string | null }
  | { kind: "package"; packageId: string }
  | { kind: "membership"; membershipId: string }
  | { kind: "package_session"; clientPackageItemId: string };

export type GiftPayment = { giftCardId: string; code: string };

export type PackageRow = {
  id: string;
  name: string;
  price: number;
  valid_days: number | null;
  package_items: { service_id: string; sessions: number; services: { name: string } | null }[];
};
export type MembershipRow = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  discount_percent: number;
};
export type ClientBenefits = {
  sessions: {
    id: string;
    service_id: string | null;
    service_name: string;
    left: number;
    package_name: string;
    expires_on: string | null;
  }[];
  membership: { name: string; discount_percent: number; ends_on: string } | null;
};

const field =
  "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export function useSellables(businessId: string | undefined, open: boolean) {
  const packages = useQuery({
    queryKey: ["checkout-packages", businessId],
    enabled: Boolean(open && businessId),
    retry: false,
    queryFn: async (): Promise<PackageRow[]> => {
      const { data, error } = await supabase
        .from("packages")
        .select("id, name, price, valid_days, package_items(service_id, sessions, services(name))")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("name");
      if (error) return [];
      return (data ?? []) as unknown as PackageRow[];
    },
  });
  const memberships = useQuery({
    queryKey: ["checkout-memberships", businessId],
    enabled: Boolean(open && businessId),
    retry: false,
    queryFn: async (): Promise<MembershipRow[]> => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, name, price, duration_days, discount_percent")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("name");
      if (error) return [];
      return data ?? [];
    },
  });
  return { packages: packages.data ?? [], memberships: memberships.data ?? [] };
}

/** A client's unused package sessions and current membership. */
export function useClientBenefits(clientId: string | null) {
  return useQuery({
    queryKey: ["client-benefits", clientId],
    enabled: Boolean(clientId),
    retry: false,
    queryFn: async (): Promise<ClientBenefits> => {
      const today = isoDay(new Date());
      const [packs, members] = await Promise.all([
        supabase
          .from("client_packages")
          .select(
            "name, expires_on, client_package_items(id, service_id, service_name, sessions_total, sessions_used)",
          )
          .eq("client_id", clientId!)
          .or(`expires_on.is.null,expires_on.gte.${today}`),
        supabase
          .from("client_memberships")
          .select("name, discount_percent, ends_on")
          .eq("client_id", clientId!)
          .eq("status", "active")
          .lte("starts_on", today)
          .gte("ends_on", today)
          .order("discount_percent", { ascending: false })
          .limit(1),
      ]);
      const sessions = (packs.error ? [] : (packs.data ?? [])).flatMap((p) =>
        (
          (p.client_package_items as unknown as {
            id: string;
            service_id: string | null;
            service_name: string;
            sessions_total: number;
            sessions_used: number;
          }[]) ?? []
        )
          .filter((i) => i.sessions_used < i.sessions_total)
          .map((i) => ({
            id: i.id,
            service_id: i.service_id,
            service_name: i.service_name,
            left: i.sessions_total - i.sessions_used,
            package_name: p.name,
            expires_on: p.expires_on,
          })),
      );
      const m = members.error ? null : (members.data?.[0] ?? null);
      return {
        sessions,
        membership: m
          ? { name: m.name, discount_percent: Number(m.discount_percent), ends_on: m.ends_on }
          : null,
      };
    },
  });
}

function Shell({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        overlayClassName="z-[75]"
        className="z-[80] max-w-[30rem] gap-0 rounded-2xl border-0 p-0 [&>button]:hidden"
      >
        <div className="flex items-start justify-between gap-4 px-8 pt-6">
          <DialogTitle className="pt-3 text-title font-semibold">{title}</DialogTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X size={20} />
          </button>
        </div>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        <div className="px-8 pt-4">{children}</div>
        <div className="flex justify-end gap-2 px-8 pb-8 pt-8">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

export function GiftCardSellDialog({
  open,
  currency,
  onClose,
  onAdd,
}: {
  open: boolean;
  currency: string;
  onClose: () => void;
  onAdd: (value: number, extra: Extract<LineExtra, { kind: "gift_card" }>) => void;
}) {
  const [value, setValue] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState("365");
  useEffect(() => {
    if (open) {
      setValue("");
      setRecipient("");
      setMessage("");
      setExpiry("365");
    }
  }, [open]);
  const amount = Number(value);
  return (
    <Shell
      open={open}
      title="Sell a gift card"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!(amount > 0)}
            onClick={() => {
              const expiresOn =
                expiry === "never"
                  ? null
                  : isoDay(new Date(Date.now() + Number(expiry) * 86400000));
              onAdd(amount, {
                kind: "gift_card",
                recipientName: recipient.trim(),
                message: message.trim(),
                expiresOn,
              });
              onClose();
            }}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Add to cart
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[5000, 10000, 20000, 50000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setValue(String(preset))}
              className={cn(
                "h-10 rounded-full border px-4 text-body",
                Number(value) === preset
                  ? "border-primary bg-accent"
                  : "border-input hover:bg-secondary",
              )}
            >
              {currency}{preset.toLocaleString()}
            </button>
          ))}
        </div>
        <label className="block text-body font-semibold">
          Value ({currency})
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
            className={field}
          />
        </label>
        <label className="block text-body font-semibold">
          For <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={recipient}
            maxLength={100}
            placeholder="Recipient's name"
            onChange={(e) => setRecipient(e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-body font-semibold">
          Message <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={message}
            maxLength={200}
            onChange={(e) => setMessage(e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-body font-semibold">
          Expires
          <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className={field}>
            <option value="90">After 3 months</option>
            <option value="180">After 6 months</option>
            <option value="365">After 1 year</option>
            <option value="730">After 2 years</option>
            <option value="never">Never</option>
          </select>
        </label>
      </div>
    </Shell>
  );
}

export function RedeemGiftDialog({
  open,
  businessId,
  maxAmount,
  usedCardIds,
  money,
  onClose,
  onRedeem,
}: {
  open: boolean;
  businessId: string | undefined;
  maxAmount: number;
  usedCardIds: string[];
  money: (n: number) => string;
  onClose: () => void;
  onRedeem: (amount: number, payment: GiftPayment) => void;
}) {
  const [code, setCode] = useState("");
  const [card, setCard] = useState<{ id: string; code: string; balance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setCode("");
      setCard(null);
      setError(null);
      setAmount("");
    }
  }, [open]);
  const lookup = async () => {
    setBusy(true);
    setError(null);
    const clean = code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const { data, error: e } = await supabase
      .from("gift_cards")
      .select("id, code, balance, status, expires_on")
      .eq("business_id", businessId!)
      .eq("code", clean)
      .maybeSingle();
    setBusy(false);
    if (e || !data) return setError("No gift card with that code.");
    if (usedCardIds.includes(data.id))
      return setError("That gift card is already used in this sale.");
    if (data.status !== "active") return setError("This gift card has been voided.");
    if (data.expires_on && data.expires_on < isoDay(new Date()))
      return setError("This gift card has expired.");
    if (Number(data.balance) <= 0) return setError("This gift card has no balance left.");
    setCard({ id: data.id, code: data.code, balance: Number(data.balance) });
    setAmount(String(Math.min(Number(data.balance), maxAmount)));
  };
  const value = Number(amount);
  return (
    <Shell
      open={open}
      title="Redeem gift card"
      onClose={onClose}
      footer={
        card ? (
          <>
            <button
              type="button"
              onClick={() => setCard(null)}
              className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!(value > 0) || value > card.balance || value > maxAmount}
              onClick={() => {
                onRedeem(value, { giftCardId: card.id, code: card.code });
                onClose();
              }}
              className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
            >
              Redeem {value > 0 ? money(value) : ""}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={code.trim().length < 8 || busy}
            onClick={lookup}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            {busy ? "Checking…" : "Find gift card"}
          </button>
        )
      }
    >
      {card ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-secondary px-4 py-3 text-body">
            Gift card <span className="font-semibold">{card.code}</span> · balance{" "}
            <span className="font-semibold">{money(card.balance)}</span>
          </p>
          <label className="block text-body font-semibold">
            Amount to redeem
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className={field}
            />
            <span className="mt-1 block text-caption font-normal text-muted-foreground">
              Up to {money(Math.min(card.balance, maxAmount))}
            </span>
          </label>
        </div>
      ) : (
        <label className="block text-body font-semibold">
          Gift card code
          <input
            autoFocus
            value={code}
            maxLength={12}
            placeholder="e.g. PLTTRXS5"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && code.trim().length >= 8 && lookup()}
            className={cn(field, "font-mono uppercase tracking-widest")}
          />
          {error ? (
            <span className="mt-2 block text-caption font-normal text-destructive">{error}</span>
          ) : null}
        </label>
      )}
    </Shell>
  );
}

type FinalizeLine = {
  description: string;
  price: number;
  quantity: number;
  extra?: LineExtra | undefined;
};

/**
 * After a sale is completed: issue gift cards, give the client their packages and memberships,
 * and record gift card and package redemptions. Returns the new gift card codes.
 */
export async function finalizeExtras({
  saleId,
  businessId,
  clientId,
  lines,
  giftPayments,
  packages,
  memberships,
}: {
  saleId: string;
  businessId: string;
  clientId: string | null;
  lines: FinalizeLine[];
  giftPayments: Array<GiftPayment & { amount: number }>;
  packages: PackageRow[];
  memberships: MembershipRow[];
}): Promise<string[]> {
  const codes: string[] = [];
  for (const payment of giftPayments) {
    const { error } = await supabase
      .from("gift_card_redemptions")
      .insert({
        business_id: businessId,
        gift_card_id: payment.giftCardId,
        sale_id: saleId,
        amount: payment.amount,
      });
    if (error)
      throw new Error(
        `Gift card ${payment.code} couldn't be charged: ${error.message.replace(/^.*?(gift_card_\w+).*$/, "$1").replaceAll("_", " ")}`,
      );
  }
  for (const line of lines) {
    const extra = line.extra;
    if (!extra) continue;
    for (let n = 0; n < line.quantity; n++) {
      if (extra.kind === "gift_card") {
        const { data: code, error: codeError } = await supabase.rpc("new_gift_card_code", {
          p_business: businessId,
        });
        if (codeError) throw codeError;
        const { error } = await supabase.from("gift_cards").insert({
          business_id: businessId,
          code: code as string,
          initial_value: line.price,
          balance: line.price,
          client_id: clientId,
          recipient_name: extra.recipientName || null,
          message: extra.message || null,
          expires_on: extra.expiresOn,
          sale_id: saleId,
        });
        if (error) throw error;
        codes.push(code as string);
      } else if (extra.kind === "package" && clientId) {
        const pkg = packages.find((p) => p.id === extra.packageId);
        if (!pkg) continue;
        const { data: cp, error } = await supabase
          .from("client_packages")
          .insert({
            business_id: businessId,
            client_id: clientId,
            package_id: pkg.id,
            name: pkg.name,
            price: line.price,
            sale_id: saleId,
            expires_on: pkg.valid_days
              ? isoDay(new Date(Date.now() + pkg.valid_days * 86400000))
              : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: itemsError } = await supabase.from("client_package_items").insert(
          pkg.package_items.map((i) => ({
            business_id: businessId,
            client_package_id: cp.id,
            service_id: i.service_id,
            service_name: i.services?.name ?? "Service",
            sessions_total: i.sessions,
          })),
        );
        if (itemsError) throw itemsError;
      } else if (extra.kind === "membership" && clientId) {
        const m = memberships.find((x) => x.id === extra.membershipId);
        if (!m) continue;
        const { error } = await supabase.from("client_memberships").insert({
          business_id: businessId,
          client_id: clientId,
          membership_id: m.id,
          name: m.name,
          discount_percent: m.discount_percent,
          price: line.price,
          sale_id: saleId,
          starts_on: isoDay(new Date()),
          ends_on: isoDay(new Date(Date.now() + m.duration_days * 86400000)),
        });
        if (error) throw error;
      } else if (extra.kind === "package_session") {
        const { error } = await supabase
          .from("package_redemptions")
          .insert({
            business_id: businessId,
            client_package_item_id: extra.clientPackageItemId,
            sale_id: saleId,
            sessions: 1,
          });
        if (error) throw new Error(`Package session couldn't be used: ${error.message}`);
      }
    }
  }
  return codes;
}
