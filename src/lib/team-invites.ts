import {
  inviteTeamMember,
  revokeTeamMemberAccess,
  setTeamMemberAccessLevel,
} from "@/lib/team-invites.functions";

/** Sends (or resends) the invite email for a team member row. */
export async function sendTeamInvite(teamMemberId: string) {
  return inviteTeamMember({ data: { team_member_id: teamMemberId } });
}

/** Removes the person's access to this business and resets the row to "Not invited". */
export async function revokeTeamAccess(teamMemberId: string) {
  return revokeTeamMemberAccess({ data: { team_member_id: teamMemberId } });
}

/** Owner only: makes an active team member an admin, or back to staff. */
export async function setTeamAccessLevel(teamMemberId: string, level: "staff" | "admin") {
  return setTeamMemberAccessLevel({ data: { team_member_id: teamMemberId, level } });
}
