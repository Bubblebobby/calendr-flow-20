import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DotsThreeVertical, Package, Plus, Trash, Truck, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/catalog/catalog-ui";
import {
  INVENTORY_DB_NOTICE,
  useProducts,
  useSuppliersList,
} from "@/components/catalog/products-pages";
import { isMissingTable } from "@/components/calendar/blocked-time";
import { EmptyCard, FeatureIntro, SearchBox, pillButton } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

const menuItem = "h-10 rounded-[8px] px-3 text-body font-medium";
const field =
  "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const dateFmt = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );

function CountHeader({
  title,
  count,
  subtitle,
  action,
}: {
  title: string;
  count: number;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-display font-semibold">
          {title}
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-body font-semibold text-muted-foreground">
            {count}
          </span>
        </h1>
        <p className="mt-1 text-body text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function ModalShell({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[90vh] gap-0 overflow-y-auto rounded-2xl border-0 p-0 [&>button]:hidden",
          wide ? "max-w-[45rem]" : "max-w-[32rem]",
        )}
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

const DbNotice = () => (
  <p className="rounded-xl bg-[#fff7e6] px-5 py-4 text-body text-[#7a4b00]">
    {INVENTORY_DB_NOTICE}
  </p>
);

// ─── Suppliers ──────────────────────────────────────────────────────────────

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export function SuppliersPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [remove, setRemove] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const suppliers = useQuery({
    queryKey: ["suppliers-full", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["suppliers-full"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  };
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRemove(null);
      refresh();
      toast.success("Supplier deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (suppliers.error && isMissingTable(suppliers.error as { code?: string; message?: string }))
    return <DbNotice />;
  const list = (suppliers.data ?? []).filter((s) =>
    `${s.name} ${s.contact_name ?? ""} ${s.email ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <CountHeader
        title="Suppliers"
        count={suppliers.data?.length ?? 0}
        subtitle="Add and manage details of your suppliers."
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
      {suppliers.data && suppliers.data.length === 0 ? (
        <EmptyCard
          icon={<Truck size={48} weight="duotone" />}
          title="No suppliers yet"
          body="Add a supplier to track where your stock comes from and order from them."
          action={
            <button
              type="button"
              onClick={() => setEditing("new")}
              className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
            >
              Add supplier
            </button>
          }
        />
      ) : (
        <>
          <div className="flex rounded-xl bg-toolbar p-4">
            <SearchBox value={search} onChange={setSearch} placeholder="Search suppliers" />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th className="px-4">Supplier</th>
                  <th className="px-4">Contact</th>
                  <th className="px-4">Email</th>
                  <th className="px-4">Phone</th>
                  <th className="w-12 px-4" />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => setEditing(s)}>
                    <td className="px-4 font-semibold">{s.name}</td>
                    <td className="px-4 text-muted-foreground">{s.contact_name ?? "—"}</td>
                    <td className="px-4 text-muted-foreground">{s.email ?? "—"}</td>
                    <td className="px-4 text-muted-foreground">{s.phone ?? "—"}</td>
                    <td className="px-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => setRemove(s)}
                        className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                      >
                        <Trash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <SupplierDialog
        supplier={editing}
        businessId={business?.id}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={remove !== null}
        destructive
        busy={del.isPending}
        title="Delete supplier"
        body={`Delete ${remove?.name ?? "this supplier"}? Products and past orders keep their details.`}
        confirmLabel="Delete"
        onConfirm={() => remove && del.mutate(remove.id)}
        onClose={() => setRemove(null)}
      />
    </div>
  );
}

function SupplierDialog({
  supplier,
  businessId,
  onClose,
  onSaved,
}: {
  supplier: Supplier | "new" | null;
  businessId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const empty = { name: "", contact_name: "", email: "", phone: "", address: "", notes: "" };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    if (supplier === "new") setForm(empty);
    else if (supplier)
      setForm({
        name: supplier.name,
        contact_name: supplier.contact_name ?? "",
        email: supplier.email ?? "",
        phone: supplier.phone ?? "",
        address: supplier.address ?? "",
        notes: supplier.notes ?? "",
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier]);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId!,
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };
      const { error } =
        supplier === "new"
          ? await supabase.from("suppliers").insert(payload)
          : await supabase
              .from("suppliers")
              .update(payload)
              .eq("id", (supplier as Supplier).id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier saved");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const input = (
    key: keyof typeof empty,
    label: string,
    opts: { required?: boolean; type?: string } = {},
  ) => (
    <label className="block text-body font-semibold">
      {label}
      {opts.required ? <span className="text-destructive"> *</span> : null}
      <input
        type={opts.type ?? "text"}
        value={form[key]}
        maxLength={key === "notes" ? 500 : 160}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={field}
      />
    </label>
  );
  return (
    <ModalShell
      open={supplier !== null}
      title={supplier === "new" ? "Add supplier" : "Edit supplier"}
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
            disabled={!form.name.trim() || save.isPending}
            onClick={() => save.mutate()}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {input("name", "Supplier name", { required: true })}
        {input("contact_name", "Contact person")}
        <div className="grid grid-cols-2 gap-3">
          {input("email", "Email", { type: "email" })}
          {input("phone", "Phone", { type: "tel" })}
        </div>
        {input("address", "Address")}
        {input("notes", "Notes")}
      </div>
    </ModalShell>
  );
}

// ─── Stock orders ───────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  received_at: string | null;
  supplier_id: string | null;
  suppliers: { name: string } | null;
  stock_order_items: {
    id: string;
    product_id: string;
    quantity: number;
    supply_price: number | null;
    products: { name: string } | null;
  }[];
};

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-muted-foreground" },
  ordered: { label: "Ordered", className: "bg-accent text-primary" },
  received: { label: "Received", className: "bg-[#e6f6ea] text-[#1f8a3e]" },
  cancelled: { label: "Cancelled", className: "bg-[#fdecef] text-destructive" },
};

export function StockOrdersPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const products = useProducts();
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{
    kind: "receive" | "cancel" | "delete";
    order: OrderRow;
  } | null>(null);
  const orders = useQuery({
    queryKey: ["stock-orders", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("stock_orders")
        .select(
          "id, status, notes, created_at, received_at, supplier_id, suppliers(name), stock_order_items(id, product_id, quantity, supply_price, products(name))",
        )
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });
  const money = (n: number) =>
    business ? formatMoney(n, business.currency, business.country) : String(n);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("stock_orders")
        .update({
          status,
          ...(status === "ordered" ? { ordered_at: new Date().toISOString() } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const runConfirm = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      if (confirm.kind === "receive") {
        const { error } = await supabase.rpc("receive_stock_order", { p_order: confirm.order.id });
        if (error) throw error;
      } else if (confirm.kind === "cancel") {
        const { error } = await supabase
          .from("stock_orders")
          .update({ status: "cancelled" })
          .eq("id", confirm.order.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stock_orders").delete().eq("id", confirm.order.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        confirm?.kind === "receive"
          ? "Order received: stock updated"
          : confirm?.kind === "cancel"
            ? "Order cancelled"
            : "Order deleted",
      );
      setConfirm(null);
      refresh();
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("already_closed") ? "This order is already closed" : e.message,
      ),
  });

  if (orders.error && isMissingTable(orders.error as { code?: string; message?: string }))
    return <DbNotice />;
  const noProducts = products.data && products.data.filter((p) => !p.is_archived).length === 0;

  return (
    <div className="space-y-6">
      <CountHeader
        title="Stock orders"
        count={orders.data?.length ?? 0}
        subtitle="Order stock from suppliers and receive it into your inventory."
        action={
          <button
            type="button"
            disabled={Boolean(noProducts)}
            onClick={() => setCreating(true)}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            New order
          </button>
        }
      />
      {noProducts ? (
        <EmptyCard
          icon={<Package size={48} weight="duotone" />}
          title="No products created yet"
          body="Add products in Catalog → Products, then create stock orders here."
        />
      ) : orders.data && orders.data.length === 0 ? (
        <EmptyCard
          icon={<Truck size={48} weight="duotone" />}
          title="No stock orders yet"
          body="Create an order when you buy stock from a supplier. Receiving it adds the stock automatically."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th className="px-4">Order</th>
                <th className="px-4">Supplier</th>
                <th className="px-4">Items</th>
                <th className="px-4 text-right">Cost</th>
                <th className="px-4">Status</th>
                <th className="w-12 px-4" />
              </tr>
            </thead>
            <tbody>
              {(orders.data ?? []).map((o) => {
                const status = ORDER_STATUS[o.status] ?? ORDER_STATUS["draft"]!;
                const cost = o.stock_order_items.reduce(
                  (s, i) => s + Number(i.supply_price ?? 0) * i.quantity,
                  0,
                );
                const open = o.status === "draft" || o.status === "ordered";
                return (
                  <tr key={o.id}>
                    <td className="px-4">
                      <span className="block font-semibold">#{o.id.slice(0, 6).toUpperCase()}</span>
                      <span className="block text-caption text-muted-foreground">
                        {dateFmt(o.created_at)}
                      </span>
                    </td>
                    <td className="px-4 text-muted-foreground">{o.suppliers?.name ?? "—"}</td>
                    <td className="px-4 text-muted-foreground">
                      {o.stock_order_items
                        .map((i) => `${i.products?.name ?? "Product"} ×${i.quantity}`)
                        .join(", ")}
                    </td>
                    <td className="px-4 text-right tabular-nums">{cost ? money(cost) : "—"}</td>
                    <td className="px-4">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-caption font-semibold",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4">
                      {open ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Order actions"
                            className="flex size-9 items-center justify-center rounded-full hover:bg-secondary"
                          >
                            <DotsThreeVertical size={20} weight="bold" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-xl p-2">
                            {o.status === "draft" ? (
                              <DropdownMenuItem
                                className={menuItem}
                                onSelect={() => setStatus.mutate({ id: o.id, status: "ordered" })}
                              >
                                Mark as ordered
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              className={menuItem}
                              onSelect={() => setConfirm({ kind: "receive", order: o })}
                            >
                              Receive stock
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-2" />
                            <DropdownMenuItem
                              className={cn(menuItem, "text-destructive focus:text-destructive")}
                              onSelect={() =>
                                setConfirm({
                                  kind: o.status === "draft" ? "delete" : "cancel",
                                  order: o,
                                })
                              }
                            >
                              {o.status === "draft" ? "Delete draft" : "Cancel order"}
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
      <NewOrderDialog open={creating} onClose={() => setCreating(false)} onSaved={refresh} />
      <ConfirmDialog
        open={confirm !== null}
        destructive={confirm?.kind !== "receive"}
        busy={runConfirm.isPending}
        title={
          confirm?.kind === "receive"
            ? "Receive stock"
            : confirm?.kind === "cancel"
              ? "Cancel order"
              : "Delete draft"
        }
        body={
          confirm?.kind === "receive"
            ? `Add ${confirm.order.stock_order_items.reduce((s, i) => s + i.quantity, 0)} items to your stock and close this order?`
            : "Are you sure? This can't be undone."
        }
        confirmLabel={
          confirm?.kind === "receive"
            ? "Receive"
            : confirm?.kind === "cancel"
              ? "Cancel order"
              : "Delete"
        }
        onConfirm={() => runConfirm.mutate()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function NewOrderDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: business } = useBusiness();
  const products = (useProducts().data ?? []).filter((p) => !p.is_archived);
  const suppliers = useSuppliersList().data ?? [];
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Array<{ productId: string; qty: string; price: string }>>([]);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (open) {
      setSupplierId("");
      setLines([]);
      setNotes("");
    }
  }, [open]);
  const addProduct = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p || lines.some((l) => l.productId === productId)) return;
    setLines([
      ...lines,
      { productId, qty: "1", price: p.supply_price === null ? "" : String(p.supply_price) },
    ]);
  };
  const valid = lines.length > 0 && lines.every((l) => Number(l.qty) > 0);
  const save = useMutation({
    mutationFn: async (status: "draft" | "ordered") => {
      const { data, error } = await supabase
        .from("stock_orders")
        .insert({
          business_id: business!.id,
          supplier_id: supplierId || null,
          status,
          notes: notes.trim() || null,
          ...(status === "ordered" ? { ordered_at: new Date().toISOString() } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemsError } = await supabase
        .from("stock_order_items")
        .insert(
          lines.map((l) => ({
            order_id: data.id,
            business_id: business!.id,
            product_id: l.productId,
            quantity: Number(l.qty),
            supply_price: l.price === "" ? null : Number(l.price),
          })),
        );
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Stock order created");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  // Products from the chosen supplier first.
  const sorted = useMemo(
    () =>
      [...products].sort(
        (a, b) =>
          Number(b.supplier_id === supplierId) - Number(a.supplier_id === supplierId) ||
          a.name.localeCompare(b.name),
      ),
    [products, supplierId],
  );
  return (
    <ModalShell
      open={open}
      wide
      title="New stock order"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            disabled={!valid || save.isPending}
            onClick={() => save.mutate("draft")}
            className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={!valid || save.isPending}
            onClick={() => save.mutate("ordered")}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Place order
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-body font-semibold">
          Supplier
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={field}
          >
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-body font-semibold">
          Add product
          <select value="" onChange={(e) => addProduct(e.target.value)} className={field}>
            <option value="">Choose a product…</option>
            {sorted
              .filter((p) => !lines.some((l) => l.productId === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.track_stock ? ` (${p.stock_quantity} in stock)` : ""}
                </option>
              ))}
          </select>
        </label>
        {lines.length ? (
          <ul className="divide-y divide-border rounded-xl shadow-[inset_0_0_0_1px_var(--color-border)]">
            {lines.map((line, index) => (
              <li key={line.productId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-40 flex-1 text-body font-medium">
                  {products.find((p) => p.id === line.productId)?.name}
                </span>
                <label className="text-caption text-muted-foreground">
                  Qty
                  <input
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) =>
                          i === index ? { ...l, qty: e.target.value.replace(/[^0-9]/g, "") } : l,
                        ),
                      )
                    }
                    className="ml-2 h-10 w-20 rounded-[8px] border border-input px-3 text-body text-foreground"
                  />
                </label>
                <label className="text-caption text-muted-foreground">
                  Cost each
                  <input
                    inputMode="decimal"
                    value={line.price}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) =>
                          i === index ? { ...l, price: e.target.value.replace(/[^0-9.]/g, "") } : l,
                        ),
                      )
                    }
                    className="ml-2 h-10 w-28 rounded-[8px] border border-input px-3 text-body text-foreground"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                >
                  <Trash size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">Add the products you're ordering.</p>
        )}
        <label className="block text-body font-semibold">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
            className={field}
          />
        </label>
      </div>
    </ModalShell>
  );
}

// ─── Stocktakes ─────────────────────────────────────────────────────────────

type TakeRow = {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  stocktake_items: {
    id: string;
    product_id: string;
    expected: number;
    counted: number | null;
    products: { name: string; stock_quantity: number } | null;
  }[];
};

export function StocktakesPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const products = useProducts();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<"complete" | "discard" | null>(null);
  const takes = useQuery({
    queryKey: ["stocktakes", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<TakeRow[]> => {
      const { data, error } = await supabase
        .from("stocktakes")
        .select(
          "id, status, started_at, completed_at, notes, stocktake_items(id, product_id, expected, counted, products(name, stock_quantity))",
        )
        .eq("business_id", business!.id)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TakeRow[];
    },
  });
  const current = takes.data?.find((t) => t.status === "in_progress") ?? null;
  useEffect(() => {
    if (current)
      setCounts(
        Object.fromEntries(
          current.stocktake_items.map((i) => [i.id, i.counted === null ? "" : String(i.counted)]),
        ),
      );
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stocktakes"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  const start = useMutation({
    mutationFn: async () => {
      const tracked = (products.data ?? []).filter((p) => p.track_stock && !p.is_archived);
      const { data, error } = await supabase
        .from("stocktakes")
        .insert({ business_id: business!.id })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemsError } = await supabase
        .from("stocktake_items")
        .insert(
          tracked.map((p) => ({
            stocktake_id: data.id,
            business_id: business!.id,
            product_id: p.id,
            expected: p.stock_quantity,
          })),
        );
      if (itemsError) throw itemsError;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const saveCounts = async () => {
    if (!current) return;
    const changed = current.stocktake_items.filter(
      (i) => (counts[i.id] ?? "") !== (i.counted === null ? "" : String(i.counted)),
    );
    for (const item of changed) {
      const value = counts[item.id] ?? "";
      const { error } = await supabase
        .from("stocktake_items")
        .update({ counted: value === "" ? null : Number(value) })
        .eq("id", item.id);
      if (error) throw error;
    }
  };
  const save = useMutation({
    mutationFn: saveCounts,
    onSuccess: () => {
      toast.success("Counts saved. You can finish later.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const finish = useMutation({
    mutationFn: async () => {
      await saveCounts();
      if (confirm === "discard") {
        const { error } = await supabase.from("stocktakes").delete().eq("id", current!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("complete_stocktake", { p_stocktake: current!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        confirm === "discard" ? "Stocktake discarded" : "Stocktake completed: stock updated",
      );
      setConfirm(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (takes.error && isMissingTable(takes.error as { code?: string; message?: string }))
    return <DbNotice />;

  if (current) {
    const counted = current.stocktake_items.filter((i) => (counts[i.id] ?? "") !== "").length;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-display font-semibold">Stocktake in progress</h1>
            <p className="mt-1 text-body text-muted-foreground">
              Started {dateFmt(current.started_at)} · {counted} of {current.stocktake_items.length}{" "}
              counted. Leave a product blank to keep its stock as it is.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm("discard")}
              className={cn(
                pillButton,
                "border border-input bg-card text-destructive hover:bg-secondary",
              )}
            >
              Discard
            </button>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
            >
              Save and pause
            </button>
            <button
              type="button"
              disabled={!counted}
              onClick={() => setConfirm("complete")}
              className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
            >
              Complete
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th className="px-4">Product</th>
                <th className="px-4 text-right">Expected</th>
                <th className="px-4 text-right">Counted</th>
                <th className="px-4 text-right">Difference</th>
              </tr>
            </thead>
            <tbody>
              {current.stocktake_items.map((item) => {
                const value = counts[item.id] ?? "";
                const expected = item.products?.stock_quantity ?? item.expected;
                const diff = value === "" ? null : Number(value) - expected;
                return (
                  <tr key={item.id}>
                    <td className="px-4 font-medium">{item.products?.name ?? "Product"}</td>
                    <td className="px-4 text-right tabular-nums">{expected}</td>
                    <td className="px-4 text-right">
                      <input
                        inputMode="numeric"
                        aria-label={`Counted ${item.products?.name ?? ""}`}
                        value={value}
                        onChange={(e) =>
                          setCounts({ ...counts, [item.id]: e.target.value.replace(/[^0-9]/g, "") })
                        }
                        className="h-10 w-24 rounded-[8px] border border-input px-3 text-right text-body tabular-nums"
                      />
                    </td>
                    <td
                      className={cn(
                        "px-4 text-right font-semibold tabular-nums",
                        diff === null || diff === 0
                          ? "text-muted-foreground"
                          : diff > 0
                            ? "text-[#1f8a3e]"
                            : "text-destructive",
                      )}
                    >
                      {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ConfirmDialog
          open={confirm !== null}
          destructive={confirm === "discard"}
          busy={finish.isPending}
          title={confirm === "discard" ? "Discard stocktake" : "Complete stocktake"}
          body={
            confirm === "discard"
              ? "Your counts will be lost and stock stays as it is."
              : "Stock will be set to your counted figures for every product you counted."
          }
          confirmLabel={confirm === "discard" ? "Discard" : "Complete"}
          onConfirm={() => finish.mutate()}
          onClose={() => setConfirm(null)}
        />
      </div>
    );
  }

  const tracked = (products.data ?? []).filter((p) => p.track_stock && !p.is_archived);
  if (takes.data && takes.data.length === 0) {
    return (
      <FeatureIntro
        title="Track and record your product stock"
        body="Count your stock, see what's missing, and update your inventory in one go."
        bullets={[
          "Count every tracked product in one list",
          "Pause and pick up where you left off",
          "Stock updates as soon as you finish",
          "Differences are kept in each product's stock history",
        ]}
        cta={tracked.length ? "Start stocktake" : "Add products first"}
        onStart={() =>
          tracked.length
            ? start.mutate()
            : toast("Add products with stock tracking in Catalog → Products first")
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <CountHeader
        title="Stocktakes"
        count={takes.data?.length ?? 0}
        subtitle="Count your stock and correct any differences."
        action={
          <button
            type="button"
            disabled={!tracked.length || start.isPending}
            onClick={() => start.mutate()}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            <Plus size={18} weight="bold" /> Start stocktake
          </button>
        }
      />
      <ul className="divide-y divide-border rounded-xl shadow-[inset_0_0_0_1px_var(--color-border)]">
        {(takes.data ?? []).map((t) => {
          const diffs = t.stocktake_items.filter(
            (i) => i.counted !== null && i.counted !== i.expected,
          ).length;
          return (
            <li key={t.id} className="flex items-center gap-4 px-5 py-4">
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold">
                  Stocktake {dateFmt(t.started_at)}
                </span>
                <span className="block text-caption text-muted-foreground">
                  {t.stocktake_items.length} products · {diffs} difference{diffs === 1 ? "" : "s"}
                  {t.completed_at ? ` · completed ${dateFmt(t.completed_at)}` : ""}
                </span>
              </span>
              <span className="rounded-full bg-[#e6f6ea] px-2 py-0.5 text-caption font-semibold text-[#1f8a3e]">
                Completed
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
