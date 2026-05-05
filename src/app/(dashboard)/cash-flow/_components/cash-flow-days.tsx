"use client";

import { useState } from "react";
import {
  ChevronRight, ChevronDown,
  ArrowDownLeft, ArrowUpRight,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DayCashFlow, CashEntry } from "../actions";

function fmtRs(n: number): string {
  return "Rs " + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  "Sales (gross)":    "bg-emerald-100 text-emerald-700",
  "Commission":       "bg-amber-100 text-amber-700",
  "Receipt":          "bg-emerald-100 text-emerald-700",
  "Supplier Payment": "bg-slate-100 text-slate-700",
  "Vendor Payment":   "bg-slate-100 text-slate-700",
  "Expense":          "bg-red-100 text-red-700",
  "Payroll":          "bg-red-100 text-red-700",
  "Salary Advance":   "bg-red-100 text-red-700",
};

function EntryRow({ entry }: { entry: CashEntry }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2">
        <span className={cn("inline-block rounded px-1.5 py-0.5 text-[11px] font-medium", CATEGORY_COLORS[entry.category] ?? "bg-muted text-muted-foreground")}>
          {entry.category}
        </span>
      </td>
      <td className="px-3 py-2 text-sm font-medium">{entry.subcategory}</td>
      <td className="px-3 py-2 text-sm text-muted-foreground max-w-50 truncate">{entry.description}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{entry.method ?? "—"}</td>
      <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">
        <span className={entry.direction === "in" ? "text-green-700" : "text-red-700"}>
          {entry.direction === "in" ? "+" : "−"}{fmtRs(entry.amount)}
        </span>
      </td>
    </tr>
  );
}

function DayRow({ day, isToday }: { day: DayCashFlow; isToday: boolean }) {
  const hasActivity = day.inflows.length + day.outflows.length > 0;
  const [expanded, setExpanded] = useState(false);
  const net = day.totalIn - day.totalOut;

  return (
    <div className="border-b last:border-0">
      {/* Summary row */}
      <button
        onClick={() => hasActivity && setExpanded(!expanded)}
        disabled={!hasActivity}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-3 text-left transition-colors",
          hasActivity && "hover:bg-muted/30 cursor-pointer",
          !hasActivity && "cursor-default opacity-70",
          expanded && "bg-muted/20",
        )}
      >
        {/* Expand icon */}
        <span className="w-4 shrink-0 text-muted-foreground">
          {hasActivity ? (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <Minus className="h-3 w-3 opacity-30" />}
        </span>

        {/* Date */}
        <span className="w-52 shrink-0 text-sm font-medium">
          {fmtDate(day.dateStr)}
          {isToday && <span className="ml-2 text-xs text-primary font-normal">(today)</span>}
        </span>

        {/* Opening balance */}
        <span className="hidden sm:block w-32 text-right tabular-nums text-xs text-muted-foreground">
          {fmtRs(day.openingBalance)}
        </span>

        {/* Inflows */}
        <span className="hidden md:flex w-28 items-center justify-end gap-1 tabular-nums text-xs text-green-700">
          {day.totalIn > 0 && <><ArrowDownLeft className="h-3 w-3" />{fmtRs(day.totalIn)}</>}
        </span>

        {/* Outflows */}
        <span className="hidden md:flex w-28 items-center justify-end gap-1 tabular-nums text-xs text-red-700">
          {day.totalOut > 0 && <><ArrowUpRight className="h-3 w-3" />{fmtRs(day.totalOut)}</>}
        </span>

        {/* Net */}
        <span className={cn(
          "ml-auto hidden sm:block w-24 text-right tabular-nums text-xs font-medium",
          net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-muted-foreground",
        )}>
          {net > 0 ? "+" : net < 0 ? "−" : ""}{net !== 0 ? fmtRs(net) : "—"}
        </span>

        {/* Closing balance */}
        <span className="w-32 text-right tabular-nums text-sm font-semibold">
          {fmtRs(day.closingBalance)}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-8 pb-4 space-y-3 bg-muted/10">
          {day.inflows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                <ArrowDownLeft className="h-3 w-3" /> Inflows ({day.inflows.length})
              </p>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Category</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">From</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Method</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>{day.inflows.map((e) => <EntryRow key={e.id} entry={e} />)}</tbody>
                </table>
              </div>
            </div>
          )}

          {day.outflows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> Outflows ({day.outflows.length})
              </p>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Category</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">To</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Method</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>{day.outflows.map((e) => <EntryRow key={e.id} entry={e} />)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  days: DayCashFlow[];
  todayStr: string;
};

export function CashFlowDays({ days, todayStr }: Props) {
  const [allExpanded, setAllExpanded] = useState(false);

  // Track which days are individually toggled (used only when not in "expand all" mode)
  const activeDays = days.filter((d) => d.inflows.length + d.outflows.length > 0);

  return (
    <div>
      {/* Table header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
        <span className="w-4 shrink-0" />
        <span className="w-52 shrink-0">Date</span>
        <span className="hidden sm:block w-32 text-right">Opening</span>
        <span className="hidden md:block w-28 text-right">Inflow</span>
        <span className="hidden md:block w-28 text-right">Outflow</span>
        <span className="hidden sm:block ml-auto w-24 text-right">Net</span>
        <span className="w-32 text-right">Closing</span>
      </div>

      {days.map((day) => (
        <DayRow key={day.dateStr} day={day} isToday={day.dateStr === todayStr} />
      ))}
    </div>
  );
}
