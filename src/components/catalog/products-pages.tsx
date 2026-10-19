import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretDown, DotsThreeVertical, Package, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/catalog/catalog-ui";
import { isMissingTable } from "@/components/calendar/blocked-time";
import { ChipButton, FeatureIntro, SearchBox, pillButton } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

export const INVENTORY_DB_NOTICE =
  "Products and inventory need a database update first: run notes/supabase-update-2026-10-19.sql in Supabase.";

export type Product = {
  id: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
  supplier_id: string | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  retail_price: number;
  supply_price: number | null;
  track_stock: boolean;
  stock_quantity: number;
  low_stock_threshold: number | null;
  is_archived: boolean;
};
type Named = { id: string; name: string };

const menuItem = "h-10 rounded-[8px] px-3 text-body font-medium";
const field =
  "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export function useProducts() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["products", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useNamed(table: "product_brands" | "product_categories" | "suppliers") {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: [table, business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<Named[]> => {
      const { data, error } = await supabase
        .from(table)
        .select("id, name")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const useSuppliersList = () => useNamed("suppliers");

export function stockState(p: Product): "out" | "low" | "ok" | "untracked" {
  if (!p.track_stock) return "untracked";
  if (p.stock_quantity <= 0) return "out";
  if (p.low_stock_threshold !== null && p.stock_quantity <= p.low_stock_threshold) return "low";
  return "ok";
}

export function StockBadge({ product }: { product: Product }) {
  const state = stockState(product);
  if (state === "untracked") return <span className="text-muted-foreground">Not tracked</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">{product.stock_quantity}</span>
      {state !== "ok" ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-caption font-semibold",
            state === "out" ? "bg-[#fdecef] text-destructive" : "bg-[#fff1e6] text-[#9a4b00]",
          )}
        >
          {state === "out" ? "Out of stock" : "Low stock"}
        </span>
      ) : null}
    </span>
  );
}

