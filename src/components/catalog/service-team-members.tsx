import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeletons";

export type TeamMember = {
  id: string;
  first_name: string;
  last_name: string | null;
  initials: string | null;
  avatar_color: string;
};

const AVATAR_COLORS = ["#D9F0FA", "#E7E3FE", "#FDE8D7", "#DCF3E4", "#FBE0EC"];

/** "Ada Obi" -> "AO": first-name + last-name initials. */
export function deriveInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}

const SELECT_COLUMNS = "id, first_name, last_name, initials, avatar_color";

/** Display name for a roster row. */
export function memberName(member: { first_name: string; last_name?: string | null }) {
  return [member.first_name, member.last_name].filter(Boolean).join(" ");
}

/** Active roster for the business — the pool of people who can perform services. */
export function useTeamMembers(businessId: string | undefined) {
  return useQuery({
    queryKey: ["team-members", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select(SELECT_COLUMNS)
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      const rows = data ?? [];

      // The account owner is a team member too — make sure they're on the roster.
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return rows;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const ownerName = profile?.full_name?.trim();
      if (!ownerName) return rows;

      const { data: existing } = await supabase
        .from("team_members")
        .select("id")
        .eq("business_id", businessId!)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) return rows;

      const { data: created, error: createError } = await supabase
        .from("team_members")
        .insert({
          business_id: businessId!,
          first_name: ownerName.split(/\s+/)[0]!,
          last_name: ownerName.split(/\s+/).slice(1).join(" ") || null,
          user_id: userId,
          avatar_color: AVATAR_COLORS[0]!,
        })
        .select(SELECT_COLUMNS)
        .single();
      if (createError) return rows;
      return [created, ...rows];
    },
  });
}


/** Team members already assigned to a saved service (empty for a new service). */
export function useServiceTeamAssignments(serviceId: string | undefined) {
  return useQuery({
    queryKey: ["service-team-members", serviceId],
    enabled: Boolean(serviceId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("service_team_members")
        .select("team_member_id")
        .eq("service_id", serviceId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.team_member_id);
    },
  });
}

/**
 * Reconcile a service's assignments to exactly match `selected`:
 * insert newly checked members, delete unchecked ones, leave the rest alone.
 */
export async function reconcileServiceTeam(
  serviceId: string,
  selected: string[],
  previous: string[],
) {
  const added = selected.filter((id) => !previous.includes(id));
  const removed = previous.filter((id) => !selected.includes(id));

  if (added.length) {
    const { error } = await supabase
      .from("service_team_members")
      .insert(added.map((team_member_id) => ({ service_id: serviceId, team_member_id })));
    if (error) throw error;
  }
  if (removed.length) {
    const { error } = await supabase
      .from("service_team_members")
      .delete()
      .eq("service_id", serviceId)
      .in("team_member_id", removed);
    if (error) throw error;
  }
}

export function TeamMembersSection({
  businessId,
  members,
  loading,
  selected,
  onChange,
}: {
  businessId: string | undefined;
  members: TeamMember[];
  loading?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [fullName, setFullName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const allChecked = members.length > 0 && selected.length === members.length;
  const someChecked = selected.length > 0 && !allChecked;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const toggleAll = () => {
    onChange(allChecked ? [] : members.map((m) => m.id));
  };

  const createMember = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("team_members")
        .insert({
          business_id: businessId!,
          first_name: name.trim().split(/\s+/)[0]!,
          last_name: name.trim().split(/\s+/).slice(1).join(" ") || null,
          avatar_color: AVATAR_COLORS[members.length % AVATAR_COLORS.length]!,
        })
        .select(SELECT_COLUMNS)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["team-members", businessId] });
      onChange([...selected, created.id]);
      setFullName("");
      setAdding(false);
      toast.success("Team member added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitNew = () => {
    if (!fullName.trim()) {
      toast.error("Enter a full name");
      return;
    }
    createMember.mutate(fullName);
  };

  const countBadge = useMemo(() => members.length, [members.length]);

  return (
    <section className="rounded-xl border border-border bg-card px-6 py-8 sm:px-10">
      <h2 className="text-[1.5rem] font-semibold leading-8 text-foreground">Team members required</h2>
      <p className="mt-1 text-body text-muted-foreground">
        Choose which team members will perform this service
      </p>

      <div className="mt-8">
        <label className="flex cursor-pointer items-center gap-4 py-1">
          <Checkbox
            checked={allChecked ? true : someChecked ? "indeterminate" : false}
            onCheckedChange={toggleAll}
            disabled={members.length === 0}
            className="size-6 rounded-md border-2"
          />
          <span className="text-base font-semibold text-foreground">All team members</span>
          <span className="flex size-6 items-center justify-center rounded-full border border-border text-caption font-medium text-muted-foreground">
            {countBadge}
          </span>
        </label>

        {loading ? (
          <SkeletonList rows={3} thumb="round" className="py-2" label="Loading team" />
        ) : members.length === 0 ? (
          <p className="py-4 text-body text-muted-foreground">
            No team members yet — add one below.
          </p>
        ) : (
          <ul className="mt-2">
            {members.map((member, index) => (
              <li key={member.id}>
                {index > 0 && <div className="ml-[6.5rem] border-t border-border/70" />}
                <label className="flex cursor-pointer items-center gap-4 py-2">
                  <Checkbox
                    checked={selected.includes(member.id)}
                    onCheckedChange={() => toggle(member.id)}
                    className="size-6 rounded-md border-2"
                  />
                  <span className="flex flex-1 items-center gap-4">
                    <span
                      className="flex size-14 shrink-0 items-center justify-center rounded-full border text-base font-semibold"
                      style={{
                        backgroundColor: member.avatar_color,
                        borderColor: "#8FCDEA",
                        color: "#1F6D93",
                      }}
                      aria-hidden
                    >
                      {member.initials ?? deriveInitials(memberName(member))}
                    </span>
                    <span className="flex-1 text-base font-medium text-foreground">
                      {memberName(member)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="mt-4 max-w-sm space-y-2">
            <Label className="text-body font-semibold text-foreground">Full name</Label>
            <Input
              ref={inputRef}
              className="h-12 rounded-xl border border-border bg-transparent text-base"
              placeholder="e.g. Ada Obi"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitNew();
                }
              }}
            />
            <div className="flex items-center gap-2 pt-1">
              <Button
                className="h-10 rounded-full px-5 text-body font-semibold"
                onClick={submitNew}
                disabled={createMember.isPending}
              >
                {createMember.isPending ? "Adding…" : "Add"}
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-full px-4 text-body font-medium"
                onClick={() => {
                  setAdding(false);
                  setFullName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-4 text-body font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => setAdding(true)}
          >
            Add team member
          </button>
        )}
      </div>
    </section>
  );
}
