import { useEffect, useMemo, useState } from "react";
import {
  ArrowsDownUp,
  ArrowsMerge,
  CaretDown,
  Check,
  DotsThreeVertical,
  DownloadSimple,
  FileCsv,
  FileXls,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { ClientProfile } from "@/components/clients/client-profile";
import {
  ChipButton,
  FiltersChip,
  ListToolbar,
  SearchBox,
  pillButton,
} from "@/components/sales/list-ui";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { businessLocale, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import { csvCell } from "@/lib/csv";

type Client = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  gender: string | null;
  client_source: string;
  avatar_color: string;
  created_at: string;
};

type Sort = "created-desc" | "created-asc" | "name-asc" | "name-desc";
const SORT_LABELS: Record<Sort, string> = {
  "created-desc": "Created at (newest first)",
  "created-asc": "Created at (oldest first)",
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
};

const PAGE_SIZE = 20;
const BANNER_KEY = "bookly.clients.importBanner";

const fullName = (client: Pick<Client, "first_name" | "last_name">) =>
  [client.first_name, client.last_name].filter(Boolean).join(" ").trim();

function downloadCsv(rows: Client[], filename: string) {
  const lines = [
    ["First name", "Last name", "Email", "Phone", "Gender", "Client source", "Created at"].join(
      ",",
    ),
    ...rows.map((row) =>
      [
        row.first_name,
        row.last_name,
        row.email,
        [row.phone_country_code, row.phone].filter(Boolean).join(" "),
        row.gender,
        row.client_source,
        row.created_at.slice(0, 10),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ClientsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("created-desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ gender: "all", source: "all", tag: "all" });
  const [draft, setDraft] = useState(filters);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setBannerOpen(window.localStorage.getItem(BANNER_KEY) !== "hidden");
    } catch {
      // keep the banner
    }
  }, []);

  const clientsQuery = useQuery({
    queryKey: ["clients", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, first_name, last_name, email, phone, phone_country_code, gender, client_source, avatar_color, created_at",
        )
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const salesQuery = useQuery({
    queryKey: ["client-sales", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("client_id, total")
        .eq("business_id", businessId!)
        .eq("status", "completed");
      if (error) throw error;
      const totals = new Map<string, number>();
      for (const sale of data ?? []) {
        if (!sale.client_id) continue;
        totals.set(sale.client_id, (totals.get(sale.client_id) ?? 0) + Number(sale.total ?? 0));
      }
      return totals;
    },
  });

  const tagsQuery = useQuery({
    queryKey: ["client-tags-index", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const [tags, assignments] = await Promise.all([
        supabase
          .from("client_tags")
          .select("id, name")
          .eq("business_id", businessId!)
          .order("name"),
        supabase
          .from("client_tag_assignments")
          .select("client_id, tag_id")
          .eq("business_id", businessId!),
      ]);
      if (tags.error) throw tags.error;
      if (assignments.error) throw assignments.error;
      return { tags: tags.data ?? [], assignments: assignments.data ?? [] };
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
  const sources = [
    ...new Set(clients.map((client) => client.client_source).filter(Boolean)),
  ].sort();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const tagged =
      filters.tag === "all"
        ? null
        : new Set(
            (tagsQuery.data?.assignments ?? [])
              .filter((row) => row.tag_id === filters.tag)
              .map((row) => row.client_id),
          );
    const rows = clients
      .filter(
        (client) =>
          !term ||
          [fullName(client), client.email ?? "", client.phone ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(term),
      )
      .filter(
        (client) =>
          filters.gender === "all" || (client.gender ?? "").toLowerCase() === filters.gender,
      )
      .filter((client) => filters.source === "all" || client.client_source === filters.source)
      .filter((client) => !tagged || tagged.has(client.id));
    return [...rows].sort((a, b) => {
      if (sort === "name-asc") return fullName(a).localeCompare(fullName(b));
      if (sort === "name-desc") return fullName(b).localeCompare(fullName(a));
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === "created-desc" ? -diff : diff;
    });
  }, [clients, search, sort, filters, tagsQuery.data]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  const allSelected = pageRows.length > 0 && pageRows.every((row) => selected.includes(row.id));
  const filterCount = Object.values(filters).filter((value) => value !== "all").length;

  const dateFormatter = new Intl.DateTimeFormat(businessLocale(business?.country), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const salesLabel = (clientId: string) =>
    business
      ? formatMoney(salesQuery.data?.get(clientId) ?? 0, business.currency, business.country)
      : "—";
  const from = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-display font-semibold leading-9 text-foreground">
              Clients list
            </h2>
            <span className="rounded-full bg-secondary px-2 text-caption font-semibold text-muted-foreground">
              {clients.length}
            </span>
          </div>
          <p className="mt-1 text-body text-muted-foreground">
            View, add, edit and delete your client&apos;s details.{" "}
            <span className="cursor-pointer text-primary hover:underline">
              Learn more
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  pillButton,
                  "border border-input bg-card hover:bg-secondary data-[state=open]:bg-secondary",
                )}
              >
                Options <CaretDown size={13} weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
              <DropdownMenuItem
                onSelect={() =>
                  toast("Client import (CSV/Excel upload) is coming in a later update")
                }
                className="gap-3 rounded-lg px-3 py-2 text-body"
              >
                <UploadSimple size={18} /> Import clients
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => toast("Merging duplicate profiles is coming in a later update")}
                className="gap-3 rounded-lg px-3 py-2 text-body"
              >
                <ArrowsMerge size={18} /> Merge clients
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-3 py-1.5 text-body font-semibold">
                Export
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => toast("Excel export arrives with Reports, CSV works now")}
                className="gap-3 rounded-lg px-3 py-2 text-body"
              >
                <FileXls size={18} /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  downloadCsv(filtered, `clients-${new Date().toISOString().slice(0, 10)}.csv`);
                  toast.success(
                    `Exported ${filtered.length} client${filtered.length === 1 ? "" : "s"}`,
                  );
                }}
                className="gap-3 rounded-lg px-3 py-2 text-body"
              >
                <FileCsv size={18} /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => navigate({ to: "/client/new" })}
            className={cn(pillButton, "bg-ink px-6 text-ink-foreground hover:bg-ink/90")}
          >
            Add
          </button>
        </div>
      </div>

      {/* Import banner, like Fresha */}
      {bannerOpen ? (
        <section className="relative overflow-hidden rounded-2xl bg-[#111] px-6 py-6 text-white">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-gradient-to-r from-transparent via-[#6b2bd9]/70 to-[#c13bd6]" />
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setBannerOpen(false);
              try {
                window.localStorage.setItem(BANNER_KEY, "hidden");
              } catch {
                // fine
              }
            }}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 hover:bg-white/10"
          >
            <X size={16} weight="bold" />
          </button>
          <div className="relative max-w-sm">
            <h3 className="text-xl font-semibold">Import your client list</h3>
            <p className="mt-1 text-body text-white/80">
              Takes a few minutes and brings your existing clients&apos; details, history and notes
              into Bookly
            </p>
            <div className="mt-4 flex items-center gap-5">
              <button
                type="button"
                onClick={() =>
                  toast("Client import (CSV/Excel upload) is coming in a later update")
                }
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-body font-medium text-[#0d0d0d]"
              >
                <DownloadSimple size={16} /> Start import
              </button>
              <span className="cursor-pointer text-body font-medium hover:underline">
                Learn more
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <ListToolbar
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ChipButton>
                {SORT_LABELS[sort]} <ArrowsDownUp size={16} />
              </ChipButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
              {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => setSort(key)}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  <span className="flex-1">{SORT_LABELS[key]}</span>
                  {sort === key ? <Check size={14} weight="bold" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          placeholder="Name, email or phone"
        />
        <FiltersChip
          count={filterCount}
          onClick={() => {
            setDraft(filters);
            setFiltersOpen(true);
          }}
        />
      </ListToolbar>

      {selected.length > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-3 text-body">
          <span className="font-semibold">{selected.length} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                downloadCsv(
                  clients.filter((client) => selected.includes(client.id)),
                  "selected-clients.csv",
                );
              }}
              className="h-9 rounded-full px-4 font-semibold hover:bg-secondary"
            >
              Export selected
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="h-9 rounded-full px-4 font-semibold hover:bg-secondary"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table min-w-[52rem] whitespace-nowrap">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="w-12 px-4 py-4">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() =>
                    setSelected(allSelected ? [] : pageRows.map((row) => row.id))
                  }
                  aria-label="Select all clients"
                />
              </th>
              {["Client name", "Mobile number", "Reviews", "Sales", "Created at"].map((label) => (
                <th
                  key={label}
                  className="px-4 py-4"
                >
                  {label}
                </th>
              ))}
              <th className="w-12 px-4 py-4" />
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-16 text-center text-body text-muted-foreground"
                >
                  {clientsQuery.isLoading
                    ? "Loading clients…"
                    : clients.length
                      ? "No clients match your search."
                      : "No clients yet."}
                </td>
              </tr>
            ) : null}
            {pageRows.map((client) => (
              <tr
                key={client.id}
                className={cn(
                  "cursor-pointer border-b border-border transition-colors hover:bg-secondary/50",
                  selected.includes(client.id) && "bg-secondary/40",
                )}
                onClick={() => setProfileId(client.id)}
              >
                <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selected.includes(client.id)}
                    onCheckedChange={() =>
                      setSelected((prev) =>
                        prev.includes(client.id)
                          ? prev.filter((id) => id !== client.id)
                          : [...prev, client.id],
                      )
                    }
                    aria-label={`Select ${fullName(client)}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    <span className="flex size-14 items-center justify-center rounded-full bg-accent text-heading font-semibold text-primary">
                      {client.first_name[0]?.toUpperCase()}
                    </span>
                    <span>
                      <span className="block text-body font-medium text-foreground">
                        {fullName(client)}
                      </span>
                      {client.email ? (
                        <span className="block text-body text-muted-foreground">
                          {client.email}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {client.phone
                    ? [client.phone_country_code, client.phone].filter(Boolean).join(" ")
                    : "-"}
                </td>
                <td className="px-4 py-4">-</td>
                <td className="px-4 py-4">{salesLabel(client.id)}</td>
                <td className="px-4 py-4">{dateFormatter.format(new Date(client.created_at))}</td>
                <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Client actions"
                        className="flex size-9 items-center justify-center rounded-full hover:bg-secondary"
                      >
                        <DotsThreeVertical size={18} weight="bold" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                      <DropdownMenuItem
                        onSelect={() => setProfileId(client.id)}
                        className="rounded-lg px-3 py-2 text-body"
                      >
                        View profile
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          navigate({ to: "/client/$clientId", params: { clientId: client.id } })
                        }
                        className="rounded-lg px-3 py-2 text-body"
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => deleteClient.mutate(client.id)}
                        className="rounded-lg px-3 py-2 text-body text-destructive focus:text-destructive"
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

      <div className="flex flex-wrap items-center justify-center gap-4 pb-4 text-body text-muted-foreground">
        <span>
          Viewing{" "}
          <span className="font-semibold">
            {from} - {to}
          </span>{" "}
          of <span className="font-semibold">{filtered.length}</span> results
        </span>
        {pageCount > 1 ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className="h-9 rounded-full border border-border px-4 font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-semibold text-foreground">
              {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
              className="h-9 rounded-full border border-border px-4 font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </span>
        ) : null}
      </div>

      {/* All filters drawer */}
      {filtersOpen ? (
        <div className="fixed inset-y-0 right-0 z-50 flex animate-in slide-in-from-right-8 duration-200">
          <div className="pr-4 pt-4">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setFiltersOpen(false)}
              className="flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex h-full w-[30rem] max-w-[calc(100vw-4rem)] flex-col border-l border-border bg-card shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.2)]">
            <h2 className="px-6 pb-4 pt-6 text-display font-semibold">All filters</h2>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6">
              {[
                {
                  key: "gender" as const,
                  label: "Gender",
                  options: [
                    { value: "all", label: "All genders" },
                    { value: "female", label: "Female" },
                    { value: "male", label: "Male" },
                    { value: "non-binary", label: "Non-binary" },
                    { value: "prefer not to say", label: "Prefer not to say" },
                  ],
                },
                {
                  key: "source" as const,
                  label: "Client source",
                  options: [
                    { value: "all", label: "All sources" },
                    ...sources.map((source) => ({
                      value: source,
                      label: source.replace(/_/g, " "),
                    })),
                  ],
                },
                {
                  key: "tag" as const,
                  label: "Client tag",
                  options: [
                    { value: "all", label: "All tags" },
                    ...(tagsQuery.data?.tags ?? []).map((tag) => ({
                      value: tag.id,
                      label: tag.name,
                    })),
                  ],
                },
              ].map((group) => (
                <label key={group.key} className="block text-body font-semibold">
                  {group.label}
                  <select
                    value={draft[group.key]}
                    onChange={(event) => setDraft({ ...draft, [group.key]: event.target.value })}
                    className="mt-2 h-12 w-full rounded-lg border border-border bg-card px-4 text-body font-normal capitalize"
                  >
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <p className="text-caption text-muted-foreground">
                Segment, group and blocked-client filters arrive with Client segments and Records.
              </p>
            </div>
            <div className="flex gap-3 border-t border-border px-6 py-5">
              <button
                type="button"
                onClick={() => setDraft({ gender: "all", source: "all", tag: "all" })}
                className={cn(pillButton, "h-12 flex-1 border border-input hover:bg-secondary")}
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draft);
                  setFiltersOpen(false);
                  setPage(0);
                }}
                className={cn(pillButton, "h-12 flex-1 bg-ink text-ink-foreground hover:bg-ink/90")}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ClientProfile clientId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}
