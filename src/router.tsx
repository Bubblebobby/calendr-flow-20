import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Avoid refetch storms on tab focus / remount; dashboard data is not
        // second-by-second critical and mutations invalidate explicitly.
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  // On the server, the nonce for this request's Content-Security-Policy (set in server.ts); the
  // router puts it on every inline script it renders.
  const nonce =
    typeof window === "undefined"
      ? (globalThis as { __booklyCspNonce?: () => string | undefined }).__booklyCspNonce?.()
      : undefined;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    ...(nonce ? { ssr: { nonce } } : {}),
    scrollRestoration: true,
    // Warm route chunks + loaders on hover/touch so navigation feels instant.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
