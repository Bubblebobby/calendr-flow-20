/** Pay run maths: hours from timesheets, commission from sold items, tips from sales. */

export type PayMember = {
  id: string;
  name: string;
  hourly_rate: number | null;
  service_commission_percent: number | null;
  product_commission_percent: number | null;
};
export type PayTimesheet = { team_member_id: string; clock_in: string; clock_out: string | null; break_minutes: number };
export type PaySale = {
  team_member_id: string | null;
  total: number; // after cart discount, excluding tip
  tip_amount: number | null;
  items: Array<{
    team_member_id: string | null;
    service_id: string | null;
    product_id: string | null;
    price: number;
    quantity: number;
    tax_amount: number | null;
    /** This line's share of the cart discount; null on sales saved before it was recorded. */
    discount_amount?: number | null;
  }>;
};
export type PayLine = { team_member_id: string; member_name: string; hours: number; wages: number; commission: number; tips: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Worked hours of a finished timesheet entry (open entries count as 0). */
export function workedHours(entry: PayTimesheet) {
  if (!entry.clock_out) return 0;
  const minutes = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000 - entry.break_minutes;
  return Math.max(0, minutes) / 60;
}

export function computePay(members: PayMember[], timesheets: PayTimesheet[], sales: PaySale[]): PayLine[] {
  return members.map((m) => {
    const hours = timesheets.filter((t) => t.team_member_id === m.id).reduce((sum, t) => sum + workedHours(t), 0);
    let commission = 0;
    let tips = 0;
    for (const sale of sales) {
      if (sale.team_member_id === m.id) tips += Number(sale.tip_amount ?? 0);
      // Older sales don't record each line's discount: estimate it across services and products
      // (gift cards, packages and memberships aren't discounted).
      const commissionable = sale.items.filter((i) => i.service_id || i.product_id);
      const base = commissionable.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const prepaid = sale.items.reduce((sum, i) => sum + (i.service_id || i.product_id ? 0 : i.price * i.quantity), 0);
      const factor = base > 0 ? Math.max(0, Math.min(1, (Number(sale.total) - prepaid) / base)) : 0;
      for (const item of sale.items) {
        const who = item.team_member_id ?? sale.team_member_id;
        if (who !== m.id) continue;
        const rate = item.service_id ? m.service_commission_percent : item.product_id ? m.product_commission_percent : null;
        if (!rate) continue;
        // Commission on what was actually charged, without tax.
        const gross = item.price * item.quantity;
        const charged = item.discount_amount != null ? gross - Number(item.discount_amount) : gross * factor;
        const net = Math.max(0, charged - Number(item.tax_amount ?? 0));
        commission += (net * rate) / 100;
      }
    }
    return {
      team_member_id: m.id,
      member_name: m.name,
      hours: round2(hours),
      wages: round2(hours * Number(m.hourly_rate ?? 0)),
      commission: round2(commission),
      tips: round2(tips),
    };
  });
}
