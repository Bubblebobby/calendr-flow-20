import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, CaretRight, Plus, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatTime, memberName, minutesOfDay, startOfDay, type TeamMember } from "./calendar-data";

/**
 * Blocked time lives in `blocked_times`, which Bookly's database doesn't have yet.
 * Until it's created (see supabase/migrations) reads return nothing and saves
 * explain what's missing instead of failing silently.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type BlockedTime = {
  id: string;
  team_member_id: string;
  start_time: string;
  end_time: string;
  title: string | null;
  block_type: string;
  description: string | null;
};

export function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table|does not exist/i.test(error.message ?? "")
  );
}

export const MISSING_TABLE_MESSAGE =
  "This needs a database update first: see supabase/migrations";

export function useBlockedTimes(businessId: string | undefined, from: Date, to: Date) {
  return useQuery({
    queryKey: ["calendar-blocked-times", businessId, from.toISOString(), to.toISOString()],
    enabled: Boolean(businessId),
    retry: false,
    queryFn: async (): Promise<BlockedTime[]> => {
      const { data, error } = await db
        .from("blocked_times")
        .select("id, team_member_id, start_time, end_time, title, block_type, description")
        .eq("business_id", businessId)
        .gte("start_time", from.toISOString())
        .lt("start_time", to.toISOString());
      if (isMissingTable(error)) return [];
      if (error) throw error;
      return (data ?? []) as BlockedTime[];
    },
  });
}

const BLOCK_TYPES = [
  { id: "custom", emoji: "✏️", label: "Custom", detail: "New blocked time", minutes: null },
  { id: "lunch", emoji: "🥪", label: "Lunch", detail: "30 min • Unpaid", minutes: 30 },
  { id: "training", emoji: "📚", label: "Training", detail: "1 hr • Paid", minutes: 60 },
  { id: "meeting", emoji: "📆", label: "Meeting", detail: "1 hr • Paid", minutes: 60 },
] as const;

const TIMES = Array.from({ length: 288 }, (_, index) => index * 5);
const field =
  "h-12 w-full rounded-lg border border-border bg-card px-4 text-body outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export type BlockDraft = {
  member: TeamMember;
  date: Date;
  minutes: number;
  existing?: BlockedTime;
};

export function BlockedTimeDrawer({
  draft,
  businessId,
  team,
  currentUserId,
  onClose,
}: {
  draft: BlockDraft | null;
  businessId: string | undefined;
  team: TeamMember[];
  currentUserId: string | null | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<string>("custom");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(15);
  const [memberId, setMemberId] = useState("");
  const [frequency, setFrequency] = useState("none");
  const [description, setDescription] = useState("");
  const [onlineAllowed, setOnlineAllowed] = useState(false);
  const [typeOffset, setTypeOffset] = useState(0);

  useEffect(() => {
    if (!draft) return;
    const existing = draft.existing;
    const day = existing ? new Date(existing.start_time) : draft.date;
    setType(existing?.block_type ?? "custom");
    setTitle(existing?.title ?? "");
    setDate(
      `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
    );
    const startMinutes = existing ? minutesOfDay(new Date(existing.start_time)) : draft.minutes;
    setStart(startMinutes);
    setEnd(existing ? minutesOfDay(new Date(existing.end_time)) : startMinutes + 15);
    setMemberId(existing?.team_member_id ?? draft.member.id);
    setFrequency("none");
    setDescription(existing?.description ?? "");
    setOnlineAllowed(false);
  }, [draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId || !draft) throw new Error("Missing business");
      if (end <= start) throw new Error("End time must be after the start time");
      const [y, m, d] = date.split("-").map(Number);
      const day = new Date(y!, m! - 1, d!);
      const at = (minutes: number) => {
        const value = startOfDay(day);
        value.setMinutes(minutes);
        return value.toISOString();
      };
      const row = {
        business_id: businessId,
        team_member_id: memberId,
        start_time: at(start),
        end_time: at(end),
        title: title.trim() || null,
        block_type: type,
        description: description.trim() || null,
        online_booking_allowed: onlineAllowed,
        created_by: currentUserId ?? null,
      };
      const query = draft.existing
        ? db.from("blocked_times").update(row).eq("id", draft.existing.id)
        : db.from("blocked_times").insert(row);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-blocked-times"] });
      toast.success(draft?.existing ? "Blocked time updated" : "Blocked time added");
      onClose();
    },
    onError: (error: { code?: string; message?: string }) =>
      toast.error(
        isMissingTable(error) ? MISSING_TABLE_MESSAGE : (error.message ?? "Could not save"),
      ),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("blocked_times").delete().eq("id", draft!.existing!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-blocked-times"] });
      toast.success("Blocked time deleted");
      onClose();
    },
    onError: (error: { message?: string }) => toast.error(error.message ?? "Could not delete"),
  });

  if (!draft) return null;
  const duration = end - start;
  const visibleTypes = BLOCK_TYPES.slice(typeOffset, typeOffset + 2);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex animate-in slide-in-from-right-8 duration-200">
      <div className="pr-4 pt-4">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex h-full w-[30rem] flex-col border-l border-border bg-card shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.2)]">
        <div className="flex items-center justify-between px-6 pb-2 pt-6">
          <h2 className="text-display font-semibold">
            {draft.existing ? "Edit blocked time" : "Add blocked time"}
          </h2>
          {draft.existing ? (
            <button
              type="button"
              onClick={() => remove.mutate()}
              className="rounded-full px-3 py-1.5 text-body font-medium text-destructive hover:bg-destructive/5"
            >
              Delete
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div>
            <span className="mb-2 block text-body font-semibold">Block time type</span>
            <div className="flex items-center gap-3">
              {typeOffset > 0 ? (
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => setTypeOffset(0)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border"
                >
                  <CaretLeft size={16} />
                </button>
              ) : null}
              {visibleTypes.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setType(option.id);
                    if (option.minutes) setEnd(start + option.minutes);
                    if (option.id !== "custom" && !title) setTitle(option.label);
                  }}
                  className={cn(
                    "flex h-28 flex-1 flex-col items-center justify-center rounded-xl border text-center",
                    type === option.id
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <span className="text-xl">{option.emoji}</span>
                  <span className="mt-2 text-body font-semibold">{option.label}</span>
                  <span className="text-caption text-muted-foreground">{option.detail}</span>
                </button>
              ))}
              {typeOffset + 2 < BLOCK_TYPES.length ? (
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => setTypeOffset(2)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border"
                >
                  <CaretRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toast("Custom block types are managed in Settings → Scheduling")}
                  className="flex h-28 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border text-body font-medium hover:bg-secondary"
                >
                  <Plus size={18} />
                  New type
                </button>
              )}
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-body font-semibold">
              Title <span className="font-normal text-muted-foreground">(Optional)</span>
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Lunch meeting"
              className={field}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-body font-semibold">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={field}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="mb-2 block text-body font-semibold">Start time</span>
              <select
                value={start}
                onChange={(event) => setStart(Number(event.target.value))}
                className={field}
              >
                {TIMES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatTime(minutes)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-body font-semibold">End time</span>
              <select
                value={end}
                onChange={(event) => setEnd(Number(event.target.value))}
                className={field}
              >
                {TIMES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatTime(minutes)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-caption text-muted-foreground">
                {duration > 0
                  ? `${duration >= 60 ? `${Math.floor(duration / 60)} hr ` : ""}${duration % 60 ? `${duration % 60} min ` : ""}duration`
                  : "End must be after start"}
              </span>
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-body font-semibold">Team members</span>
            <select
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              className={field}
            >
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberName(member)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-body font-semibold">Frequency</span>
            <select
              value={frequency}
              onChange={(event) => {
                if (event.target.value !== "none")
                  toast("Repeating blocked time arrives with the next database update");
                setFrequency("none");
              }}
              className={field}
            >
              <option value="none">Doesn't repeat</option>
              <option value="day">Every day</option>
              <option value="week">Every week</option>
              <option value="month">Every month</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 flex justify-between text-body font-semibold">
              <span>
                Description <span className="font-normal text-muted-foreground">(Optional)</span>
              </span>
              <span className="font-normal text-muted-foreground">{description.length}/255</span>
            </span>
            <textarea
              value={description}
              maxLength={255}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add description or note"
              className="min-h-28 w-full rounded-lg border border-border p-4 text-body outline-none focus:border-primary"
            />
          </label>
          <label className="flex items-center gap-3 text-body">
            <input
              type="checkbox"
              checked={onlineAllowed}
              onChange={(event) => setOnlineAllowed(event.target.checked)}
              className="size-5 accent-[var(--color-primary)]"
            />
            Online booking allowed during blocked time
          </label>
        </div>
        <div className="border-t border-border px-6 py-5">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ink text-body font-semibold text-ink-foreground hover:bg-ink/90 disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BlockedTimeChip({ block, onClick }: { block: BlockedTime; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onMouseMove={(event) => event.stopPropagation()}
      className="flex h-full w-full flex-col justify-start overflow-hidden rounded-[4px] bg-[#c9c9cf] px-1.5 py-1 text-left text-caption leading-4 text-[#0d0d0d] hover:brightness-95"
    >
      <span className="block truncate">
        {formatTime(minutesOfDay(new Date(block.start_time)))} -{" "}
        {formatTime(minutesOfDay(new Date(block.end_time)))}{" "}
        <span className="font-semibold">{block.title || "Blocked time"}</span>
      </span>
    </button>
  );
}
