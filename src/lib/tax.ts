/** Tax included in a price: price − price / (1 + rate). Rate is a percentage, e.g. 7.5. */
export function includedTax(amount: number, rate: number | null | undefined) {
  if (!rate || amount <= 0) return 0;
  return Math.round((amount - amount / (1 + rate / 100)) * 100) / 100;
}

type DiscountLine = { amount: number; discountable?: boolean };

/**
 * Splits a cart discount across the lines it applies to (`discountable`, default true) in
 * proportion to their value. Rounded to 2 dp; the last covered line absorbs the rounding.
 */
export function lineDiscounts(lines: DiscountLine[], discount: number) {
  const covered = lines.map((l, i) => (l.discountable === false || l.amount <= 0 ? -1 : i)).filter((i) => i >= 0);
  const base = covered.reduce((sum, i) => sum + lines[i]!.amount, 0);
  const total = Math.min(Math.max(0, discount), base);
  const out = lines.map(() => 0);
  if (base <= 0 || total <= 0) return out;
  let given = 0;
  covered.forEach((i, n) => {
    const share = n === covered.length - 1 ? total - given : Math.round(((lines[i]!.amount / base) * total) * 100) / 100;
    out[i] = Math.round(share * 100) / 100;
    given += out[i]!;
  });
  return out;
}

/** Tax per line after a cart discount: each line's included tax is taken from what's actually charged. */
export function lineTaxes(lines: Array<DiscountLine & { rate: number | null }>, discount: number) {
  const discounts = lineDiscounts(lines, discount);
  return lines.map((l, i) => includedTax(l.amount - discounts[i]!, l.rate));
}
