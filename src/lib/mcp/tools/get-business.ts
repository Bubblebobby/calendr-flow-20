import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_business",
  title: "Get business profile",
  description:
    "Get the signed-in owner's business profile: name, website, country, currency, timezone, categories, team size, service locations and setup progress.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id, name, website, country, currency, timezone, categories, other_category, team_size, service_locations, migration_source, setup_step, created_at",
      )
      .eq("owner_id", ctx.getUserId()!)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "No business found for this account yet." }] };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { business: data },
    };
  },
});
