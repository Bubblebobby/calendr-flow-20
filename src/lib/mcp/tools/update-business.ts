import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_business",
  title: "Update business profile",
  description:
    "Update editable details of the signed-in owner's business (name, website, timezone, team size). Only the provided fields change.",
  inputSchema: {
    name: z.string().trim().min(1).max(120).optional().describe("Business display name."),
    website: z.string().trim().max(300).optional().describe("Business website URL."),
    timezone: z.string().trim().max(80).optional().describe("IANA timezone, e.g. Africa/Lagos."),
    team_size: z
      .string()
      .trim()
      .max(40)
      .optional()
      .describe("Team size bucket, e.g. 'independent' or '2-5'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const patch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined && v !== ""),
    );
    if (Object.keys(patch).length === 0) throw new ToolError("Provide at least one field to update.");

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("businesses")
      .update(patch)
      .eq("owner_id", ctx.getUserId()!)
      .select("id, name, website, timezone, team_size")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "No business found for this account." }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { business: data },
    };
  },
});
