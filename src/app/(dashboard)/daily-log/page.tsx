import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, CheckCircle2, Info, History, AlertTriangle } from "lucide-react";
import { getDailyLog } from "./actions";
import { DailyLogTable } from "./_components/daily-log-table";
import { CloseDayDialog } from "./_components/close-day-dialog";
import { ReopenDialog } from "./_components/reopen-dialog";
import { StartDayButton } from "./_components/start-day-button";
import { SyncProductsButton } from "./_components/sync-products-button";
import { DiscardLogButton } from "./_components/discard-log-button";
import { RepairLogButton } from "./_components/repair-log-button";
import { DateNav } from "./_components/date-nav";

export const metadata = { title: "Daily Log" };

function getTodayStr(): string {
  // Nepal is UTC+5:45; derive the local date explicitly so a UTC server shows the correct day
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function DailyLogPage({ searchParams }: Props) {
  const role = await requirePermission("inventory");
  const isAdmin = role === "admin" || role === "superadmin";

  const { date: dateParam } = await searchParams;
  const todayStr = getTodayStr();
  const dateStr = dateParam ?? todayStr;

  // Validate date format
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayStr;

  const [log, productCount] = await Promise.all([
    getDailyLog(validDate),
    prisma.product.count({ where: { deletedAt: null } }),
  ]);

  const dateLabel = formatDate(validDate);
  const isToday = validDate === todayStr;
  const isClosed = log?.status === "CLOSED" || log?.status === "AUTO_ADJUSTED";
  const isOpen   = log?.status === "OPEN"   || log?.status === "REOPENED";
  const hasDelta = isClosed && (log?.items.some((i) => Math.abs(i.formulaDelta) > 0.001) ?? false);
  const prevDay  = shiftDate(validDate, -1);
  const nextDay  = shiftDate(validDate, +1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/inventory"
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-semibold">Daily Log</h1>
            {log && (
              <Badge
                variant="secondary"
                className={
                  log.status === "CLOSED"
                    ? "bg-emerald-100 text-emerald-700"
                    : log.status === "AUTO_ADJUSTED"
                    ? "bg-slate-100 text-slate-700"
                    : log.status === "REOPENED"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-amber-100 text-amber-700"
                }
              >
                {log.status === "CLOSED" ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Closed</>
                ) : log.status === "AUTO_ADJUSTED" ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Auto-adjusted</>
                ) : log.status === "REOPENED" ? (
                  <><BookOpen className="h-3 w-3 mr-1" /> Reopened</>
                ) : (
                  <><BookOpen className="h-3 w-3 mr-1" /> Open</>
                )}
              </Badge>
            )}
          </div>

          {/* Date navigation — client component handles instant navigation + calendar picker */}
          <DateNav
            validDate={validDate}
            prevDay={prevDay}
            nextDay={nextDay}
            dateLabel={dateLabel}
            isToday={isToday}
            todayStr={todayStr}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/daily-log/history"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <History className="h-4 w-4" />
            History
          </Link>
          {!isToday && (
            <Link
              href="/daily-log"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Today
            </Link>
          )}
          {isClosed && log && (
            <ReopenDialog logId={log.id} dateLabel={dateLabel} />
          )}
          {isAdmin && hasDelta && isClosed && log && (
            <RepairLogButton logId={log.id} dateLabel={dateLabel} />
          )}
          {log?.status === "OPEN" && (
            <DiscardLogButton logId={log.id} dateLabel={dateLabel} />
          )}
          {isOpen && log && (
            <CloseDayDialog logId={log.id} dateLabel={dateLabel} />
          )}
        </div>
      </div>

      {/* No log yet — start day */}
      {!log && (
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
          <div className="rounded-full bg-primary/10 p-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-1">No log for {dateLabel}</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Starting the day will snapshot current inventory as opening quantities
              for all {productCount} products.
            </p>
          </div>
          {validDate <= todayStr ? (
            <StartDayButton dateStr={validDate} productCount={productCount} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Cannot start a log for a future date.</p>
          )}
        </div>
      )}

      {/* Log exists */}
      {log && (
        <>
          {/* Closed / auto-adjusted — quiet confirmation, no colored box */}
          {log.status === "CLOSED" && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Log closed — inventory updated.
                {log.closedAt && (
                  <span className="ml-1.5 text-xs">
                    {new Date(log.closedAt).toLocaleString()}
                  </span>
                )}
              </span>
            </div>
          )}
          {log.status === "AUTO_ADJUSTED" && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Auto-adjusted after a backdated sale or return — closing quantities recalculated, stock movements unaffected.
                {log.closedAt && (
                  <span className="ml-1.5 text-xs">Originally closed {new Date(log.closedAt).toLocaleString()}</span>
                )}
              </span>
            </div>
          )}

          {/* Outdated opening — amber warning, no bg box */}
          {isOpen && log.openingOutdated && (
            <div className="flex items-start gap-2.5 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">Opening quantities may be outdated.</span>{" "}
                <span className="text-xs text-amber-600">
                  The previous day&apos;s closing changed after this log was opened. Affected rows are marked ⚠.
                  Values update automatically once the previous day is re-closed.
                </span>
              </span>
            </div>
          )}

          {/* Missing products — amber, kept as a box because it has an action button */}
          {isOpen && log.items.length < productCount && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5">
              <div className="flex items-center gap-2.5 text-sm text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  <span className="font-semibold">
                    {productCount - log.items.length} product{productCount - log.items.length !== 1 ? "s" : ""} added after this log was started.
                  </span>
                  <span className="ml-1 text-xs text-amber-700">Click to add with current stock as opening quantity.</span>
                </span>
              </div>
              <SyncProductsButton logId={log.id} missingCount={productCount - log.items.length} />
            </div>
          )}

          {/* Info tip for open logs — quiet muted callout */}
          {isOpen && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Enter today&apos;s activity below — changes save automatically. Click{" "}
                <strong className="text-foreground">Close Day</strong> when done to apply to inventory.
                <span className="block text-xs mt-0.5">
                  The <span className="font-medium text-foreground/70">Purchased</span> column is auto-pulled from today&apos;s purchase orders and is already in stock.
                </span>
              </p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Products",        value: log.items.length,                                                                                                  sub: "in this log" },
              { label: "With Activity",   value: log.items.filter((i) => i.producedQty + i.usedQty + i.soldQty + i.wasteQty + i.damagedQty > 0).length,            sub: "rows filled" },
              { label: "Purchased Today", value: log.items.filter((i) => i.purchasedQty > 0).length,                                                                sub: "products received" },
              { label: "Adjustments",     value: log.items.filter((i) => i.adjustInQty > 0.001 || i.adjustOutQty > 0.001).length,                                  sub: "items adjusted" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-lg border bg-card px-4 py-3">
                <div className="text-2xl font-bold tabular-nums">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground">{label}</span> · {sub}
                </div>
              </div>
            ))}
          </div>

          {/* Main table — key forces full remount when log changes so stale state is never shown */}
          <DailyLogTable key={log.id} items={log.items} isOpen={isOpen} />
        </>
      )}
    </div>
  );
}
