import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getBusinessTool from "./tools/get-business";
import updateBusinessTool from "./tools/update-business";
import listEmployeesTool from "./tools/list-employees";
import addEmployeeTool from "./tools/add-employee";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "harmony-hub",
  title: "Harmony Hub",
  version: "0.1.0",
  instructions:
    "Tools for Harmony Hub, a booking and business management platform. Read and update the signed-in owner's business profile and manage their team members. All data is scoped to the signed-in user's own business.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // defineTool infers `outputSchema: undefined`, which trips exactOptionalPropertyTypes.
  tools: [getBusinessTool, updateBusinessTool, listEmployeesTool, addEmployeeTool] as unknown as Parameters<
    typeof defineMcp
  >[0]["tools"],
});
