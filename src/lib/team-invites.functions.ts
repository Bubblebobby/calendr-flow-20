import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const idInput = (input: unknown) => z.object({ team_member_id: z.string().uuid() }).parse(input);
const tokenInput = (input: unknown) => z.object({ token: z.string().uuid() }).parse(input);

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Logs the real error on the server; the browser only sees a plain message. */
function fail(publicMessage: string, cause?: unknown): never {
  if (cause) console.error(`[team-invites] ${publicMessage}`, cause);
  throw new Error(publicMessage);
}

function appUrl() {
  const configured = process.env["APP_URL"];
  if (configured) return configured.replace(/\/$/, "");
  // Without APP_URL the link would come from the request's Host header, which a caller can
  // spoof. Only allow that in local development.
  if (process.env["NODE_ENV"] === "production") {
    fail("Invites are not configured on this server.", new Error("APP_URL is not set"));
  }
  return new URL(getRequest().url).origin.replace(/\/$/, "");
}

function newToken() {
  return crypto.randomUUID();
}

/** Invites made before expiry existed have no date: treat them as expired so they get resent. */
function isExpired(expiresAt: string | null | undefined) {
  return !expiresAt || new Date(expiresAt).getTime() < Date.now();
}

/** The caller must own the business, or be an admin team member of it. */
async function assertBusinessAdmin(supabase: SupabaseClient<Database>, businessId: string) {
  const { data, error } = await supabase.rpc("is_business_admin", { p_business: businessId });
  if (error) fail("Could not check your permissions.", error);
  if (data !== true) fail("Only the business owner or an admin can manage team access.");
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
    if (error) fail("Could not load the team member.", error);
    if (!member) fail("Team member not found.");

    await assertBusinessAdmin(context.supabase, member.business_id);

    if (!member.email) fail("Add an email address before sending an invite.");
    if (member.user_id) fail("This team member already has access.");

    const inviteToken = newToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("team_members")
      .update({ invite_token: inviteToken, invite_status: "invited", invite_expires_at: expiresAt })
      .eq("id", member.id);
    if (updateError) fail("Could not create the invite.", updateError);

    const redirectTo = `${appUrl()}/accept-invite?token=${inviteToken}`;
    const { error: mailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(member.email, {
      redirectTo,
    });

    if (mailError) {
      // Already-registered people can't be invited again: email them a sign-in link instead.
      // (auth.admin.generateLink only returns a link; signInWithOtp actually sends the email.)
      const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
        email: member.email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (otpError) {
        // Roll back so the row doesn't claim an invite that never left.
        await supabaseAdmin
          .from("team_members")
          .update({ invite_token: null, invite_status: "not_invited", invite_expires_at: null })
          .eq("id", member.id);
        fail("Could not send the invite email.", { mailError, otpError });
      }
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
    if (error) fail("Could not load the team member.", error);
    if (!member) fail("Team member not found.");

    await assertBusinessAdmin(context.supabase, member.business_id);
    if (member.user_id === context.userId) fail("You can't revoke your own access.");

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("owner_id")
      .eq("id", member.business_id)
      .maybeSingle();
    if (businessError) fail("Could not load the business.", businessError);
    if (member.user_id && business?.owner_id === member.user_id) {
      fail("The business owner's access can't be revoked.");
    }

    if (member.user_id) {
      // Ban rather than delete: historical records must keep referencing this person.
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(member.user_id, {
        ban_duration: "876000h",
      });
      if (banError) fail("Could not revoke access.", banError);
    }

    const { error: resetError } = await supabaseAdmin
      .from("team_members")
      .update({
        user_id: null,
        invite_status: "not_invited",
        invite_token: null,
        invite_expires_at: null,
      })
      .eq("id", member.id);
    if (resetError) fail("Could not revoke access.", resetError);

    return { revoked: true };
  });

/** Public: the acceptance page renders before the invitee signs in. */
export const lookupTeamInvite = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await supabaseAdmin
      .from("team_members")
      .select("first_name, invite_expires_at, businesses:business_id(name)")
      .eq("invite_token", data.token)
      .eq("invite_status", "invited")
      .maybeSingle();

    if (error || !member || isExpired(member.invite_expires_at)) {
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
    const invalid = "This invite link is invalid, expired or was sent to a different email.";

    const { data: member, error } = await supabaseAdmin
      .from("team_members")
      .select("id, business_id, email, invite_expires_at")
      .eq("invite_token", data.token)
      .eq("invite_status", "invited")
      .is("user_id", null)
      .maybeSingle();
    if (error) fail(invalid, error);
    if (!member || isExpired(member.invite_expires_at)) fail(invalid);

    // The invite belongs to the address it was sent to, not to whoever holds the link.
    const { data: caller, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userError) fail(invalid, userError);
    const callerEmail = caller.user?.email?.trim().toLowerCase();
    if (!callerEmail || !member.email || callerEmail !== member.email.trim().toLowerCase())
      fail(invalid);

    // Atomic claim: only succeeds while the row is unclaimed and still has this exact token.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("team_members")
      .update({
        user_id: context.userId,
        invite_status: "active",
        invite_token: null,
        invite_expires_at: null,
      })
      .eq("id", member.id)
      .eq("invite_token", data.token)
      .is("user_id", null)
      .select("id");
    if (claimError) fail(invalid, claimError);
    if (!claimed || claimed.length !== 1) fail(invalid);

    return { accepted: true, business_id: member.business_id };
  });
