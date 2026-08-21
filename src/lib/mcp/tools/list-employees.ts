import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_employees",
  title: "List team members",
  description: "List the team members (employees) of the signed-in owner's business.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", ctx.getUserId()!)
      .maybeSingle();
    if (bizError) return { content: [{ type: "text", text: bizError.message }], isError: true };
    if (!business)
      return { content: [{ type: "text", text: "No business found for this account yet." }] };

    const { data, error } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, phone, job_title, is_example, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { employees: data ?? [] },
    };
  },
});
