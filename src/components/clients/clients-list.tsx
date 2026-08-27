import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  DotsThreeVertical,
  FadersHorizontal,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { businessLocale, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type Client = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_color: string;
  created_at: string;
};

const PAGE_SIZE = 20;

const soon = (label: string) => toast(`${label} — coming soon`);

const fullName = (client: Client) =>
  [client.first_name, client.last_name].filter(Boolean).join(" ").trim();

const initials = (client: Client) =>
  [client.first_name?.[0], client.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

export function ClientsList() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [bannerOpen, setBannerOpen] = useState(true);

  const clientsQuery = useQuery({
    queryKey: ["clients", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, avatar_color, created_at")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", businessId] });
      toast.success("Client deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clients = clientsQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = term
      ? clients.filter((client) =>
          [fullName(client), client.email ?? "", client.phone ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : clients;
    return [...rows].sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDesc ? -diff : diff;
    });
  }, [clients, search, sortDesc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const allSelected = pageRows.length > 0 && pageRows.every((row) => selected.includes(row.id));
  const toggleAll = () =>
    setSelected(allSelected ? [] : pageRows.map((row) => row.id));
  const toggleRow = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const dateFormatter = new Intl.DateTimeFormat(businessLocale(business?.country), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const salesLabel = business ? formatMoney(0, business.currency, business.country) : "—";

  const from = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Clients list</h2>
            <span className="rounded-full border border-border bg-white px-3 py-1 text-sm font-semibold text-foreground">
              {clients.length}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            View, add, edit and delete your client&apos;s details.{" "}
            <a href="#" className="font-semibold text-primary hover:underline">
              Learn more
            </a>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-12 gap-2 rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground hover:bg-white hover:text-foreground"
              >
                Options
                <CaretDown size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-3">
              {["Import clients", "Export clients", "Merge duplicates", "Settings"].map((label) => (
                <DropdownMenuItem
                  key={label}
                  className="gap-3 px-4 py-2.5 text-sm font-medium text-foreground"
                  onClick={() => soon(label)}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="h-12 rounded-full px-8 text-base font-semibold"
            onClick={() => soon("Add client")}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Promo banner — brand accent, no gradient */}
      {bannerOpen && (
        <section className="relative overflow-hidden rounded-3xl bg-accent px-8 py-8 text-accent-foreground">
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setBannerOpen(false)}
            className="absolute right-5 top-5 rounded-full p-1.5 text-accent-foreground/70 transition-colors hover:bg-black/5 hover:text-accent-foreground"
          >
            <X size={18} weight="bold" />
          </button>
          <h3 className="max-w-2xl text-2xl font-bold tracking-tight">
            Attract new clients with online bookings
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-accent-foreground/80">
            Let clients discover your business and book themselves in, 24/7.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <Button
              className="h-11 rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:bg-foreground/90"
              onClick={() => soon("Online booking")}
            >
              Start now
            </Button>
            <button
              type="button"
              className="text-sm font-semibold underline-offset-4 hover:underline"
              onClick={() => soon("Online booking")}
            >
              Learn more
            </button>
          </div>
        </section>
      )}

      {/* Search / filter row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-muted/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <MagnifyingGlass
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Name, email or phone"
              className="h-12 w-[320px] rounded-full border-border bg-white pl-11 text-sm"
            />
          </div>
          <Button
            variant="outline"
            className="h-12 gap-2 rounded-full border-border bg-white px-6 text-sm font-semibold text-foreground hover:bg-white"
            onClick={() => soon("Filters")}
          >
            <FadersHorizontal size={18} />
            Filters
          </Button>
        </div>

        <Button
          variant="outline"
          className="h-12 gap-2 rounded-full border-border bg-white px-6 text-sm font-semibold text-foreground hover:bg-white"
          onClick={() => setSortDesc((prev) => !prev)}
        >
          Created at ({sortDesc ? "newest first" : "oldest first"})
          {sortDesc ? <ArrowDown size={16} weight="bold" /> : <ArrowUp size={16} weight="bold" />}
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-white px-5 py-3 text-sm">
          <span className="font-semibold text-foreground">{selected.length} selected</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 rounded-full px-4 text-sm font-semibold"
              onClick={() => soon("Bulk actions")}
            >
              Bulk actions
            </Button>
            <Button
              variant="ghost"
              className="h-9 rounded-full px-4 text-sm font-semibold"
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="w-12 px-4 py-4">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all clients"
                />
              </th>
              <th className="px-4 py-4 text-base font-bold text-foreground">Client name</th>
              <th className="px-4 py-4 text-base font-bold text-foreground">Mobile number</th>
              <th className="px-4 py-4 text-base font-bold text-foreground">Reviews</th>
              <th className="px-4 py-4 text-base font-bold text-foreground">Sales</th>
              <th className="px-4 py-4">
                <button
                  type="button"
                  className="flex items-center gap-2 text-base font-bold text-foreground"
                  onClick={() => setSortDesc((prev) => !prev)}
                >
                  Created at
                  {sortDesc ? (
                    <ArrowDown size={16} weight="bold" />
                  ) : (
                    <ArrowUp size={16} weight="bold" />
                  )}
                </button>
              </th>
              <th className="w-12 px-4 py-4" />
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  {clientsQuery.isLoading ? "Loading clients…" : "No clients yet."}
                </td>
              </tr>
            )}

            {pageRows.map((client) => (
              <tr
                key={client.id}
                className={cn(
                  "cursor-pointer border-b border-border transition-colors hover:bg-muted/50",
                  selected.includes(client.id) && "bg-muted/40",
                )}
                onClick={() => soon("Client profile")}
              >
                <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selected.includes(client.id)}
                    onCheckedChange={() => toggleRow(client.id)}
                    aria-label={`Select ${fullName(client)}`}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-4">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-foreground"
                      style={{ backgroundColor: client.avatar_color }}
                    >
                      {initials(client)}
                    </span>
                    <span>
                      <span className="block font-semibold text-foreground">
                        {fullName(client)}
                      </span>
                      {client.email && (
                        <span className="block text-sm text-muted-foreground">{client.email}</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">{client.phone || "–"}</td>
                <td className="px-4 py-4 text-muted-foreground">–</td>
                <td className="px-4 py-4 text-foreground">{salesLabel}</td>
                <td className="px-4 py-4 text-foreground">
                  {dateFormatter.format(new Date(client.created_at))}
                </td>
                <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        aria-label="Client actions"
                      >
                        <DotsThreeVertical size={18} weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 p-2">
                      <DropdownMenuItem
                        className="px-3 py-2 text-sm font-medium"
                        onClick={() => soon("Edit client")}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="px-3 py-2 text-sm font-medium text-destructive focus:text-destructive"
                        onClick={() => deleteClient.mutate(client.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-center gap-4 pb-4 text-sm text-muted-foreground">
        <span>
          Viewing <span className="font-semibold text-foreground">{from}</span>–
          <span className="font-semibold text-foreground">{to}</span> of{" "}
          <span className="font-semibold text-foreground">{filtered.length}</span> results
        </span>
        {pageCount > 1 && (
          <span className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-full border-border bg-white px-4 text-sm font-semibold"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="font-semibold text-foreground">
              {currentPage + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              className="h-9 rounded-full border-border bg-white px-4 text-sm font-semibold"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}
