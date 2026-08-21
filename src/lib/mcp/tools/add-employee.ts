import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_employee",
  title: "Add team member",
  description: "Add a team member (employee) to the signed-in owner's business.",
  inputSchema: {
    first_name: z.string().trim().min(1).max(80).describe("Team member's first name."),
    last_name: z.string().trim().max(80).optional().describe("Team member's last name."),
    email: z.string().trim().email().optional().describe("Work email address."),
    phone: z.string().trim().max(40).optional().describe("Phone number in international format."),
    job_title: z.string().trim().max(80).optional().describe("Role or job title, e.g. Stylist."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", ctx.getUserId()!)
      .maybeSingle();
    if (bizError) return { content: [{ type: "text", text: bizError.message }], isError: true };
    if (!business) throw new ToolError("No business found for this account — finish setup first.");

    const { data, error } = await supabase
      .from("employees")
      .insert({
        business_id: business.id,
        first_name: input.first_name,
        last_name: input.last_name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        job_title: input.job_title ?? null,
        is_example: false,
      })
      .select("id, first_name, last_name, email, phone, job_title")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { employee: data },
    };
  },
});
