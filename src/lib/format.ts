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
  const language = nav.split("-")[0] || "en";
  return countryCode ? `${language}-${countryCode.toUpperCase()}` : nav;
}

export function formatMoney(
  amount: number,
  currency: string,
  countryCode?: string | null,
): string {
  try {
    return new Intl.NumberFormat(businessLocale(countryCode), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    try {
      return new Intl.NumberFormat(businessLocale(countryCode), {
        style: "currency",
        currency,
      }).format(amount);
    } catch {
      // Unknown/invalid ISO code — still avoid a hardcoded symbol.
      return `${currency} ${amount.toFixed(2)}`;
    }
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
