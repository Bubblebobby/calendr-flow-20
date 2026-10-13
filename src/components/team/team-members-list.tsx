import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DotsThreeVertical, MagnifyingGlass, PaperPlaneTilt } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
          "id, first_name, last_name, initials, avatar_color, email, invite_status, role_id, is_active, created_at",
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
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Team members</h2>
          <span className="rounded-full border border-border bg-white px-3 py-1 text-body font-semibold text-foreground">
            {members.length}
          </span>
        </div>
        <Button
          className="h-12 gap-2 rounded-full px-7 text-base font-semibold"
          onClick={() => navigate({ to: "/team/new" })}
        >
          <PaperPlaneTilt size={18} weight="bold" />
          Invite team member
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-muted/60 p-4">
        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search team members"
            className="h-12 w-[320px] rounded-full border-border bg-white pl-11 text-body"
          />
        </div>
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
              <tr key={member.id} className="border-b border-border transition-colors hover:bg-muted/50">
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
              {revokeTarget ? memberName(revokeTarget) : "This person"} will immediately lose
              access to the dashboard. Their past records stay intact.
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
