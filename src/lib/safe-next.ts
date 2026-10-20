/**
 * Returns a same-origin path for post-login redirects, or null.
 *
 * A prefix check ("starts with / but not //") isn't enough: browsers treat "/\evil.com" as
 * "//evil.com". Resolving against our own origin and comparing origins also covers tabs,
 * newlines and other URL-parser quirks.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  if (typeof window === "undefined" || !value.startsWith("/")) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
