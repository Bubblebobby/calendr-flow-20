import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";
import {
  DAY_LABELS,
  DEFAULT_CLOSE,
  DEFAULT_OPEN,
  timeToMinutes,
  toInputTime,
  useBusinessHours,
  type BusinessHour,
} from "@/lib/business-hours";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export function BusinessHoursPanel() {
  const { data: business } = useBusiness();
  const { data: hours, isLoading } = useBusinessHours(business?.id);
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BusinessHour[]>([]);

  useEffect(() => {
    if (hours) setRows(hours);
  }, [hours]);

  const save = useMutation({
    mutationFn: async (next: BusinessHour[]) => {
      if (!business) throw new Error("No business found");
      const payload = next.map((row) => ({
        business_id: business.id,
        day_of_week: row.day_of_week,
        is_open: row.is_open,
        open_time: row.is_open ? row.open_time || DEFAULT_OPEN : null,
        close_time: row.is_open ? row.close_time || DEFAULT_CLOSE : null,
      }));
      const { error } = await supabase
        .from("business_hours")
        .upsert(payload, { onConflict: "business_id,day_of_week" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-hours", business?.id] });
      toast.success("Business hours saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function update(day: number, patch: Partial<BusinessHour>) {
    setRows((current) =>
      current.map((row) => (row.day_of_week === day ? { ...row, ...patch } : row)),
    );
  }

  const invalid = rows.some((row) => {
    if (!row.is_open) return false;
    const open = timeToMinutes(row.open_time);
    const close = timeToMinutes(row.close_time);
    return open === null || close === null || close <= open;
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {DAY_LABELS.map((day) => (
          <Skeleton key={day} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const open = timeToMinutes(row.open_time);
          const close = timeToMinutes(row.close_time);
          const rowInvalid =
            row.is_open && (open === null || close === null || close <= open);
          return (
            <li
              key={row.day_of_week}
              className="flex flex-wrap items-center gap-4 px-5 py-3.5"
            >
              <div className="flex min-w-44 items-center gap-3">
                <Switch
                  checked={row.is_open}
                  onCheckedChange={(checked) =>
                    update(row.day_of_week, {
                      is_open: checked,
                      open_time: row.open_time || DEFAULT_OPEN,
                      close_time: row.close_time || DEFAULT_CLOSE,
                    })
                  }
                  aria-label={`${DAY_LABELS[row.day_of_week]} open`}
                />
                <span className="text-body font-medium text-foreground">
                  {DAY_LABELS[row.day_of_week]}
                </span>
              </div>

              {row.is_open ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={toInputTime(row.open_time)}
                    onChange={(e) => update(row.day_of_week, { open_time: e.target.value })}
                    className="h-10 rounded-lg border border-input bg-background px-3 text-body text-foreground"
                    aria-label={`${DAY_LABELS[row.day_of_week]} opening time`}
                  />
                  <span className="text-body text-muted-foreground">to</span>
                  <input
                    type="time"
                    value={toInputTime(row.close_time)}
                    onChange={(e) => update(row.day_of_week, { close_time: e.target.value })}
                    className="h-10 rounded-lg border border-input bg-background px-3 text-body text-foreground"
                    aria-label={`${DAY_LABELS[row.day_of_week]} closing time`}
                  />
                  {rowInvalid ? (
                    <span className="text-caption font-medium text-destructive">
                      Closing time must be after opening time
                    </span>
                  ) : null}
                </div>
              ) : (
                <span className="text-body text-muted-foreground">Closed</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
        <Button
          onClick={() => save.mutate(rows)}
          disabled={invalid || save.isPending || !business}
        >
          {save.isPending ? "Saving…" : "Save hours"}
        </Button>
      </div>
    </div>
  );
}