export function ProductsPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const products = useProducts();
  const brands = useNamed("product_brands");
  const categories = useNamed("product_categories");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "archive" | "delete"; product: Product } | null>(
    null,
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const money = (n: number) =>
    business ? formatMoney(n, business.currency, business.country) : String(n);
  const brandName = (id: string | null) => brands.data?.find((b) => b.id === id)?.name ?? "";
  const categoryName = (id: string | null) => categories.data?.find((c) => c.id === id)?.name ?? "";

  const runConfirm = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      const { error } =
        confirm.kind === "delete"
          ? await supabase.from("products").delete().eq("id", confirm.product.id)
          : await supabase
              .from("products")
              .update({ is_archived: !confirm.product.is_archived })
              .eq("id", confirm.product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        confirm?.kind === "delete"
          ? "Product deleted"
          : confirm?.product.is_archived
            ? "Product restored"
            : "Product archived",
      );
      setConfirm(null);
      refresh();
    },
    onError: (error: Error) =>
      toast.error(
        /foreign key|violates/i.test(error.message)
          ? "This product has sales history. Archive it instead."
          : error.message,
      ),
  });

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products.data ?? []).filter((p) => {
      if (!showArchived && p.is_archived) return false;
      if (categoryFilter && p.category_id !== categoryFilter) return false;
      if (lowOnly && !["low", "out"].includes(stockState(p))) return false;
      return (
        !term ||
        `${p.name} ${p.sku ?? ""} ${p.barcode ?? ""} ${brandName(p.brand_id)}`
          .toLowerCase()
          .includes(term)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.data, search, categoryFilter, lowOnly, showArchived, brands.data]);

  if (products.error && isMissingTable(products.error as { code?: string; message?: string })) {
    return (
      <p className="rounded-xl bg-[#fff7e6] px-5 py-4 text-body text-[#7a4b00]">
        {INVENTORY_DB_NOTICE}
      </p>
    );
  }
  if (products.data && products.data.length === 0 && editing === null) {
    return (
      <FeatureIntro
        title="Manage your inventory with a product list"
        body="Keep track of the products you sell and use, with stock levels that make ordering, tracking and selling easy."
        bullets={[
          "Add products with prices, brands and categories",
          "Stock goes down when you sell and up when orders arrive",
          "Low-stock warnings before you run out",
          "Sell products at checkout alongside services",
        ]}
        cta="Add your first product"
        onStart={() => setEditing("new")}
      />
    );
  }

  const exportCsv = () => {
    const rows = [
      ["Product", "Brand", "Category", "SKU", "Barcode", "Retail price", "Supply price", "Stock"],
      ...list.map((p) => [
        p.name,
        brandName(p.brand_id),
        categoryName(p.category_id),
        p.sku ?? "",
        p.barcode ?? "",
        String(p.retail_price),
        p.supply_price === null ? "" : String(p.supply_price),
        p.track_stock ? String(p.stock_quantity) : "",
      ]),
    ];
    const csv =
      "﻿" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const lowCount = (products.data ?? []).filter(
    (p) => !p.is_archived && ["low", "out"].includes(stockState(p)),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-display font-semibold">
            Products
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-body font-semibold text-muted-foreground">
              {(products.data ?? []).filter((p) => !p.is_archived).length}
            </span>
          </h1>
          <p className="mt-1 text-body text-muted-foreground">
            Products you sell or use, with their stock levels.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
            >
              Options <CaretDown size={16} weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl p-2">
              <DropdownMenuItem className={menuItem} onSelect={exportCsv}>
                Download CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Add
          </button>
        </div>
      </div>

      {lowCount > 0 ? (
        <button
          type="button"
          onClick={() => setLowOnly(true)}
          className="w-full rounded-xl bg-[#fff1e6] px-5 py-3 text-left text-body text-[#9a4b00]"
        >
          {lowCount} product{lowCount === 1 ? " is" : "s are"} low or out of stock.{" "}
          <span className="font-semibold underline">Show them</span>
        </button>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-toolbar p-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search by name, SKU or barcode"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-full border border-input bg-card px-4 text-body font-medium"
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <ChipButton active={lowOnly} onClick={() => setLowOnly(!lowOnly)}>
          Low stock
        </ChipButton>
        <ChipButton active={showArchived} onClick={() => setShowArchived(!showArchived)}>
          Show archived
        </ChipButton>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th className="px-4">Product</th>
              <th className="px-4">Category</th>
              <th className="px-4">Stock</th>
              <th className="px-4 text-right">Retail price</th>
              <th className="w-12 px-4" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="cursor-pointer" onClick={() => setEditing(p)}>
                <td className="px-4">
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                      <Package size={20} />
                    </span>
                    <span>
                      <span
                        className={cn(
                          "block font-semibold",
                          p.is_archived && "text-muted-foreground",
                        )}
                      >
                        {p.name}
                      </span>
                      <span className="block text-caption text-muted-foreground">
                        {[brandName(p.brand_id), p.sku].filter(Boolean).join(" · ")}
                        {p.is_archived ? " · Archived" : ""}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-4 text-muted-foreground">{categoryName(p.category_id) || "—"}</td>
                <td className="px-4">
                  <StockBadge product={p} />
                </td>
                <td className="px-4 text-right tabular-nums">{money(Number(p.retail_price))}</td>
                <td className="px-4" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${p.name}`}
                      className="flex size-9 items-center justify-center rounded-full hover:bg-secondary"
                    >
                      <DotsThreeVertical size={20} weight="bold" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-xl p-2">
                      <DropdownMenuItem className={menuItem} onSelect={() => setEditing(p)}>
                        Edit
                      </DropdownMenuItem>
                      {p.track_stock ? (
                        <DropdownMenuItem className={menuItem} onSelect={() => setAdjusting(p)}>
                          Adjust stock
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem className={menuItem} onSelect={() => setHistory(p)}>
                        Stock history
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuItem
                        className={menuItem}
                        onSelect={() => setConfirm({ kind: "archive", product: p })}
                      >
                        {p.is_archived ? "Unarchive" : "Archive"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className={cn(menuItem, "text-destructive focus:text-destructive")}
                        onSelect={() => setConfirm({ kind: "delete", product: p })}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  {products.isLoading ? "Loading products…" : "No products match."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ProductDialog product={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <AdjustStockDialog product={adjusting} onClose={() => setAdjusting(null)} onSaved={refresh} />
      <StockHistoryDialog product={history} onClose={() => setHistory(null)} />
      <ConfirmDialog
        open={confirm !== null}
        destructive={confirm?.kind === "delete"}
        busy={runConfirm.isPending}
        title={
          confirm?.kind === "delete"
            ? "Delete product"
            : confirm?.product.is_archived
              ? "Unarchive product"
              : "Archive product"
        }
        body={
          confirm?.kind === "delete"
            ? "Delete this product and its stock history? Products that have been sold can be archived instead."
            : confirm?.product.is_archived
              ? "It will be available to sell again."
              : "It won't be available to sell, but its history is kept."
        }
        confirmLabel={
          confirm?.kind === "delete"
            ? "Delete"
            : confirm?.product.is_archived
              ? "Unarchive"
              : "Archive"
        }
        onConfirm={() => runConfirm.mutate()}
        onClose={() => setConfirm(null)}
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

function NamedSelect({
  label,
  table,
  value,
  onChange,
}: {
  label: string;
  table: "product_brands" | "product_categories";
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const options = useNamed(table);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .insert({ business_id: business!.id, name: name.trim() })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: [table] });
      onChange(id);
      setAdding(false);
      setName("");
    },
    onError: (error: { code?: string; message: string }) =>
      toast.error(error.code === "23505" ? "That name already exists" : error.message),
  });
  return (
    <label className="block text-body font-semibold">
      {label}
      {adding ? (
        <span className="mt-2 flex gap-2">
          <input
            autoFocus
            value={name}
            maxLength={80}
            placeholder={`New ${label.toLowerCase()}`}
            onChange={(e) => setName(e.target.value)}
            className={cn(field, "mt-0")}
          />
          <button
            type="button"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
            className={cn(pillButton, "bg-ink text-ink-foreground")}
          >
            Add
          </button>
        </span>
      ) : (
        <select
          value={value}
          onChange={(e) =>
            e.target.value === "__new" ? setAdding(true) : onChange(e.target.value)
          }
          className={field}
        >
          <option value="">None</option>
          {(options.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="__new">+ New {label.toLowerCase()}</option>
        </select>
      )}
    </label>
  );
}

function ProductDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: business } = useBusiness();
  const suppliers = useNamed("suppliers");
  const isNew = product === "new";
  const empty = {
    name: "",
    brand_id: "",
    category_id: "",
    supplier_id: "",
    sku: "",
    barcode: "",
    description: "",
    retail_price: "",
    supply_price: "",
    track_stock: true,
    initial: "0",
    low: "",
  };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    if (product === "new") setForm(empty);
    else if (product)
      setForm({
        name: product.name,
        brand_id: product.brand_id ?? "",
        category_id: product.category_id ?? "",
        supplier_id: product.supplier_id ?? "",
        sku: product.sku ?? "",
        barcode: product.barcode ?? "",
        description: product.description ?? "",
        retail_price: String(product.retail_price),
        supply_price: product.supply_price === null ? "" : String(product.supply_price),
        track_stock: product.track_stock,
        initial: "0",
        low: product.low_stock_threshold === null ? "" : String(product.low_stock_threshold),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const valid =
    form.name.trim() &&
    num(form.retail_price) !== null &&
    Number(form.retail_price) >= 0 &&
    (form.supply_price === "" || Number(form.supply_price) >= 0) &&
    Number.isInteger(Number(form.initial || 0));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: business!.id,
        name: form.name.trim(),
        brand_id: form.brand_id || null,
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        description: form.description.trim() || null,
        retail_price: Number(form.retail_price),
        supply_price: num(form.supply_price),
        track_stock: form.track_stock,
        low_stock_threshold: form.track_stock ? num(form.low) : null,
      };
      if (isNew) {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        const initial = Number(form.initial || 0);
        if (form.track_stock && initial !== 0) {
          const { error: stockError } = await supabase
            .from("stock_movements")
            .insert({
              business_id: business!.id,
              product_id: data.id,
              change: initial,
              reason: "initial",
            });
          if (stockError) throw stockError;
        }
      } else if (product) {
        const { error } = await supabase
          .from("products")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", product.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isNew ? "Product added" : "Product saved");
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <ModalShell
      open={product !== null}
      wide
      title={isNew ? "Add product" : "Edit product"}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-body font-semibold sm:col-span-2">
          Product name <span className="text-destructive">*</span>
          <input
            value={form.name}
            maxLength={160}
            placeholder="e.g. Argan oil shampoo"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
          />
        </label>
        <NamedSelect
          label="Brand"
          table="product_brands"
          value={form.brand_id}
          onChange={(brand_id) => setForm({ ...form, brand_id })}
        />
        <NamedSelect
          label="Category"
          table="product_categories"
          value={form.category_id}
          onChange={(category_id) => setForm({ ...form, category_id })}
        />
        <label className="block text-body font-semibold">
          Retail price ({business?.currency}) <span className="text-destructive">*</span>
          <input
            inputMode="decimal"
            value={form.retail_price}
            onChange={(e) =>
              setForm({ ...form, retail_price: e.target.value.replace(/[^0-9.]/g, "") })
            }
            className={field}
          />
        </label>
        <label className="block text-body font-semibold">
          Supply price ({business?.currency}){" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            inputMode="decimal"
            value={form.supply_price}
            onChange={(e) =>
              setForm({ ...form, supply_price: e.target.value.replace(/[^0-9.]/g, "") })
            }
            className={field}
          />
        </label>
        <label className="block text-body font-semibold">
          SKU <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={form.sku}
            maxLength={40}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-body font-semibold">
          Barcode <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={form.barcode}
            maxLength={40}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-body font-semibold sm:col-span-2">
          Supplier <span className="font-normal text-muted-foreground">(optional)</span>
          <select
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            className={field}
          >
            <option value="">None</option>
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-body font-semibold sm:col-span-2">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-2 w-full resize-none rounded-[8px] border border-input p-4 text-body font-normal"
          />
        </label>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-secondary px-4 py-3 sm:col-span-2">
          <span>
            <span className="block text-body font-semibold">Track stock</span>
            <span className="block text-caption text-muted-foreground">
              Stock goes down when sold and up when orders are received.
            </span>
          </span>
          <Switch
            checked={form.track_stock}
            onCheckedChange={(track_stock) => setForm({ ...form, track_stock })}
          />
        </div>
        {form.track_stock ? (
          <>
            {isNew ? (
              <label className="block text-body font-semibold">
                Current stock
                <input
                  inputMode="numeric"
                  value={form.initial}
                  onChange={(e) =>
                    setForm({ ...form, initial: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  className={field}
                />
              </label>
            ) : (
              <p className="self-end pb-3 text-body text-muted-foreground">
                In stock:{" "}
                <span className="font-semibold text-foreground">
                  {product && typeof product === "object" ? product.stock_quantity : 0}
                </span>
                . Use “Adjust stock” to change it.
              </p>
            )}
            <label className="block text-body font-semibold">
              Low stock warning at{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
              <input
                inputMode="numeric"
                value={form.low}
                placeholder="e.g. 3"
                onChange={(e) => setForm({ ...form, low: e.target.value.replace(/[^0-9]/g, "") })}
                className={field}
              />
            </label>
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}

const ADJUST_REASONS = [
  { value: "adjustment", label: "Stock count correction" },
  { value: "damaged", label: "Damaged or expired" },
  { value: "internal_use", label: "Used in the salon" },
];

function AdjustStockDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: business } = useBusiness();
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("adjustment");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (product) {
      setDirection("add");
      setQty("1");
      setReason("adjustment");
      setNote("");
    }
  }, [product]);
  const change = (direction === "add" ? 1 : -1) * Number(qty || 0);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stock_movements").insert({
        business_id: business!.id,
        product_id: product!.id,
        change,
        reason: direction === "add" && reason !== "adjustment" ? "adjustment" : reason,
        note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <ModalShell
      open={product !== null}
      title={`Adjust stock${product ? `: ${product.name}` : ""}`}
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
            disabled={!change || save.isPending}
            onClick={() => save.mutate()}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["add", "remove"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={cn(
                "h-11 rounded-[8px] text-body font-medium",
                direction === d
                  ? "bg-ink text-ink-foreground"
                  : "border border-input hover:bg-secondary",
              )}
            >
              {d === "add" ? "Add stock" : "Remove stock"}
            </button>
          ))}
        </div>
        <label className="block text-body font-semibold">
          Quantity
          <input
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
            className={field}
          />
        </label>
        {direction === "remove" ? (
          <label className="block text-body font-semibold">
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
              {ADJUST_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block text-body font-semibold">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            className={field}
          />
        </label>
        {product ? (
          <p className="text-body text-muted-foreground">
            {product.stock_quantity} in stock →{" "}
            <span className="font-semibold text-foreground">{product.stock_quantity + change}</span>{" "}
            after saving
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}

const REASON_LABELS: Record<string, string> = {
  initial: "Opening stock",
  adjustment: "Adjustment",
  sale: "Sold",
  refund: "Refunded",
  stock_order: "Stock order received",
  stocktake: "Stocktake",
  damaged: "Damaged or expired",
  internal_use: "Used in the salon",
};

function StockHistoryDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const history = useQuery({
    queryKey: ["stock-history", product?.id],
    enabled: Boolean(product),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, change, reason, note, created_at")
        .eq("product_id", product!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <ModalShell
      open={product !== null}
      wide
      title={`Stock history${product ? `: ${product.name}` : ""}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
        >
          Close
        </button>
      }
    >
      <ul className="divide-y divide-border rounded-xl shadow-[inset_0_0_0_1px_var(--color-border)]">
        {(history.data ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-4 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium">
                {REASON_LABELS[m.reason] ?? m.reason}
              </span>
              <span className="block text-caption text-muted-foreground">
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(m.created_at))}
                {m.note ? ` · ${m.note}` : ""}
              </span>
            </span>
            <span
              className={cn(
                "text-body font-semibold tabular-nums",
                m.change > 0 ? "text-[#1f8a3e]" : "text-destructive",
              )}
            >
              {m.change > 0 ? `+${m.change}` : m.change}
            </span>
          </li>
        ))}
        {history.data && history.data.length === 0 ? (
          <li className="px-4 py-8 text-center text-body text-muted-foreground">
            No stock changes yet.
          </li>
        ) : null}
      </ul>
    </ModalShell>
  );
}
