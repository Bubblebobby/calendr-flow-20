import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  server: { host: "127.0.0.1", port: 8080, strictPort: true },
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts wraps TanStack Start's server entry with our SSR error page.
      server: { entry: "server" },
      importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } },
    }),
    // Nitro picks the deploy target automatically: Vercel when building on Vercel, Node locally.
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],
}));
