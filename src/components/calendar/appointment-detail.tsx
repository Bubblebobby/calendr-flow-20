import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatCircle, Minus, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { CurrentBusiness } from "@/lib/use-business";
import { formatDuration, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const APPOINTMENT_STAGES = [
  "booked",
  "confirmed",
  "arrived",
  "started",
  "completed",
] as const;

export type AppointmentStatus =
  | (typeof APPOINTMENT_STAGES)[number]
  | "no_show"
  | "cancelled";

/** Four-kind feedback mapping used for every status indicator. */
export function statusTone(status: string) {
  switch (status) {
    case "booked":
    case "confirmed":
      return { label: status === "booked" ? "Booked" : "Confirmed", dot: "bg-primary/60" };
    case "arrived":
    case "started":
      return { label: status === "arrived" ? "Arrived" : "In progress", dot: "bg-accent" };
    case "completed":
      return { label: "Completed", dot: "bg-primary" };
    case "no_show":
      return { label: "No-show", dot: "bg-muted-foreground" };
    default:
      return { label: "Cancelled", dot: "bg-destructive" };
  }
}

/** Valid forward moves. Staff can skip ahead; no-show/cancelled always escape. */
function nextStages(status: string): AppointmentStatus[] {
  const index = APPOINTMENT_STAGES.indexOf(status as (typeof APPOINTMENT_STAGES)[number]);
  if (index < 0) return [];
  return APPOINTMENT_STAGES.slice(index + 1);
}

type DetailItem = {
  id: string;
  start_time: string;
  end_time: string;
  price: number | null;
  team_member_id: string;
  services: { name: string } | null;
  team_members: { first_name: string; last_name: string | null } | null;
};

type DetailRow = {
  id: string;
  status: string;
  notes: string | null;
  is_walk_in: boolean;
  client_id: string | null;
  clients: { first_name: string; last_name: string | null; email: string | null } | null;
  appointment_items: DetailItem[];
};

export function AppointmentDetail({
  appointmentId,
  business,
  onClose,
  onMinimize,
}: {
  appointmentId: string | null;
  business: CurrentBusiness | null | undefined;
  onClose: () => void;
  onMinimize: () => void;
}) {
  const queryClient = useQueryClient();
  const locale = typeof navigator !== "undefined" ? navigator.language : "en";
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment-detail", appointmentId],
    enabled: Boolean(appointmentId),
    queryFn: async (): Promise<DetailRow> => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, status, notes, is_walk_in, client_id, clients(first_name, last_name, email), appointment_items(id, start_time, end_time, price, team_member_id, services(name), team_members(first_name, last_name))",
        )
        .eq("id", appointmentId!)
        .single();
      if (error) throw error;
      return data as unknown as DetailRow;
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["appointment-detail", appointmentId] });
  }

  const updateStatus = useMutation({
    mutationFn: async (status: AppointmentStatus) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", appointmentId!);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      refresh();
      toast.success(`Appointment marked as ${statusTone(status).label.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error((error as { message?: string }).message ?? "Could not update the status"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error: itemsError } = await supabase
        .from("appointment_items")
        .delete()
        .eq("appointment_id", appointmentId!);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from("appointments").delete().eq("id", appointmentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      toast.success("Appointment deleted");
      setConfirmDelete(false);
      onClose();
    },
    onError: (error: unknown) =>
      toast.error((error as { message?: string }).message ?? "Could not delete the appointment"),
  });

  const items = [...(appointment?.appointment_items ?? [])].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );
  const first = items[0];
  const last = items[items.length - 1];
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const clientName = appointment
    ? appointment.is_walk_in || !appointment.clients
      ? "Walk-in"
      : [appointment.clients.first_name, appointment.clients.last_name].filter(Boolean).join(" ")
    : "";
  const tone = statusTone(appointment?.status ?? "booked");
  const forward = nextStages(appointment?.status ?? "");
  const terminal = ["completed", "cancelled", "no_show"].includes(appointment?.status ?? "");
  const total = items.reduce((sum, item) => sum + Number(item.price ?? 0), 0);

  return (
    <Dialog open={appointmentId !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        overlayClassName="bg-foreground/10"
        className="inset-y-0 left-auto right-0 top-0 h-svh w-full max-w-[520px] translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 border-l border-border bg-card p-0 shadow-2xl sm:max-w-[520px] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Appointment details</DialogTitle>
        <DialogDescription className="sr-only">
          Review this booking, move it through its stages or remove it.
        </DialogDescription>

        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
            <h2 className="text-lg font-semibold text-foreground">Appointment</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Minimize appointment" onClick={onMinimize}>
                <Minus size={18} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Close appointment" onClick={onClose}>
                <X size={18} />
              </Button>
            </div>
          </div>

          {isLoading || !appointment ? (
            <p className="p-6 text-sm text-muted-foreground">Loading appointment…</p>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${tone.dot}`} aria-hidden />
                  <span className="text-sm font-medium text-foreground">{tone.label}</span>
                </div>

                <div className="mt-4">
                  <p className="text-xl font-semibold text-foreground">{clientName}</p>
                  {appointment.clients?.email ? (
                    <p className="text-sm text-muted-foreground">{appointment.clients.email}</p>
                  ) : null}
                  {appointment.client_id ? (
                    <Button asChild variant="link" className="h-auto px-0">
                      <Link to="/client/$clientId" params={{ clientId: appointment.client_id }}>
                        View client profile
                      </Link>
                    </Button>
                  ) : null}
                </div>

                {first && last ? (
                  <p className="mt-4 text-sm text-foreground">
                    {dateFmt.format(new Date(first.start_time))}
                    <span className="mx-1 text-muted-foreground">·</span>
                    {timeFmt.format(new Date(first.start_time))} – {timeFmt.format(new Date(last.end_time))}
                  </p>
                ) : null}

                <section className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Services</h3>
                  <ul className="divide-y divide-border border-y border-border">
                    {items.map((item) => {
                      const minutes = Math.round(
                        (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) /
                          60000,
                      );
                      return (
                        <li key={item.id} className="flex items-start gap-3 py-3">
                          <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                            {timeFmt.format(new Date(item.start_time))}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {item.services?.name ?? "Service"}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[item.team_members?.first_name, item.team_members?.last_name]
                                .filter(Boolean)
                                .join(" ")}{" "}
                              · {formatDuration(minutes)}
                            </span>
                          </span>
                          {item.price !== null && business ? (
                            <span className="shrink-0 text-sm tabular-nums text-foreground">
                              {formatMoney(Number(item.price), business.currency, business.country)}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {business ? (
                    <p className="mt-3 text-right text-sm font-semibold text-foreground">
                      {formatMoney(total, business.currency, business.country)}
                    </p>
                  ) : null}
                </section>

                {appointment.notes ? (
                  <section className="mt-5">
                    <h3 className="mb-1 text-sm font-semibold text-foreground">Notes</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {appointment.notes}
                    </p>
                  </section>
                ) : null}

                <section className="mt-6">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Update status</h3>
                  {terminal ? (
                    <p className="text-sm text-muted-foreground">
                      This appointment has reached a final status.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {forward.map((stage) => (
                        <Button
                          key={stage}
                          variant={stage === forward[0] ? "default" : "outline"}
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate(stage)}
                        >
                          Mark {statusTone(stage).label.toLowerCase()}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate("no_show")}
                      >
                        No-show
                      </Button>
                      <Button
                        variant="outline"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate("cancelled")}
                      >
                        Cancel appointment
                      </Button>
                    </div>
                  )}
                </section>
              </div>

              <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-6 py-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    toast("Coming soon", { description: "Messaging arrives with the inbox." })
                  }
                >
                  <ChatCircle size={16} /> Message client
                </Button>
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash size={16} /> Delete
                </Button>
              </footer>
            </>
          )}
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
              <AlertDialogDescription>
                The booking and all of its services will be removed from the calendar. This cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  remove.mutate();
                }}
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
