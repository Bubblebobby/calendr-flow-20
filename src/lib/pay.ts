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
  items: Array<{ team_member_id: string | null; service_id: string | null; product_id: string | null; price: number; quantity: number; tax_amount: number | null }>;
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
      const subtotal = sale.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const afterDiscount = subtotal > 0 ? Number(sale.total) / subtotal : 0;
      for (const item of sale.items) {
        const who = item.team_member_id ?? sale.team_member_id;
        if (who !== m.id) continue;
        const rate = item.service_id ? m.service_commission_percent : item.product_id ? m.product_commission_percent : null;
        if (!rate) continue;
        // Commission on what was actually charged, without tax.
        const net = Math.max(0, item.price * item.quantity * afterDiscount - Number(item.tax_amount ?? 0));
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
