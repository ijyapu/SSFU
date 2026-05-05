import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { getCashFlow } from "./actions";
import { CashFlowDays } from "./_components/cash-flow-days";
import { DeferredPanel } from "./_components/deferred-panel";
import { OpeningBalanceForm } from "./_components/opening-balance-form";
import { DateFilter } from "@/components/ui/date-filter";
import {
  ArrowDownLeft, ArrowUpRight, TrendingUp, Banknote, Info,
} from "lucide-react";

export const metadata = { title: "Cash Flow" };

function getTodayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
}

function getMonthStart(todayStr: string): string {
  return todayStr.slice(0, 8) + "01";
}

function fmtRs(n: number): string {
  return "Rs " + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function CashFlowPage({ searchParams }: Props) {
  const role = await requirePermission("cashFlow");

  const params   = await searchParams;
  const todayStr = getTodayStr();

  const validDate = (s?: string) =>
    s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;

  const from = validDate(params.from) ?? getMonthStart(todayStr);
  const to   = validDate(params.to)   ?? todayStr;

  const data = await getCashFlow(from, to);
  const canEdit = role === "admin" || role === "superadmin";
  const net = data.totalIn - data.totalOut;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Cash Flow</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tracks actual cash movements — when money physically enters or leaves.
          </p>
        </div>
        <OpeningBalanceForm current={data.cashOpeningBalance} canEdit={canEdit} />
      </div>

      {/* Date filter */}
      <Suspense>
        <DateFilter from={from} to={to} />
      </Suspense>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Banknote className="h-3.5 w-3.5" />
            Opening Balance
          </div>
          <div className="text-xl font-bold tabular-nums">{fmtRs(data.periodOpeningBalance)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">start of period</div>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
            Total Inflows
          </div>
          <div className="text-xl font-bold tabular-nums text-green-700">{fmtRs(data.totalIn)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">cash received</div>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />
            Total Outflows
          </div>
          <div className="text-xl font-bold tabular-nums text-red-700">{fmtRs(data.totalOut)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">cash paid out</div>
        </div>

        <div className={`rounded-lg border bg-card px-4 py-3 ${net >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Closing Balance
          </div>
          <div className={`text-xl font-bold tabular-nums ${net >= 0 ? "text-green-700" : "text-red-700"}`}>
            {fmtRs(data.periodClosingBalance)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {net >= 0 ? `+${fmtRs(net)} net inflow` : `−${fmtRs(Math.abs(net))} net outflow`}
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          Inflows: sales receipts and cash received.
          Outflows: supplier &amp; vendor payments, approved expenses, payroll disbursements, and salary advances.
          <span className="block text-xs text-blue-600 mt-0.5">
            Click any row with activity to expand and see individual transactions. Backdated corrections reflect automatically.
          </span>
        </div>
      </div>

      {/* Daily table */}
      {data.days.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
          <Banknote className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No days in selected range.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <CashFlowDays days={data.days} todayStr={todayStr} />
        </div>
      )}

      {/* Deferred obligations */}
      <DeferredPanel items={data.deferred} />
    </div>
  );
}
