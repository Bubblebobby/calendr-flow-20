import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { deriveInitials, memberName } from "@/components/catalog/service-team-members";
import { sendTeamInvite } from "@/lib/team-invites";
import type { TeamMemberRow } from "@/components/team/team-members-list";

/** Starting tiers offered when a business hasn't defined its own roles yet. */
export const DEFAULT_ROLE_TIERS = ["No access", "Basic", "Low", "Medium", "High"] as const;

type TeamRole = { id: string; name: string };

const AVATAR_COLORS = ["#D9F0FA", "#E7E3FE", "#FDE8D7", "#DCF3E4", "#FBE0EC"];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useTeamRoles(businessId: string | undefined) {
  return useQuery({
    queryKey: ["team-roles", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<TeamRole[]> => {
      const { data, error } = await supabase
        .from("team_roles")
        .select("id, name")
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function InviteTeamMemberDialog({
  open,
  onOpenChange,
  businessId,
  member,
  mode = "invite",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string | undefined;
  /** Set when acting on an existing roster row. */
  member?: TeamMemberRow | null;
  mode?: "invite" | "edit";
}) {
  const queryClient = useQueryClient();
  const rolesQuery = useTeamRoles(businessId);
  const roles = rolesQuery.data ?? [];

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(member ? memberName(member) : "");
    setEmail(member?.email ?? "");
    setRole(member?.role_id ?? "");
    setError(null);
  }, [open, member]);

  /** Either saved roles, or the default seed tiers by name. */
  const roleOptions = useMemo(
    () =>
      roles.length
        ? roles.map((r) => ({ value: r.id, label: r.name }))
        : DEFAULT_ROLE_TIERS.map((name) => ({ value: `seed:${name}`, label: name })),
    [roles],
  );

  const invite = useMutation({
    mutationFn: async () => {
      const name = fullName.trim();
      const mail = email.trim().toLowerCase();

      // Seed the business's role tiers on first use, then resolve the chosen one.
      let roleId: string | null = null;
      if (role.startsWith("seed:")) {
        const { data: seeded, error: seedError } = await supabase
          .from("team_roles")
          .insert(
            DEFAULT_ROLE_TIERS.map((tierName) => ({
              business_id: businessId!,
              name: tierName,
              permissions: {},
            })),
          )
          .select("id, name");
        if (seedError) throw seedError;
        roleId = seeded?.find((r) => r.name === role.slice(5))?.id ?? null;
      } else if (role) {
        roleId = role;
      }

      const editing = mode === "edit";
      const payload = editing
        ? { email: mail || null, role_id: roleId }
        : { email: mail, role_id: roleId };

      let teamMemberId = member?.id;
      if (teamMemberId) {
        const { error: updateError } = await supabase
          .from("team_members")
          .update({
            ...payload,
            first_name: name.split(/\s+/)[0]!,
            last_name: name.split(/\s+/).slice(1).join(" ") || null,
            initials: deriveInitials(name),
          })
          .eq("id", teamMemberId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("team_members")
          .insert({
            business_id: businessId!,
            first_name: name.split(/\s+/)[0]!,
            last_name: name.split(/\s+/).slice(1).join(" ") || null,
            initials: deriveInitials(name),
            avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!,
            ...payload,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        teamMemberId = data.id;
      }

      if (!editing) await sendTeamInvite(teamMemberId!);
      return teamMemberId!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", businessId] });
      queryClient.invalidateQueries({ queryKey: ["team-roles", businessId] });
      if (mode === "edit") {
        toast.success("Team member updated");
      } else {
        toast.success("Invite sent", {
          description: `${fullName.trim()} will get an invite at ${email.trim()}.`,
        });
      }
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(mode === "edit" ? "Couldn't save changes" : "Couldn't send the invite", {
        description: err.message,
      });
    },
  });

  const submit = () => {
    if (!fullName.trim()) return setError("Enter a full name.");
    if (mode === "invite" && !emailPattern.test(email.trim()))
      return setError("Enter a valid email address.");
    if (mode === "edit" && email.trim() && !emailPattern.test(email.trim()))
      return setError("Enter a valid email address.");
    if (!role) return setError("Choose a permission role.");
    setError(null);
    invite.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {mode === "edit"
              ? `Edit ${member ? memberName(member) : "team member"}`
              : member
                ? `Invite ${memberName(member)}`
                : "Invite team member"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update their details and permission role."
              : member
                ? "Add an email address and permission role to send them access."
                : "They'll get an email invite to join this workspace."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-name" className="text-sm font-semibold">
              Full name
            </Label>
            <Input
              id="invite-name"
              value={fullName}
              readOnly={mode === "invite" && Boolean(member)}
              maxLength={80}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="e.g. Ada Obi"
              className="h-12 rounded-xl text-base read-only:bg-muted/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-sm font-semibold">
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              maxLength={255}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="h-12 rounded-xl text-base"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-12 rounded-xl text-base">
                <SelectValue placeholder="Select a permission role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roles.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No roles set up yet — the default tiers will be created for your business.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="h-11 rounded-full px-5 font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-11 rounded-full px-7 font-semibold"
            onClick={submit}
            disabled={invite.isPending}
          >
            {invite.isPending
              ? mode === "edit"
                ? "Saving…"
                : "Sending…"
              : mode === "edit"
                ? "Save changes"
                : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
