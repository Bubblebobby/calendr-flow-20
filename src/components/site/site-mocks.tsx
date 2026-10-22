import type { ReactNode } from "react";
import {
  ArrowsClockwise,
  CalendarCheck,
  CheckCircle,
  CreditCard,
  Plus,
  Star,
  Warning,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { BLUE } from "./site-styles";

/*
 * Small, static pictures of Bookly screens for the marketing page. They show what the product
 * really does (names and prices are made up), so keep them in step with the app.
 */

export function MockCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[12px] bg-white p-4 text-[#101010] shadow-[0_12px_40px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TONES = {
  blue: "bg-[#dbe8ff] text-[#0b3d91]",
  amber: "bg-[#fdf3e2] text-[#8a5300]",
  green: "bg-[#e6f5ea] text-[#1f6b35]",
  pink: "bg-[#fdecef] text-[#9b1c3a]",
};

const CAL_TEAM = ["Ada", "Tolu", "Chi"];
const CAL_SLOTS = [
  { col: 0, top: 0, h: 2, name: "Funmi O.", svc: "Silk press", tone: TONES.blue },
  { col: 1, top: 0, h: 3, name: "Kemi A.", svc: "Knotless braids", tone: TONES.amber },
  { col: 2, top: 1, h: 1, name: "Ngozi E.", svc: "Gel nails", tone: TONES.green },
  { col: 0, top: 2, h: 1, name: "Bisi K.", svc: "Trim", tone: TONES.pink },
  { col: 2, top: 2, h: 2, name: "Amaka N.", svc: "Lash fill", tone: TONES.blue },
];

export function CalendarMock({ compact }: { compact?: boolean }) {
  const rowH = compact ? 34 : 38;
  return (
    <MockCard>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">Today · Thu 22 Oct</p>
        <span className="flex items-center gap-1 rounded-full bg-[#101010] px-2.5 py-1 text-[11px] font-medium text-white">
          <Plus size={10} weight="bold" /> New
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[34px_1fr_1fr_1fr] gap-x-1.5">
        <span />
        {CAL_TEAM.map((name) => (
          <span key={name} className="pb-1.5 text-[11px] font-medium text-[#666]">
            {name}
          </span>
        ))}
        <div className="flex flex-col text-[10px] text-[#959595]">
          {["9:00", "10:00", "11:00", "12:00"].map((t) => (
            <span key={t} style={{ height: rowH }}>
              {t}
            </span>
          ))}
        </div>
        {CAL_TEAM.map((_, col) => (
          <div
            key={col}
            className="relative border-l border-[#f0f0f0]"
            style={{ height: rowH * 4 }}
          >
            {CAL_SLOTS.filter((s) => s.col === col).map((s) => (
              <div
                key={s.name}
                className={cn(
                  "absolute inset-x-1 overflow-hidden rounded-[5px] px-1.5 py-1",
                  s.tone,
                )}
                style={{ top: s.top * rowH + 2, height: s.h * rowH - 4 }}
              >
                <p className="truncate text-[10px] font-semibold">{s.name}</p>
                <p className="truncate text-[9px] opacity-80">{s.svc}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </MockCard>
  );
}

export function CheckoutMock() {
  return (
    <MockCard>
      <p className="text-[13px] font-semibold">Checkout · Kemi A.</p>
      <ul className="mt-3 space-y-2 text-[12px]">
        {[
          ["Knotless braids", "₦35,000"],
          ["Edge control", "₦4,500"],
          ["Tip", "₦3,000"],
        ].map(([item, price]) => (
          <li key={item} className="flex justify-between">
            <span className="text-[#666]">{item}</span>
            <span className="tabular-nums">{price}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-[#f0f0f0] pt-3 text-[14px] font-semibold">
        <span>Total</span>
        <span className="tabular-nums">₦42,500</span>
      </div>
      <div
        className="mt-3 flex items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-medium text-white"
        style={{ background: BLUE }}
      >
        <CreditCard size={15} /> Take payment
      </div>
    </MockCard>
  );
}

/** A client's card, and the alert when someone moves their own booking. */
export function ClientMock() {
  return (
    <div className="space-y-2">
      <MockCard className="p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fdecef] text-[13px] font-semibold text-[#9b1c3a]">
            NE
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Ngozi Eze</p>
            <p className="text-[11px] text-[#666]">12 visits · Client since 2024</p>
          </div>
        </div>
        <p className="mt-2 rounded-[6px] bg-[#f7f7f7] px-2 py-1.5 text-[11px] leading-4 text-[#666]">
          Note: prefers almond shape, sensitive to acetone.
        </p>
      </MockCard>
      <MockCard className="flex items-center gap-2 p-3">
        <ArrowsClockwise size={18} weight="bold" style={{ color: BLUE }} />
        <p className="text-[12px] font-medium">Ngozi moved her appointment to Fri, 11:00</p>
      </MockCard>
    </div>
  );
}

export function ListingMock() {
  return (
    <MockCard className="p-0">
      <div className="p-4">
        <p className="text-[14px] font-semibold">Glow Studio</p>
        <p className="text-[11px] text-[#666]">Lekki Phase 1, Lagos · ★ 4.9 (212)</p>
      </div>
      <ul className="border-t border-[#f0f0f0]">
        {[
          ["Silk press", "1 hr", "₦18,000"],
          ["Knotless braids", "4 hr", "₦35,000"],
          ["Gel nails", "45 min", "₦12,000"],
        ].map(([svc, dur, price]) => (
          <li
            key={svc}
            className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-2.5 last:border-0"
          >
            <div>
              <p className="text-[12px] font-medium">{svc}</p>
              <p className="text-[10px] text-[#959595]">{dur}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] tabular-nums">{price}</span>
              <span className="rounded-full border border-[#dadada] px-2.5 py-0.5 text-[11px] font-medium">
                Book
              </span>
            </div>
          </li>
        ))}
      </ul>
    </MockCard>
  );
}

// ── Pictures for the "Run every part of your salon" cards ──

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <MockCard className="w-full max-w-[250px] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
      <p className="text-[12px] font-semibold">{title}</p>
      <div className="mt-3">{children}</div>
    </MockCard>
  );
}

export function TeamMock() {
  return (
    <Panel title="This week's shifts">
      <ul className="space-y-2 text-[11px]">
        {[
          ["Ada", "Mon–Fri", "9:00–17:00", TONES.blue],
          ["Tolu", "Tue–Sat", "10:00–18:00", TONES.amber],
          ["Chi", "Wed–Sun", "11:00–19:00", TONES.green],
          ["Ife", "Time off", "Until Mon", TONES.pink],
        ].map(([name, days, hours, tone]) => (
          <li key={name} className="flex items-center gap-2">
            <span className="w-8 font-medium">{name}</span>
            <span className={cn("flex-1 rounded px-2 py-1", tone)}>
              {days} · {hours}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function PayMock() {
  return (
    <Panel title="Pay run · 1–15 Oct">
      <ul className="space-y-2 text-[11px]">
        {[
          ["Ada", "Commission", "₦84,000"],
          ["Ada", "Tips", "₦12,500"],
          ["Tolu", "Commission", "₦61,200"],
          ["Tolu", "Hours (72)", "₦54,000"],
        ].map(([name, kind, amount], i) => (
          <li key={i} className="flex justify-between">
            <span className="text-[#666]">
              {name} · {kind}
            </span>
            <span className="tabular-nums">{amount}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-[#f0f0f0] pt-2 text-[12px] font-semibold">
        <span>Total</span>
        <span className="tabular-nums">₦211,700</span>
      </div>
    </Panel>
  );
}

export function StockMock() {
  return (
    <Panel title="Products">
      <ul className="space-y-2 text-[11px]">
        {[
          ["Edge control", "24 in stock", false],
          ["Argan oil serum", "3 left", true],
          ["Cuticle oil", "18 in stock", false],
          ["Gel top coat", "2 left", true],
        ].map(([name, level, low]) => (
          <li key={String(name)} className="flex items-center justify-between">
            <span>{name}</span>
            <span
              className={cn(
                "flex items-center gap-1",
                low ? "font-medium text-[#bf0020]" : "text-[#666]",
              )}
            >
              {low ? <Warning size={11} weight="fill" /> : null}
              {level}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ReportsMock() {
  const bars = [42, 58, 50, 74, 66, 88, 70];
  return (
    <Panel title="Sales this week">
      <p className="text-[20px] font-semibold tabular-nums">₦1,284,500</p>
      <p className="text-[10px] font-medium text-[#1f6b35]">+12% on last week</p>
      <div className="mt-3 flex h-20 items-end gap-1.5">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-t-[3px]"
            style={{ height: `${h}%`, background: i === 5 ? BLUE : "#dbe8ff" }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-[#959595]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {d}
          </span>
        ))}
      </div>
    </Panel>
  );
}

export function GiftCardMock() {
  return (
    <div className="w-full max-w-[250px]">
      <div className="aspect-[1.6] rounded-[12px] bg-[#101010] p-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold">Glow Studio</span>
          <CalendarCheck size={16} />
        </div>
        <p className="mt-6 text-[11px] text-white/60">Gift card</p>
        <p className="text-[22px] font-semibold tabular-nums">₦50,000</p>
        <p className="mt-1 font-mono text-[10px] tracking-[0.15em] text-white/60">GLOW-7K2P-9QX4</p>
      </div>
    </div>
  );
}

export function MembershipMock() {
  return (
    <Panel title="Membership · Monthly glow">
      <p className="text-[11px] text-[#666]">2 treatments a month · ₦30,000</p>
      <div className="mt-3 h-2 rounded-full bg-[#f0f0f0]">
        <div className="h-2 w-1/2 rounded-full" style={{ background: BLUE }} />
      </div>
      <p className="mt-1.5 text-[10px] text-[#666]">1 of 2 used this month</p>
      <ul className="mt-3 space-y-1.5 text-[11px]">
        <li className="flex items-center gap-1.5">
          <CheckCircle size={13} weight="fill" className="text-[#1f8a3e]" /> Facial · 3 Oct
        </li>
        <li className="flex items-center gap-1.5 text-[#959595]">
          <CheckCircle size={13} /> Next visit
        </li>
      </ul>
    </Panel>
  );
}

export function ReviewMock() {
  return (
    <Panel title="Reviews · 4.9">
      {[
        ["Funmi O.", "Best silk press in Lekki. Booked again before I left."],
        ["Tolu A.", "Easy to book, on time, lovely team."],
      ].map(([name, text]) => (
        <div key={name} className="border-b border-[#f0f0f0] py-2 last:border-0">
          <div className="flex items-center gap-0.5 text-[#101010]">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={10} weight="fill" />
            ))}
            <span className="ml-1.5 text-[10px] font-medium">{name}</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-[#666]">{text}</p>
        </div>
      ))}
    </Panel>
  );
}

// ── Devices ──

/** Bookly's calendar, drawn small enough to sit inside any of the device frames. */
function ScreenCalendar({ columns }: { columns: number }) {
  const names = ["Ada", "Tolu", "Chi", "Ife"].slice(0, columns);
  const tones = [TONES.blue, TONES.amber, TONES.green, TONES.pink];
  return (
    <div className="flex size-full flex-col bg-white p-[6%] text-[#101010]">
      <div className="flex items-center justify-between">
        <span className="text-[clamp(7px,1.2vw,12px)] font-semibold">Today</span>
        <span className="rounded-full bg-[#101010] px-[6%] py-[2%] text-[clamp(6px,0.9vw,10px)] text-white">
          New
        </span>
      </div>
      <div
        className="mt-[6%] grid flex-1 gap-[3%]"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {names.map((name, col) => (
          <div key={name} className="flex flex-col gap-[6%]">
            <span className="text-[clamp(6px,0.9vw,10px)] text-[#666]">{name}</span>
            {[0, 1, 2].map((row) =>
              (row + col) % 3 === 2 ? (
                <span key={row} className="flex-1" />
              ) : (
                <span key={row} className={cn("flex-1 rounded-[4px]", tones[(row + col) % 4])} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export type Device = "phone" | "tablet" | "laptop" | "desktop";

export function DeviceMock({ device }: { device: Device }) {
  if (device === "phone") {
    return (
      <div className="aspect-[9/19] w-[190px] rounded-[30px] bg-[#101010] p-[9px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]">
        <div className="size-full overflow-hidden rounded-[22px]">
          <ScreenCalendar columns={2} />
        </div>
      </div>
    );
  }
  if (device === "tablet") {
    return (
      <div className="aspect-[4/3] w-[min(420px,80vw)] rounded-[24px] bg-[#101010] p-[12px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]">
        <div className="size-full overflow-hidden rounded-[12px]">
          <ScreenCalendar columns={3} />
        </div>
      </div>
    );
  }
  if (device === "laptop") {
    return (
      <div className="w-[min(480px,85vw)]">
        <div className="aspect-[16/10] rounded-t-[14px] bg-[#101010] p-[10px]">
          <div className="size-full overflow-hidden rounded-[4px]">
            <ScreenCalendar columns={4} />
          </div>
        </div>
        <div className="mx-[-6%] h-3 rounded-b-[10px] bg-[#cfcfcf] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)]" />
      </div>
    );
  }
  return (
    <div className="flex w-[min(460px,85vw)] flex-col items-center">
      <div className="aspect-[16/9] w-full rounded-[12px] bg-[#101010] p-[10px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]">
        <div className="size-full overflow-hidden rounded-[4px]">
          <ScreenCalendar columns={4} />
        </div>
      </div>
      <div className="h-10 w-12 bg-[#cfcfcf]" />
      <div className="h-2 w-36 rounded-full bg-[#bdbdbd]" />
    </div>
  );
}
