import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

// Sent with every response. The CSP only covers framing, plugins, <base> and form targets;
// a full script/style policy needs testing against Supabase, fonts and maps first.
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), payment=(), geolocation=(self)",
  "Content-Security-Policy":
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
};

export default defineConfig(({ command }) => ({
  server: { host: "127.0.0.1", port: 8080, strictPort: true },
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts wraps TanStack Start's server entry with our SSR error page.
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Nitro picks the deploy target automatically: Vercel when building on Vercel, Node locally.
    ...(command === "build"
      ? [
          nitro({
            routeRules: { "/**": { headers: SECURITY_HEADERS } },
            // Run server code in Dublin, next to the database (Supabase eu-west-1, Ireland).
            vercel: { functions: { regions: ["dub1"] } },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
