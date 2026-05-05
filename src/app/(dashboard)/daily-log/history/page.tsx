import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, BookOpen, CheckCircle2, TrendingUp, TrendingDown,
  ExternalLink,
} from "lucide-react";
import { getDailyLogHistory } from "../actions";
import { ReopenDialog } from "../_components/reopen-dialog";

export const metadata = { title: "Daily Log History" };

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmt(n: number) {
  if (n === 0) return "—";
  return parseFloat(n.toFixed(3)).toString();
}

export default async function DailyLogHistoryPage() {
  const role = await requirePermission("inventory");
  const isAdmin = role === "admin" || role === "superadmin";

  const logs = await getDailyLogHistory(60); // last 60 days

  const openCount = logs.filter((l) => l.status === "OPEN" || l.status === "REOPENED").length;
  const closedCount = logs.filter((l) => l.status === "CLOSED" || l.status === "AUTO_ADJUSTED").length;
  const totalAdjusted = logs.reduce((s, l) => s + l.adjustCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/daily-log"
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-semibold">Daily Log History</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-9">
            Last 60 days · {logs.length} logs
          </p>
        </div>

        <Link
          href="/daily-log"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <BookOpen className="h-4 w-4" />
          Today&apos;s Log
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Logs", value: logs.length, sub: "last 60 days" },
          { label: "Open", value: openCount, sub: "not yet closed", warn: openCount > 1 },
          { label: "Closed", value: closedCount, sub: "completed days" },
          { label: "Adjustments", value: totalAdjusted, sub: "items adjusted", alert: false },
        ].map(({ label, value, sub, alert, warn }) => (
          <div key={label} className="rounded-lg border bg-card px-4 py-3">
            <div className={`text-2xl font-bold tabular-nums ${alert && value > 0 ? "text-amber-600" : warn && value > 0 ? "text-blue-600" : ""}`}>
              {value}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground">{label}</span> · {sub}
            </div>
          </div>
        ))}
      </div>

      {/* History table */}
      {logs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 py-16 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No logs yet</p>
          <p className="text-sm mt-1">Start your first daily log to see history here.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right text-emerald-700">Produced</TableHead>
                <TableHead className="text-right text-orange-600">Used</TableHead>
                <TableHead className="text-right text-rose-600">Sold</TableHead>
                <TableHead className="text-right text-rose-600">Waste</TableHead>
                <TableHead className="text-right">Adjustments</TableHead>
                <TableHead>Closed at</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="align-middle">
                  {/* Date */}
                  <TableCell>
                    <Link
                      href={`/daily-log?date=${log.logDate}`}
                      className="font-medium text-sm hover:underline flex items-center gap-1"
                    >
                      {formatDate(log.logDate)}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        log.status === "CLOSED"
                          ? "bg-emerald-100 text-emerald-700"
                          : log.status === "AUTO_ADJUSTED"
                          ? "bg-blue-100 text-blue-700"
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
                  </TableCell>

                  {/* Active rows */}
                  <TableCell className="text-right tabular-nums text-sm">
                    <span className={log.activeCount > 0 ? "text-foreground" : "text-muted-foreground"}>
                      {log.activeCount}
                      <span className="text-muted-foreground">/{log.productCount}</span>
                    </span>
                  </TableCell>

                  {/* Produced */}
                  <TableCell className="text-right tabular-nums text-sm">
                    {log.totalProduced > 0 ? (
                      <span className="text-emerald-700 flex items-center justify-end gap-0.5">
                        <TrendingUp className="h-3 w-3" />
                        {fmt(log.totalProduced)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {/* Used */}
                  <TableCell className="text-right tabular-nums text-sm text-orange-600">
                    {fmt(log.totalUsed)}
                  </TableCell>

                  {/* Sold */}
                  <TableCell className="text-right tabular-nums text-sm text-rose-600">
                    {fmt(log.totalSold)}
                  </TableCell>

                  {/* Waste */}
                  <TableCell className="text-right tabular-nums text-sm">
                    {log.totalWaste > 0 ? (
                      <span className="text-rose-500 flex items-center justify-end gap-0.5">
                        <TrendingDown className="h-3 w-3" />
                        {fmt(log.totalWaste)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {/* Adjustments */}
                  <TableCell className="text-right tabular-nums text-sm">
                    {log.adjustCount > 0 ? (
                      <span className="text-teal-700 font-medium tabular-nums">
                        {log.adjustCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {/* Closed at */}
                  <TableCell className="text-sm text-muted-foreground">
                    {log.closedAt
                      ? new Date(log.closedAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/daily-log?date=${log.logDate}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        View
                      </Link>
                      {isAdmin && (log.status === "CLOSED" || log.status === "AUTO_ADJUSTED") && (
                        <ReopenDialog
                          logId={log.id}
                          dateLabel={formatDate(log.logDate)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
