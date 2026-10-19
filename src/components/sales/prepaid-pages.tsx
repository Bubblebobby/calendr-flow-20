import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, DotsThreeVertical, Gift, Package, Plus, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/catalog/catalog-ui";
import { isMissingTable } from "@/components/calendar/blocked-time";
import { EmptyCard, FeatureIntro, SearchBox, pillButton } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { isoDay } from "@/lib/team-shifts";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

const NOTICE =
  "Gift cards, packages and memberships need a database update first: run notes/supabase-update-2026-10-19.sql in Supabase.";
const field =
  "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const menuItem = "h-10 rounded-[8px] px-3 text-body font-medium";
const dateFmt = (d: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(d.length === 10 ? `${d}T12:00:00` : d),
  );
const clientName = (c: { first_name: string; last_name: string | null } | null) =>
  c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "—";

function useMoney() {
  const { data: business } = useBusiness();
  return (n: number) =>
    business ? formatMoney(n, business.currency, business.country) : String(n);
}

function Header({
  title,
  count,
  subtitle,
  action,
}: {
  title: string;
  count?: number;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-display font-semibold">
          {title}
          {count !== undefined ? (
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-body font-semibold text-muted-foreground">
              {count}
            </span>
          ) : null}
        </h1>
        <p className="mt-1 text-body text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

const Notice = () => (
  <p className="rounded-xl bg-[#fff7e6] px-5 py-4 text-body text-[#7a4b00]">{NOTICE}</p>
);
const missing = (e: unknown) => isMissingTable(e as { code?: string; message?: string } | null);

function Badge({
  tone,
  children,
}: {
  tone: "green" | "grey" | "red" | "purple";
  children: React.ReactNode;
}) {
  const tones = {
    green: "bg-[#e6f6ea] text-[#1f8a3e]",
    grey: "bg-secondary text-muted-foreground",
    red: "bg-[#fdecef] text-destructive",
    purple: "bg-accent text-primary",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-caption font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

// ─── Sales → Gift cards sold ────────────────────────────────────────────────

type GiftRow = {
  id: string;
  code: string;
  initial_value: number;
  balance: number;
  status: string;
  expires_on: string | null;
  recipient_name: string | null;
  created_at: string;
  clients: { first_name: string; last_name: string | null } | null;
};

export function GiftCardsSold() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const money = useMoney();
  const [search, setSearch] = useState("");
  const [voiding, setVoiding] = useState<GiftRow | null>(null);
  const cards = useQuery({
    queryKey: ["gift-cards", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<GiftRow[]> => {
      const { data, error } = await supabase
        .from("gift_cards")
        .select(
          "id, code, initial_value, balance, status, expires_on, recipient_name, created_at, clients(first_name, last_name)",
        )
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as GiftRow[];
    },
  });
  const voidCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gift_cards").update({ status: "void" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setVoiding(null);
      queryClient.invalidateQueries({ queryKey: ["gift-cards"] });
      toast.success("Gift card voided");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (missing(cards.error)) return <Notice />;
  const today = isoDay(new Date());
  const list = (cards.data ?? []).filter((c) =>
    `${c.code} ${c.recipient_name ?? ""} ${clientName(c.clients)}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const outstanding = (cards.data ?? [])
    .filter((c) => c.status === "active" && (!c.expires_on || c.expires_on >= today))
    .reduce((s, c) => s + Number(c.balance), 0);
  return (
    <div className="space-y-6">
      <Header
        title="Gift cards sold"
        count={cards.data?.length ?? 0}
        subtitle={`Gift cards sold at checkout. Outstanding balance: ${money(outstanding)}.`}
      />
      {cards.data && cards.data.length === 0 ? (
        <EmptyCard
          icon={<Gift size={48} weight="duotone" />}
          title="No gift cards sold yet"
          body="Sell a gift card at checkout: Sales → Add new → Gift cards."
        />
      ) : (
        <>
          <div className="flex rounded-xl bg-toolbar p-4">
            <SearchBox value={search} onChange={setSearch} placeholder="Search by code or name" />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="px-4">Code</th>
                  <th className="px-4">Bought by</th>
                  <th className="px-4">For</th>
                  <th className="px-4 text-right">Value</th>
                  <th className="px-4 text-right">Balance</th>
                  <th className="px-4">Expires</th>
                  <th className="px-4">Status</th>
                  <th className="w-12 px-4" />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const expired = c.expires_on !== null && c.expires_on < today;
                  return (
                    <tr key={c.id}>
                      <td className="px-4 font-mono font-semibold tracking-wider">{c.code}</td>
                      <td className="px-4">{clientName(c.clients)}</td>
                      <td className="px-4 text-muted-foreground">{c.recipient_name ?? "—"}</td>
                      <td className="px-4 text-right tabular-nums">
                        {money(Number(c.initial_value))}
                      </td>
                      <td className="px-4 text-right font-semibold tabular-nums">
                        {money(Number(c.balance))}
                      </td>
                      <td className="px-4 text-muted-foreground">
                        {c.expires_on ? dateFmt(c.expires_on) : "Never"}
                      </td>
                      <td className="px-4">
                        {c.status === "void" ? (
                          <Badge tone="red">Void</Badge>
                        ) : expired ? (
                          <Badge tone="grey">Expired</Badge>
                        ) : Number(c.balance) === 0 ? (
                          <Badge tone="grey">Used</Badge>
                        ) : (
                          <Badge tone="green">Active</Badge>
                        )}
                      </td>
                      <td className="px-4">
                        {c.status === "active" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label="Gift card actions"
                              className="flex size-9 items-center justify-center rounded-full hover:bg-secondary"
                            >
                              <DotsThreeVertical size={20} weight="bold" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-xl p-2">
                              <DropdownMenuItem
                                className={cn(menuItem, "text-destructive focus:text-destructive")}
                                onSelect={() => setVoiding(c)}
                              >
                                Void gift card
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <ConfirmDialog
        open={voiding !== null}
        destructive
        busy={voidCard.isPending}
        title="Void gift card"
        body={`Gift card ${voiding?.code ?? ""} won't be usable any more. Its remaining balance is lost.`}
        confirmLabel="Void"
        onConfirm={() => voiding && voidCard.mutate(voiding.id)}
        onClose={() => setVoiding(null)}
      />
    </div>
  );
}

// ─── Sales → Packages sold ──────────────────────────────────────────────────

type ClientPackageRow = {
  id: string;
  name: string;
  price: number;
  expires_on: string | null;
  created_at: string;
  clients: { first_name: string; last_name: string | null } | null;
  client_package_items: { service_name: string; sessions_total: number; sessions_used: number }[];
};

export function PackagesSold() {
  const { data: business } = useBusiness();
  const money = useMoney();
  const [search, setSearch] = useState("");
  const sold = useQuery({
    queryKey: ["packages-sold", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<ClientPackageRow[]> => {
      const { data, error } = await supabase
        .from("client_packages")
        .select(
          "id, name, price, expires_on, created_at, clients(first_name, last_name), client_package_items(service_name, sessions_total, sessions_used)",
        )
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientPackageRow[];
    },
  });
  if (missing(sold.error)) return <Notice />;
  const today = isoDay(new Date());
  const list = (sold.data ?? []).filter((p) =>
    `${p.name} ${clientName(p.clients)}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <Header
        title="Packages sold"
        count={sold.data?.length ?? 0}
        subtitle="Packages bought by clients, and the sessions they have left."
      />
      {sold.data && sold.data.length === 0 ? (
        <EmptyCard
          icon={<Package size={48} weight="duotone" />}
          title="No packages sold yet"
          body="Create packages in Catalog → Packages, then sell them at checkout."
        />
      ) : (
        <>
          <div className="flex rounded-xl bg-toolbar p-4">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search by package or client"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="px-4">Client</th>
                  <th className="px-4">Package</th>
                  <th className="px-4">Sessions left</th>
                  <th className="px-4">Bought</th>
                  <th className="px-4">Expires</th>
                  <th className="px-4 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const total = p.client_package_items.reduce((s, i) => s + i.sessions_total, 0);
                  const used = p.client_package_items.reduce((s, i) => s + i.sessions_used, 0);
                  const expired = p.expires_on !== null && p.expires_on < today;
                  return (
                    <tr key={p.id}>
                      <td className="px-4 font-semibold">{clientName(p.clients)}</td>
                      <td className="px-4">
                        <span className="block">{p.name}</span>
                        <span className="block text-caption text-muted-foreground">
                          {p.client_package_items
                            .map(
                              (i) =>
                                `${i.service_name} ${i.sessions_total - i.sessions_used}/${i.sessions_total}`,
                            )
                            .join(" · ")}
                        </span>
                      </td>
                      <td className="px-4">
                        {expired ? (
                          <Badge tone="grey">Expired</Badge>
                        ) : total - used === 0 ? (
                          <Badge tone="grey">Used up</Badge>
                        ) : (
                          <Badge tone="purple">
                            {total - used} of {total}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 text-muted-foreground">{dateFmt(p.created_at)}</td>
                      <td className="px-4 text-muted-foreground">
                        {p.expires_on ? dateFmt(p.expires_on) : "Never"}
                      </td>
                      <td className="px-4 text-right tabular-nums">{money(Number(p.price))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sales → Memberships sold ───────────────────────────────────────────────

type ClientMembershipRow = {
  id: string;
  name: string;
  price: number;
  discount_percent: number;
  starts_on: string;
  ends_on: string;
  status: string;
  clients: { first_name: string; last_name: string | null } | null;
};

export function MembershipsSold() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const money = useMoney();
  const [cancelling, setCancelling] = useState<ClientMembershipRow | null>(null);
  const sold = useQuery({
    queryKey: ["memberships-sold", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<ClientMembershipRow[]> => {
      const { data, error } = await supabase
        .from("client_memberships")
        .select(
          "id, name, price, discount_percent, starts_on, ends_on, status, clients(first_name, last_name)",
        )
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientMembershipRow[];
    },
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_memberships")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setCancelling(null);
      queryClient.invalidateQueries({ queryKey: ["memberships-sold"] });
      toast.success("Membership cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (missing(sold.error)) return <Notice />;
  const today = isoDay(new Date());
  return (
    <div className="space-y-6">
      <Header
        title="Memberships sold"
        count={sold.data?.length ?? 0}
        subtitle="Clients' memberships and when they end."
      />
      {sold.data && sold.data.length === 0 ? (
        <EmptyCard
          icon={<Crown size={48} weight="duotone" />}
          title="No memberships sold yet"
          body="Create memberships in Catalog → Memberships, then sell them at checkout."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th className="px-4">Client</th>
                <th className="px-4">Membership</th>
                <th className="px-4">Runs</th>
                <th className="px-4">Status</th>
                <th className="px-4 text-right">Price</th>
                <th className="w-12 px-4" />
              </tr>
            </thead>
            <tbody>
              {(sold.data ?? []).map((m) => {
                const active = m.status === "active" && m.ends_on >= today;
                return (
                  <tr key={m.id}>
                    <td className="px-4 font-semibold">{clientName(m.clients)}</td>
                    <td className="px-4">
                      <span className="block">{m.name}</span>
                      <span className="block text-caption text-muted-foreground">
                        {Number(m.discount_percent)}% off services
                      </span>
                    </td>
                    <td className="px-4 text-muted-foreground">
                      {dateFmt(m.starts_on)} – {dateFmt(m.ends_on)}
                    </td>
                    <td className="px-4">
                      {m.status === "cancelled" ? (
                        <Badge tone="red">Cancelled</Badge>
                      ) : active ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="grey">Ended</Badge>
                      )}
                    </td>
                    <td className="px-4 text-right tabular-nums">{money(Number(m.price))}</td>
                    <td className="px-4">
                      {active ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Membership actions"
                            className="flex size-9 items-center justify-center rounded-full hover:bg-secondary"
                          >
                            <DotsThreeVertical size={20} weight="bold" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
                            <DropdownMenuItem
                              className={cn(menuItem, "text-destructive focus:text-destructive")}
                              onSelect={() => setCancelling(m)}
                            >
                              Cancel membership
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={cancelling !== null}
        destructive
        busy={cancel.isPending}
        title="Cancel membership"
        body={`${clientName(cancelling?.clients ?? null)} will stop getting the membership discount straight away.`}
        confirmLabel="Cancel membership"
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
        onClose={() => setCancelling(null)}
      />
    </div>
  );
}

// ─── Catalog → Packages ─────────────────────────────────────────────────────

type PackageDef = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  valid_days: number | null;
  is_active: boolean;
  package_items: {
    service_id: string;
    sessions: number;
    services: { name: string; price: number | null } | null;
  }[];
};
type ServiceOption = { id: string; name: string; price: number | null };

function useServiceOptions() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["service-options", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async (): Promise<ServiceOption[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return (data ?? [])
        .filter((s) => !s.is_archived)
        .map((s) => ({ id: s.id, name: s.name, price: s.price }));
    },
  });
}

export function PackagesPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const money = useMoney();
  const [editing, setEditing] = useState<PackageDef | "new" | null>(null);
  const [remove, setRemove] = useState<PackageDef | null>(null);
  const packages = useQuery({
    queryKey: ["packages", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<PackageDef[]> => {
      const { data, error } = await supabase
        .from("packages")
        .select(
          "id, name, description, price, valid_days, is_active, package_items(service_id, sessions, services(name, price))",
        )
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as PackageDef[];
    },
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["packages"] });
    queryClient.invalidateQueries({ queryKey: ["checkout-packages"] });
  };
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRemove(null);
      refresh();
      toast.success("Package deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (missing(packages.error)) return <Notice />;
  if (packages.data && packages.data.length === 0 && editing === null) {
    return (
      <FeatureIntro
        title="Increase your average order value with packages"
        body="Sell a set of sessions up front, like five massages, at a price that rewards clients for committing."
        bullets={[
          "Bundle sessions of one or more services",
          "Clients use sessions at checkout, tracked automatically",
          "Set an expiry, or let them never expire",
        ]}
        cta="Create a package"
        onStart={() => setEditing("new")}
      />
    );
  }
  return (
    <div className="space-y-6">
      <Header
        title="Packages"
        count={packages.data?.length ?? 0}
        subtitle="Sets of sessions clients buy up front and use over time."
        action={
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Add
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {(packages.data ?? []).map((p) => {
          const full = p.package_items.reduce(
            (s, i) => s + Number(i.services?.price ?? 0) * i.sessions,
            0,
          );
          const sessions = p.package_items.reduce((s, i) => s + i.sessions, 0);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p)}
              className="rounded-xl bg-card p-6 text-left shadow-[inset_0_0_0_1px_var(--color-border)] transition-colors hover:bg-secondary/60"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-heading font-semibold">{p.name}</span>
                {p.is_active ? null : <Badge tone="grey">Not for sale</Badge>}
              </span>
              <span className="mt-1 block text-caption text-muted-foreground">
                {sessions} session{sessions === 1 ? "" : "s"} included
                {p.valid_days ? ` · valid ${p.valid_days} days` : ""}
              </span>
              <span className="mt-3 block text-title font-semibold">{money(Number(p.price))}</span>
              {full > Number(p.price) ? (
                <span className="block text-caption font-semibold text-[#1f8a3e]">
                  Saves {money(full - Number(p.price))}
                </span>
              ) : null}
              <span className="mt-4 block space-y-1">
                {p.package_items.map((i) => (
                  <span
                    key={i.service_id}
                    className="flex justify-between rounded-lg px-3 py-2 text-caption shadow-[inset_0_0_0_1px_var(--color-border)]"
                  >
                    <span className="font-medium">{i.services?.name ?? "Service"}</span>
                    <span className="text-muted-foreground">
                      {i.sessions} session{i.sessions === 1 ? "" : "s"}
                    </span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <PackageDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
        onDelete={(p) => setRemove(p)}
      />
      <ConfirmDialog
        open={remove !== null}
        destructive
        busy={del.isPending}
        title="Delete package"
        body="Clients who already bought it keep their sessions."
        confirmLabel="Delete"
        onConfirm={() => remove && del.mutate(remove.id)}
        onClose={() => setRemove(null)}
      />
    </div>
  );
}

function ModalShell({
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
      <DialogContent className="max-h-[90vh] max-w-[40rem] gap-0 overflow-y-auto rounded-2xl border-0 p-0 [&>button]:hidden">
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
        <div className="flex flex-wrap justify-end gap-2 px-8 pb-8 pt-8">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

function PackageDialog({
  value,
  onClose,
  onSaved,
  onDelete,
}: {
  value: PackageDef | "new" | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (p: PackageDef) => void;
}) {
  const { data: business } = useBusiness();
  const money = useMoney();
  const services = useServiceOptions().data ?? [];
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    valid: "",
    active: true,
  });
  const [items, setItems] = useState<Array<{ service_id: string; sessions: string }>>([]);
  useEffect(() => {
    if (value === "new") {
      setForm({ name: "", description: "", price: "", valid: "365", active: true });
      setItems([]);
    } else if (value) {
      setForm({
        name: value.name,
        description: value.description ?? "",
        price: String(value.price),
        valid: value.valid_days ? String(value.valid_days) : "",
        active: value.is_active,
      });
      setItems(
        value.package_items.map((i) => ({
          service_id: i.service_id,
          sessions: String(i.sessions),
        })),
      );
    }
  }, [value]);
  const fullPrice = items.reduce(
    (s, i) =>
      s + Number(services.find((x) => x.id === i.service_id)?.price ?? 0) * Number(i.sessions || 0),
    0,
  );
  const valid =
    form.name.trim() &&
    form.price !== "" &&
    Number(form.price) >= 0 &&
    items.length > 0 &&
    items.every((i) => Number(i.sessions) >= 1 && Number(i.sessions) <= 100);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: business!.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        valid_days: form.valid ? Number(form.valid) : null,
        is_active: form.active,
      };
      let id = value !== "new" && value ? value.id : null;
      if (id) {
        const { error } = await supabase.from("packages").update(payload).eq("id", id);
        if (error) throw error;
        const { error: delError } = await supabase
          .from("package_items")
          .delete()
          .eq("package_id", id);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase
          .from("packages")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }
      const { error: itemsError } = await supabase
        .from("package_items")
        .insert(
          items.map((i) => ({
            business_id: business!.id,
            package_id: id!,
            service_id: i.service_id,
            sessions: Number(i.sessions),
          })),
        );
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Package saved");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <ModalShell
      open={value !== null}
      title={value === "new" ? "Create package" : "Edit package"}
      onClose={onClose}
      footer={
        <>
          {value && value !== "new" ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(value);
              }}
              className={cn(
                pillButton,
                "mr-auto border border-input bg-card text-destructive hover:bg-secondary",
              )}
            >
              Delete
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-body font-semibold">
          Package name <span className="text-destructive">*</span>
          <input
            value={form.name}
            maxLength={120}
            placeholder="e.g. 5 massages"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
          />
        </label>
        <div>
          <p className="text-body font-semibold">Sessions included</p>
          <ul className="mt-2 space-y-2">
            {items.map((item, index) => (
              <li key={index} className="flex items-center gap-2">
                <select
                  value={item.service_id}
                  onChange={(e) =>
                    setItems(
                      items.map((x, i) => (i === index ? { ...x, service_id: e.target.value } : x)),
                    )
                  }
                  className="h-11 min-w-0 flex-1 rounded-[8px] border border-input bg-card px-3 text-body"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Sessions"
                  inputMode="numeric"
                  value={item.sessions}
                  onChange={(e) =>
                    setItems(
                      items.map((x, i) =>
                        i === index ? { ...x, sessions: e.target.value.replace(/[^0-9]/g, "") } : x,
                      ),
                    )
                  }
                  className="h-11 w-20 rounded-[8px] border border-input px-3 text-body"
                />
                <span className="text-caption text-muted-foreground">sessions</span>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                >
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={!services.length}
            onClick={() => {
              const next = services.find((s) => !items.some((i) => i.service_id === s.id));
              if (next) setItems([...items, { service_id: next.id, sessions: "5" }]);
            }}
            className="mt-2 inline-flex items-center gap-1 text-body font-medium text-primary hover:underline disabled:opacity-50"
          >
            <Plus size={16} weight="bold" /> Add a service
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-body font-semibold">
            Package price ({business?.currency}) <span className="text-destructive">*</span>
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9.]/g, "") })}
              className={field}
            />
            {fullPrice > 0 ? (
              <span className="mt-1 block text-caption font-normal text-muted-foreground">
                Full price {money(fullPrice)}
                {Number(form.price) < fullPrice && form.price !== ""
                  ? `, saves ${money(fullPrice - Number(form.price))}`
                  : ""}
              </span>
            ) : null}
          </label>
          <label className="block text-body font-semibold">
            Valid for
            <select
              value={form.valid}
              onChange={(e) => setForm({ ...form, valid: e.target.value })}
              className={field}
            >
              <option value="90">3 months</option>
              <option value="180">6 months</option>
              <option value="365">1 year</option>
              <option value="">Never expires</option>
            </select>
          </label>
        </div>
        <label className="block text-body font-semibold">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={form.description}
            maxLength={300}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={field}
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-body font-semibold">
          Available to sell
          <Switch
            checked={form.active}
            onCheckedChange={(active) => setForm({ ...form, active })}
          />
        </label>
      </div>
    </ModalShell>
  );
}

// ─── Catalog → Memberships ──────────────────────────────────────────────────

type MembershipDef = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  discount_percent: number;
  is_active: boolean;
};

export function MembershipsPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const money = useMoney();
  const [editing, setEditing] = useState<MembershipDef | "new" | null>(null);
  const memberships = useQuery({
    queryKey: ["memberships", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<MembershipDef[]> => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["memberships"] });
    queryClient.invalidateQueries({ queryKey: ["checkout-memberships"] });
  };
  if (missing(memberships.error)) return <Notice />;
  if (memberships.data && memberships.data.length === 0 && editing === null) {
    return (
      <FeatureIntro
        title="Keep clients coming back with memberships"
        body="Clients pay once for a discount on every service for a set time."
        bullets={[
          "Choose the discount and how long it lasts",
          "Members get the discount at checkout in one tap",
          "See every member and when they renew",
        ]}
        cta="Create a membership"
        onStart={() => setEditing("new")}
      />
    );
  }
  return (
    <div className="space-y-6">
      <Header
        title="Memberships"
        count={memberships.data?.length ?? 0}
        subtitle="Discounts on services that clients buy for a set time."
        action={
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Add
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {(memberships.data ?? []).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setEditing(m)}
            className="rounded-xl bg-card p-6 text-left shadow-[inset_0_0_0_1px_var(--color-border)] transition-colors hover:bg-secondary/60"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-2 text-heading font-semibold">
                <Crown size={20} className="text-primary" /> {m.name}
              </span>
              {m.is_active ? null : <Badge tone="grey">Not for sale</Badge>}
            </span>
            <span className="mt-3 block text-title font-semibold">{money(Number(m.price))}</span>
            <span className="block text-body text-muted-foreground">
              {Number(m.discount_percent)}% off services · {m.duration_days} days
            </span>
          </button>
        ))}
      </div>
      <MembershipDialog value={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </div>
  );
}

function MembershipDialog({
  value,
  onClose,
  onSaved,
}: {
  value: MembershipDef | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: business } = useBusiness();
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    duration: "30",
    discount: "10",
    active: true,
  });
  useEffect(() => {
    if (value === "new")
      setForm({
        name: "",
        description: "",
        price: "",
        duration: "30",
        discount: "10",
        active: true,
      });
    else if (value)
      setForm({
        name: value.name,
        description: value.description ?? "",
        price: String(value.price),
        duration: String(value.duration_days),
        discount: String(value.discount_percent),
        active: value.is_active,
      });
  }, [value]);
  const valid =
    form.name.trim() &&
    form.price !== "" &&
    Number(form.discount) > 0 &&
    Number(form.discount) <= 100 &&
    Number(form.duration) >= 1;
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: business!.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        duration_days: Number(form.duration),
        discount_percent: Number(form.discount),
        is_active: form.active,
      };
      const { error } =
        value === "new"
          ? await supabase.from("memberships").insert(payload)
          : await supabase
              .from("memberships")
              .update(payload)
              .eq("id", (value as MembershipDef).id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membership saved");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <ModalShell
      open={value !== null}
      title={value === "new" ? "Create membership" : "Edit membership"}
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
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-body font-semibold">
          Membership name <span className="text-destructive">*</span>
          <input
            value={form.name}
            maxLength={120}
            placeholder="e.g. Gold membership"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-body font-semibold">
            Price ({business?.currency})
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9.]/g, "") })}
              className={field}
            />
          </label>
          <label className="block text-body font-semibold">
            Discount (%)
            <input
              inputMode="decimal"
              value={form.discount}
              onChange={(e) =>
                setForm({ ...form, discount: e.target.value.replace(/[^0-9.]/g, "") })
              }
              className={field}
            />
          </label>
          <label className="block text-body font-semibold">
            Lasts
            <select
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className={field}
            >
              <option value="30">1 month</option>
              <option value="90">3 months</option>
              <option value="180">6 months</option>
              <option value="365">1 year</option>
            </select>
          </label>
        </div>
        <label className="block text-body font-semibold">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={form.description}
            maxLength={300}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={field}
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-body font-semibold">
          Available to sell
          <Switch
            checked={form.active}
            onCheckedChange={(active) => setForm({ ...form, active })}
          />
        </label>
      </div>
    </ModalShell>
  );
}
