import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CaretDown, DotsThreeVertical } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchBox, pillButton } from "@/components/sales/list-ui";
import { deriveInitials, memberName } from "@/components/catalog/service-team-members";
import { InviteTeamMemberDialog, useTeamRoles } from "@/components/team/invite-team-member-dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { revokeTeamAccess, sendTeamInvite } from "@/lib/team-invites";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

export type InviteStatus = "not_invited" | "invited" | "active";

export type TeamMemberRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  initials: string | null;
  avatar_color: string;
  email: string | null;
  invite_status: InviteStatus;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  /** "admin" can see pay, timesheets and change deals/tax; set by the owner. */
  access_level?: string;
};

/** Status feedback: muted = neutral status, amber = pending/warning, green = completed. */
const STATUS_STYLES: Record<InviteStatus, { label: string; className: string }> = {
  not_invited: {
    label: "Not invited",
    className: "bg-muted text-muted-foreground border-border",
  },
  invited: {
    label: "Invited",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  },
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
};

function StatusBadge({ status }: { status: InviteStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.not_invited;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-caption font-semibold",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

export function TeamMembersList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"invite" | "edit">("invite");
  const [activeMember, setActiveMember] = useState<TeamMemberRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TeamMemberRow | null>(null);

  const rolesQuery = useTeamRoles(businessId);
  const roleNameById = useMemo(
    () => new Map((rolesQuery.data ?? []).map((role) => [role.id, role.name])),
    [rolesQuery.data],
  );

  const membersQuery = useQuery({
    queryKey: ["team-members", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<TeamMemberRow[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select(
          "id, first_name, last_name, initials, avatar_color, email, invite_status, role_id, is_active, created_at, access_level",
        )
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TeamMemberRow[];
    },
  });

  const members = membersQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) =>
      `${memberName(member)} ${member.email ?? ""}`.toLowerCase().includes(term),
    );
  }, [members, search]);

  const resendInvite = useMutation({
    mutationFn: async (member: TeamMemberRow) => sendTeamInvite(member.id),
    onSuccess: (result) =>
      toast.success("Invite sent", { description: `Sent again to ${result.email}.` }),
    onError: (error: Error) =>
      toast.error("Couldn't resend the invite", { description: error.message }),
  });

  const inviteNow = useMutation({
    mutationFn: async (member: TeamMemberRow) => sendTeamInvite(member.id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["team-members", businessId] });
      toast.success("Invite sent", { description: `Sent to ${result.email}.` });
    },
    onError: (error: Error) =>
      toast.error("Couldn't send the invite", { description: error.message }),
  });

  const revokeAccess = useMutation({
    mutationFn: async (member: TeamMemberRow) => revokeTeamAccess(member.id),
    onSuccess: (_data, member) => {
      // Reflect the change immediately, no refetch round trip.
      queryClient.setQueryData<TeamMemberRow[]>(["team-members", businessId], (rows) =>
        (rows ?? []).map((row) =>
          row.id === member.id ? { ...row, invite_status: "not_invited" as const } : row,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["team-members", businessId] });
      setRevokeTarget(null);
      toast.success("Access revoked");
    },
    onError: (error: Error) =>
      toast.error("Couldn't revoke access", { description: error.message }),
  });

  const setAccessLevel = useMutation({
    mutationFn: async ({ member, level }: { member: TeamMemberRow; level: "admin" | "staff" }) => {
      const { error } = await supabase
        .from("team_members")
        .update({ access_level: level })
        .eq("id", member.id);
      if (error) throw error;
    },
    onSuccess: (_data, { member, level }) => {
      queryClient.invalidateQueries({ queryKey: ["team-members", businessId] });
      toast.success(
        level === "admin"
          ? `${member.first_name} is now an admin`
          : `${member.first_name} no longer has admin access`,
      );
    },
    onError: () => toast.error("Couldn't change access"),
  });

  const openInvite = (member: TeamMemberRow | null) => {
    if (member?.email) {
      inviteNow.mutate(member);
      return;
    }
    setActiveMember(member);
    setDialogMode("invite");
    setDialogOpen(true);
  };

  const openEdit = (member: TeamMemberRow) => {
    setActiveMember(member);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="flex items-center gap-3 text-display font-semibold">
          Team members
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-body font-semibold text-muted-foreground">
            {members.length}
          </span>
        </h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
            >
              Options <CaretDown size={16} weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
              <DropdownMenuItem
                className="h-10 rounded-[8px] px-3 text-body font-medium"
                onSelect={() => navigate({ to: "/team", search: { tab: "shifts" } })}
              >
                Scheduled shifts
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuLabel className="px-3 text-caption font-semibold text-muted-foreground">
                Export
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="h-10 rounded-[8px] px-3 text-body font-medium"
                onSelect={() => exportCsv(members, roleNameById)}
              >
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
            onClick={() => navigate({ to: "/team/new" })}
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-toolbar p-4">
        <SearchBox value={search} onChange={setSearch} placeholder="Search team members" />
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[820px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-4 text-foreground">Name</th>
              <th className="px-4 py-4 text-foreground">Email</th>
              <th className="px-4 py-4 text-foreground">Permission role</th>
              <th className="px-4 py-4 text-foreground">Status</th>
              <th className="w-12 px-4 py-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-body text-muted-foreground">
                  {membersQuery.isLoading ? "Loading team…" : "No team members yet."}
                </td>
              </tr>
            )}

            {filtered.map((member) => (
              <tr
                key={member.id}
                className="border-b border-border transition-colors hover:bg-muted/50"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-4">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full text-body font-semibold text-foreground"
                      style={{ backgroundColor: member.avatar_color }}
                      aria-hidden
                    >
                      {member.initials || deriveInitials(memberName(member))}
                    </span>
                    <span className="font-semibold text-foreground">{memberName(member)}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">{member.email || "–"}</td>
                <td className="px-4 py-4 text-muted-foreground">
                  {member.role_id ? (roleNameById.get(member.role_id) ?? "–") : "–"}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={member.invite_status} />
                    {member.access_level === "admin" ? (
                      <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-caption font-semibold">
                        Admin
                      </span>
                    ) : null}
                    {member.invite_status === "not_invited" && (
                      <button
                        type="button"
                        className="text-body font-semibold text-primary underline-offset-4 hover:underline"
                        onClick={() => openInvite(member)}
                      >
                        Invite
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        aria-label={`Actions for ${memberName(member)}`}
                      >
                        <DotsThreeVertical size={18} weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-2">
                      <DropdownMenuItem
                        className="px-3 py-2 text-body font-medium"
                        onClick={() => openEdit(member)}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="px-3 py-2 text-body font-medium"
                        onClick={() =>
                          navigate({ to: "/calendar", search: { team: member.id } as never })
                        }
                      >
                        View calendar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="px-3 py-2 text-body font-medium"
                        onClick={() => navigate({ to: "/team", search: { tab: "shifts" } })}
                      >
                        View scheduled shifts
                      </DropdownMenuItem>
                      {member.invite_status === "not_invited" && (
                        <DropdownMenuItem
                          className="px-3 py-2 text-body font-medium"
                          onClick={() => openInvite(member)}
                        >
                          Invite
                        </DropdownMenuItem>
                      )}
                      {member.invite_status === "invited" && (
                        <DropdownMenuItem
                          className="px-3 py-2 text-body font-medium"
                          onClick={() => resendInvite.mutate(member)}
                        >
                          Resend invite
                        </DropdownMenuItem>
                      )}
                      {member.invite_status === "active" && (
                        <DropdownMenuItem
                          className="px-3 py-2 text-body font-medium"
                          onClick={() =>
                            setAccessLevel.mutate({
                              member,
                              level: member.access_level === "admin" ? "staff" : "admin",
                            })
                          }
                        >
                          {member.access_level === "admin"
                            ? "Remove admin access"
                            : "Give admin access"}
                        </DropdownMenuItem>
                      )}
                      {member.invite_status === "active" && (
                        <DropdownMenuItem
                          className="px-3 py-2 text-body font-medium text-destructive focus:text-destructive"
                          onClick={() => setRevokeTarget(member)}
                        >
                          Revoke access
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget ? memberName(revokeTarget) : "This person"} will immediately lose access
              to the dashboard. Their past records stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeAccess.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (revokeTarget) revokeAccess.mutate(revokeTarget);
              }}
            >
              {revokeAccess.isPending ? "Revoking…" : "Revoke access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InviteTeamMemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        businessId={businessId}
        member={activeMember}
        mode={dialogMode}
      />
    </div>
  );
}

function exportCsv(members: TeamMemberRow[], roles: Map<string, string>) {
  const rows = [
    ["Name", "Email", "Permission role", "Status"],
    ...members.map((m) => [
      memberName(m),
      m.email ?? "",
      m.role_id ? (roles.get(m.role_id) ?? "") : "",
      STATUS_STYLES[m.invite_status]?.label ?? "",
    ]),
  ];
  const csv =
    "\uFEFF" +
    rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `team-members-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
