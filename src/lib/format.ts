/**
 * Locale-aware formatting helpers.
 *
 * Currency is a per-business setting (businesses.currency) — never hardcode a
 * code or symbol. Symbol placement, grouping and decimal separators all come
 * from Intl, keyed to the business's own country/currency.
 */

/** Best-effort BCP-47 locale for a business, from its ISO country code. */
export function businessLocale(countryCode?: string | null): string {
  const nav =
    typeof navigator !== "undefined" && navigator.language ? navigator.language : "en";
  // Strip POSIX-style modifiers (e.g. "en-US@posix") that Intl rejects.
  const cleaned = nav.split("@")[0] || "en";
  const language = cleaned.split("-")[0] || "en";
  return countryCode ? `${language}-${countryCode.toUpperCase()}` : cleaned;
}

/**
 * "₦15,000" or "₦15,000.50": whole amounts drop the ".00", others keep two decimals,
 * so every screen shows money the same way.
 */
export function formatMoney(
  amount: number,
  currency: string,
  countryCode?: string | null,
): string {
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  const digits = whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {};
  try {
    return new Intl.NumberFormat(businessLocale(countryCode), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      ...digits,
    }).format(whole ? Math.round(amount) : amount);
  } catch {
    try {
      return new Intl.NumberFormat(businessLocale(countryCode), {
        style: "currency",
        currency,
        ...digits,
      }).format(whole ? Math.round(amount) : amount);
    } catch {
      // Unknown/invalid ISO code — still avoid a hardcoded symbol.
      return `${currency} ${whole ? Math.round(amount) : amount.toFixed(2)}`;
    }
  }
}

/** The currency's symbol on its own ("₦"), for input prefixes. Falls back to the code. */
export function currencySymbol(currency: string, countryCode?: string | null): string {
  try {
    return (
      new Intl.NumberFormat(businessLocale(countryCode), {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/** "1 hr, 30 min", "45 min", "2 hr" */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hr`);
  if (minutes || !hours) parts.push(`${minutes} min`);
  return parts.join(", ");
}
