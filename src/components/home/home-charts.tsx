// The dashboard's two charts. Loaded on demand so the rest of the home page doesn't wait for the
// charting library (recharts is the largest download in the app).
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Point = Record<string, string | number>;

const chartConfig = {
  sales: { label: "Sales", color: "var(--color-primary)" },
  appointments: { label: "Appointments", color: "var(--color-chart-appointments)" },
} satisfies ChartConfig;

const upcomingChartConfig = {
  confirmed: { label: "Confirmed", color: "var(--color-chart-appointments)" },
  booked: { label: "Booked", color: "var(--color-primary)" },
  cancelled: { label: "Cancelled", color: "var(--color-destructive)" },
} satisfies ChartConfig;

const AXIS_TICK = { fontSize: 12, fill: "var(--color-muted-foreground)" };

function compactMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function SalesChart({ data, currency }: { data: Point[]; currency: string }) {
  return (
    <ChartContainer config={chartConfig} className="mt-6 aspect-auto h-60 w-full">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          angle={-45}
          textAnchor="end"
          height={44}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          width={64}
          tickFormatter={(value: number) => compactMoney(value, currency)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="linear"
          dataKey="appointments"
          stroke="var(--color-appointments)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: "var(--color-appointments)" }}
        />
        <Line
          type="linear"
          dataKey="sales"
          stroke="var(--color-sales)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: "var(--color-sales)" }}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function UpcomingChart({ data }: { data: Point[] }) {
  return (
    <ChartContainer config={upcomingChartConfig} className="mt-6 aspect-auto h-60 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          angle={-45}
          textAnchor="end"
          height={44}
        />
        <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="confirmed" stackId="a" fill="var(--color-confirmed)" maxBarSize={28} />
        <Bar dataKey="booked" stackId="a" fill="var(--color-booked)" maxBarSize={28} />
        <Bar
          dataKey="cancelled"
          stackId="a"
          fill="var(--color-cancelled)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ChartContainer>
  );
}
