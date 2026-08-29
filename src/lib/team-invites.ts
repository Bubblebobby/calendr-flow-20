/**
 * Placeholder invite dispatcher.
 *
 * The invite row (email + invite_token + invite_status) is already written by
 * the time this runs. Delivery will be wired to a real backend function next;
 * for now this resolves so the UI can confirm the invite was queued.
 */
export async function sendTeamInvite(teamMemberId: string): Promise<{ queued: true }> {
  console.info("[team-invite] queued for team member", teamMemberId);
  return { queued: true };
}
