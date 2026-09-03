import { inviteTeamMember, revokeTeamMemberAccess } from "@/lib/team-invites.functions";

/** Sends (or resends) the invite email for a team member row. */
export async function sendTeamInvite(teamMemberId: string) {
  return inviteTeamMember({ data: { team_member_id: teamMemberId } });
}

/** Bans the linked account and resets the row back to "Not invited". */
export async function revokeTeamAccess(teamMemberId: string) {
  return revokeTeamMemberAccess({ data: { team_member_id: teamMemberId } });
}
