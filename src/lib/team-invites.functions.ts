import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idInput = (input: unknown) => z.object({ team_member_id: z.string().uuid() }).parse(input);
const tokenInput = (input: unknown) => z.object({ token: z.string().min(8).max(200) }).parse(input);

function appUrl() {
  const configured = process.env["APP_URL"];
  if (configured) return configured.replace(/\/$/, "");
  const origin = new URL(getRequest().url).origin;
  return origin.replace(/\/$/, "");
}

function newToken() {
  return crypto.randomUUID();
}

/** The caller must be signed in and belong to the same business as the row. */
async function assertSameBusiness(
  supabase: { from: (t: string) => any },
  userId: string,
  businessId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.business_id !== businessId) throw new Error("You can't manage this team member.");
}

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await supabaseAdmin
      .from("team_members")
      .select("id, email, business_id, user_id, first_name, invite_status")
      .eq("id", data.team_member_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Team member not found.");

    await assertSameBusiness(context.supabase, context.userId, member.business_id);

    if (!member.email) throw new Error("Add an email address before sending an invite.");
    if (member.user_id) throw new Error("This team member already has access.");

    const inviteToken = newToken();
    const { error: updateError } = await supabaseAdmin
      .from("team_members")
      .update({ invite_token: inviteToken, invite_status: "invited" })
      .eq("id", member.id);
    if (updateError) throw new Error(updateError.message);

    const redirectTo = `${appUrl()}/accept-invite?token=${inviteToken}`;
    const { error: mailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(member.email, {
      redirectTo,
    });

    if (mailError) {
      // Roll back so the row doesn't claim an invite that never left.
      await supabaseAdmin
        .from("team_members")
        .update({ invite_token: null, invite_status: "not_invited" })
        .eq("id", member.id);

      // Already-registered users can't be invited again — send a magic link instead.
      const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: member.email,
        options: { redirectTo },
      });
      if (linkError) throw new Error(mailError.message);

      const { error: retryError } = await supabaseAdmin
        .from("team_members")
        .update({ invite_token: inviteToken, invite_status: "invited" })
        .eq("id", member.id);
      if (retryError) throw new Error(retryError.message);
    }

    return { sent: true, email: member.email as string };
  });

export const revokeTeamMemberAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await supabaseAdmin
      .from("team_members")
      .select("id, business_id, user_id")
      .eq("id", data.team_member_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Team member not found.");

    await assertSameBusiness(context.supabase, context.userId, member.business_id);
    if (member.user_id === context.userId) throw new Error("You can't revoke your own access.");

    if (member.user_id) {
      // Ban rather than delete: historical records must keep referencing this person.
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(member.user_id, {
        ban_duration: "876000h",
      });
      if (banError) throw new Error(banError.message);
    }

    const { error: resetError } = await supabaseAdmin
      .from("team_members")
      .update({ user_id: null, invite_status: "not_invited", invite_token: null })
      .eq("id", member.id);
    if (resetError) throw new Error(resetError.message);

    return { revoked: true };
  });

/** Public: the acceptance page renders before the invitee signs in. */
export const lookupTeamInvite = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await supabaseAdmin
      .from("team_members")
      .select("first_name, businesses:business_id(name)")
      .eq("invite_token", data.token)
      .eq("invite_status", "invited")
      .maybeSingle();

    if (error || !member) {
      throw new Error("This invite link is invalid or has expired.");
    }

    const business = member.businesses as { name: string } | null;
    return { first_name: member.first_name, business_name: business?.name ?? "the team" };
  });

export const acceptTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(tokenInput)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await supabaseAdmin
      .from("team_members")
      .select("id, business_id")
      .eq("invite_token", data.token)
      .eq("invite_status", "invited")
      .is("user_id", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("This invite link is invalid or has already been used.");

    const { error: claimError } = await supabaseAdmin
      .from("team_members")
      .update({ user_id: context.userId, invite_status: "active", invite_token: null })
      .eq("id", member.id);
    if (claimError) throw new Error(claimError.message);

    return { accepted: true, business_id: member.business_id };
  });
