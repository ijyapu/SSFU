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
  await requirePermission("inventory");

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
                    ? "bg-green-100 text-green-700"
                    : log.status === "AUTO_ADJUSTED"
                    ? "bg-purple-100 text-purple-700"
                    : log.status === "REOPENED"
                    ? "bg-blue-100 text-blue-700"
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
          {/* Info banner for closed logs */}
          {log.status === "CLOSED" && (
            <div className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                This log is closed. All activity has been applied to inventory.
                {log.closedAt && (
                  <span className="block text-xs text-green-600 mt-0.5">
                    Closed on {new Date(log.closedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
          {log.status === "AUTO_ADJUSTED" && (
            <div className="flex items-start gap-3 rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                This log was auto-adjusted after a backdated sale or return changed the figures.
                The closing quantities have been recalculated. Stock movements are unaffected.
                {log.closedAt && (
                  <span className="block text-xs text-purple-600 mt-0.5">
                    Originally closed on {new Date(log.closedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Outdated opening warning */}
          {isOpen && log.openingOutdated && (
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Opening quantities may be outdated.</p>
                <p className="text-xs text-amber-800 mt-1">
                  The previous day&apos;s closing figures changed after this log was opened
                  (likely because that day was reopened and re-edited).
                  One or more products have opening values that no longer match the previous closing.
                  These will update automatically once the previous day is re-closed.
                </p>
              </div>
            </div>
          )}

          {/* Missing products banner */}
          {isOpen && log.items.length < productCount && (
            <div className="flex items-center justify-between gap-4 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3">
              <div className="flex items-start gap-3 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">
                    {productCount - log.items.length} product{productCount - log.items.length !== 1 ? "s" : ""} added after this log was started
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    New products are not included automatically. Click to add them with their current stock as the opening quantity.
                  </p>
                </div>
              </div>
              <SyncProductsButton logId={log.id} missingCount={productCount - log.items.length} />
            </div>
          )}

          {/* Info tip for open logs */}
          {isOpen && (
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Enter today&apos;s activity below. Changes save automatically.
                Click <strong>Close Day</strong> when done to apply activity to inventory.
                <span className="block text-xs text-blue-600 mt-0.5">
                  Purchases recorded today appear in the <span className="font-medium">Purchased</span> column automatically.
                  They are already in stock — Close Day will not re-add them.
                </span>
              </div>
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
