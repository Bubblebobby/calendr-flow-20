/** Tax included in a price: price − price / (1 + rate). Rate is a percentage, e.g. 7.5. */
export function includedTax(amount: number, rate: number | null | undefined) {
  if (!rate || amount <= 0) return 0;
  return Math.round((amount - amount / (1 + rate / 100)) * 100) / 100;
}

/**
 * Tax per line after a cart discount: the discount is shared across the lines it applies to
 * (`discountable`, default true) in proportion to their value, then each line's included tax is
 * taken from what's actually charged.
 */
export function lineTaxes(
  lines: Array<{ amount: number; rate: number | null; discountable?: boolean }>,
  discount: number,
) {
  const base = lines.reduce((sum, l) => sum + (l.discountable === false ? 0 : l.amount), 0);
  const factor = base > 0 ? Math.max(0, base - discount) / base : 1;
  return lines.map((l) => includedTax(l.discountable === false ? l.amount : l.amount * factor, l.rate));
}
