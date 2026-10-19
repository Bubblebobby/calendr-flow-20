/** Tax included in a price: price − price / (1 + rate). Rate is a percentage, e.g. 7.5. */
export function includedTax(amount: number, rate: number | null | undefined) {
  if (!rate || amount <= 0) return 0;
  return Math.round((amount - amount / (1 + rate / 100)) * 100) / 100;
}

/**
 * Tax per line after a cart discount: the discount is shared across lines in proportion to their
 * value, then each line's included tax is taken from what's actually charged.
 */
export function lineTaxes(lines: Array<{ amount: number; rate: number | null }>, discount: number) {
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const factor = subtotal > 0 ? Math.max(0, subtotal - discount) / subtotal : 0;
  return lines.map((l) => includedTax(l.amount * factor, l.rate));
}
