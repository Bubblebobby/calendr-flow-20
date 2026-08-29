import { useMemo, useState } from "react";
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
import { deriveInitials } from "@/components/catalog/service-team-members";
import { InviteTeamMemberDialog, useTeamRoles } from "@/components/team/invite-team-member-dialog";
import { supabase } from "@/integrations/supabase/client";
import { sendTeamInvite } from "@/lib/team-invites";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

export type InviteStatus = "not_invited" | "invited" | "active";

export type TeamMemberRow = {
  id: string;
  full_name: string;
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
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

export function TeamMembersList() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"invite" | "edit">("invite");
  const [activeMember, setActiveMember] = useState<TeamMemberRow | null>(null);

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
          "id, full_name, initials, avatar_color, email, invite_status, role_id, is_active, created_at",
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
      `${member.full_name} ${member.email ?? ""}`.toLowerCase().includes(term),
    );
  }, [members, search]);

  const resendInvite = useMutation({
    mutationFn: async (member: TeamMemberRow) => {
      await sendTeamInvite(member.id);
    },
    onSuccess: () => toast.success("Invite queued again"),
    onError: (error: Error) =>
      toast.error("Couldn't resend the invite", { description: error.message }),
  });

  const revokeAccess = useMutation({
    mutationFn: async (member: TeamMemberRow) => {
      const { error } = await supabase
        .from("team_members")
        .update({ invite_status: "not_invited", invite_token: null })
        .eq("id", member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", businessId] });
      toast.success("Access revoked");
    },
    onError: (error: Error) =>
      toast.error("Couldn't revoke access", { description: error.message }),
  });

  const openInvite = (member: TeamMemberRow | null) => {
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
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Team members</h2>
          <span className="rounded-full border border-border bg-white px-3 py-1 text-sm font-semibold text-foreground">
            {members.length}
          </span>
        </div>
        <Button
          className="h-12 gap-2 rounded-full px-7 text-base font-semibold"
          onClick={() => openInvite(null)}
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
            className="h-12 w-[320px] rounded-full border-border bg-white pl-11 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-4 text-base font-bold text-foreground">Name</th>
              <th className="px-4 py-4 text-base font-bold text-foreground">Email</th>
              <th className="px-4 py-4 text-base font-bold text-foreground">Permission role</th>
              <th className="px-4 py-4 text-base font-bold text-foreground">Status</th>
              <th className="w-12 px-4 py-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  {membersQuery.isLoading ? "Loading team…" : "No team members yet."}
                </td>
              </tr>
            )}

            {filtered.map((member) => (
              <tr key={member.id} className="border-b border-border transition-colors hover:bg-muted/50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-4">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-foreground"
                      style={{ backgroundColor: member.avatar_color }}
                      aria-hidden
                    >
                      {member.initials || deriveInitials(member.full_name)}
                    </span>
                    <span className="font-semibold text-foreground">{member.full_name}</span>
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
                        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
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
                        aria-label={`Actions for ${member.full_name}`}
                      >
                        <DotsThreeVertical size={18} weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-2">
                      <DropdownMenuItem
                        className="px-3 py-2 text-sm font-medium"
                        onClick={() => openEdit(member)}
                      >
                        Edit
                      </DropdownMenuItem>
                      {member.invite_status === "not_invited" && (
                        <DropdownMenuItem
                          className="px-3 py-2 text-sm font-medium"
                          onClick={() => openInvite(member)}
                        >
                          Invite
                        </DropdownMenuItem>
                      )}
                      {member.invite_status === "invited" && (
                        <DropdownMenuItem
                          className="px-3 py-2 text-sm font-medium"
                          onClick={() => resendInvite.mutate(member)}
                        >
                          Resend invite
                        </DropdownMenuItem>
                      )}
                      {member.invite_status === "active" && (
                        <DropdownMenuItem
                          className="px-3 py-2 text-sm font-medium text-destructive focus:text-destructive"
                          onClick={() => revokeAccess.mutate(member)}
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
