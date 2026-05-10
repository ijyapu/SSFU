import { Suspense } from "react";
import Link from "next/link";
import { parseISO, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { COMPANY } from "@/lib/company";
import { ArrowLeft } from "lucide-react";
import { LedgerControls } from "./_components/ledger-controls";
import { receiptsListHref } from "@/lib/receipt-nav";

export const metadata = { title: "Receipt Ledger" };

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", BANK_TRANSFER: "Bank Transfer", CHECK: "Cheque",
  ESEWA: "eSewa", KHALTI: "Khalti", IME_PAY: "IME Pay",
  FONEPAY: "FonePay", OTHER: "Other",
};

function fmtAmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ReceiptLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("receipts");
  const { from: rawFrom, to: rawTo } = await searchParams;

  const from = rawFrom ? parseISO(rawFrom) : undefined;
  const to   = rawTo   ? parseISO(rawTo)   : undefined;

  const receipts = await prisma.receipt.findMany({
    where: {
      deletedAt: null,
      ...(from || to
        ? {
            receivedAt: {
              ...(from ? { gte: from } : {}),
              ...(to   ? { lte: new Date(to.getTime() + 86_399_999) } : {}),
            },
          }
        : {}),
    },
    orderBy: { receivedAt: "asc" },
  });

  const rows = receipts.map((r) => ({
    id:            r.id,
    receiptNumber: r.receiptNumber,
    receivedFrom:  r.receivedFrom,
    amount:        Number(r.amount),
    method:        r.method,
    reference:     r.reference,
    notes:         r.notes,
    receivedAt:    r.receivedAt,
  }));

  // Group by month
  type MonthGroup = {
    label: string;
    entries: typeof rows;
    monthTotal: number;
  };

  const groups: MonthGroup[] = [];
  const groupMap = new Map<string, number>();

  for (const row of rows) {
    const key = format(row.receivedAt, "yyyy-MM");
    const label = format(row.receivedAt, "MMMM yyyy");
    if (!groupMap.has(key)) {
      groupMap.set(key, groups.length);
      groups.push({ label, entries: [], monthTotal: 0 });
    }
    const g = groups[groupMap.get(key)!]!;
    g.entries.push(row);
    g.monthTotal += row.amount;
  }

  // Running balance and grand total
  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);

  // Method breakdown
  const methodTotals = new Map<string, number>();
  for (const r of rows) {
    methodTotals.set(r.method, (methodTotals.get(r.method) ?? 0) + r.amount);
  }
  const methodBreakdown = [...methodTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([method, total]) => ({ method, total }));

  // Period label
  const periodLabel =
    from && to ? `${format(from, "d MMM yyyy")} — ${format(to, "d MMM yyyy")}`
    : from     ? `From ${format(from, "d MMM yyyy")}`
    : to       ? `Up to ${format(to, "d MMM yyyy")}`
    : "All Time";

  let runningBalance = 0;

  return (
    <>
      {/* Print CSS — isolates the ledger area */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-ledger, #receipt-ledger * { visibility: visible; }
          #receipt-ledger { position: absolute; inset: 0; }
          @page { size: A4 portrait; margin: 1.2cm 1.5cm; }
        }
      `}</style>

      <div className="space-y-4 pb-8">
        {/* Screen-only controls */}
        <div className="space-y-3 no-print">
          <div className="flex items-center gap-3">
            <Link
              href={receiptsListHref(rawFrom, rawTo)}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Back to Receipts"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">Receipt Ledger</h1>
              <p className="text-sm text-muted-foreground">Printable ledger of all received funds</p>
            </div>
          </div>
          <Suspense>
            <LedgerControls from={rawFrom} to={rawTo} />
          </Suspense>
        </div>

        {/* ── Ledger ── */}
        <div id="receipt-ledger" className="font-sans text-sm text-gray-900">

          {/* Company header */}
          <div className="text-center mb-5 pb-4 border-b-2 border-red-700">
            <p className="text-base font-bold uppercase tracking-widest text-red-700">{COMPANY.name}</p>
            <p className="text-xs text-red-700 mt-0.5">{COMPANY.address} &nbsp;|&nbsp; {COMPANY.phone} &nbsp;|&nbsp; PAN: {COMPANY.pan}</p>
            <p className="text-xl font-bold mt-1 text-red-700">RECEIPT LEDGER</p>
            <div className="flex justify-between items-end mt-2 text-xs text-gray-600">
              <span>Period: <span className="font-semibold text-gray-900">{periodLabel}</span></span>
              <span>{rows.length} entr{rows.length !== 1 ? "ies" : "y"}</span>
              <span>Generated: {format(new Date(), "d MMM yyyy, h:mm a")}</span>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-center py-12 text-gray-500">No receipts in this period.</p>
          ) : (
            <>
              {/* Ledger table */}
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-y-2 border-gray-900">
                    <th className="py-1.5 pr-2 text-left font-bold w-6">#</th>
                    <th className="py-1.5 pr-3 text-left font-bold w-20">Date</th>
                    <th className="py-1.5 pr-3 text-left font-bold w-24">Receipt No.</th>
                    <th className="py-1.5 pr-3 text-left font-bold">Received From</th>
                    <th className="py-1.5 pr-3 text-left font-bold w-20">Method</th>
                    <th className="py-1.5 pr-3 text-left font-bold w-24">Reference</th>
                    <th className="py-1.5 pr-0 text-right font-bold w-24">Amount (Rs)</th>
                    <th className="py-1.5 pl-3 text-right font-bold w-24">Running Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group, gi) => {
                    return (
                      <>
                        {/* Month header row */}
                        <tr key={`hdr-${gi}`} className="bg-gray-100 border-t border-gray-300">
                          <td
                            colSpan={8}
                            className="py-1 px-1 font-bold text-xs uppercase tracking-wider text-gray-700"
                          >
                            {group.label}
                          </td>
                        </tr>

                        {/* Entry rows */}
                        {group.entries.map((r, idx) => {
                          runningBalance += r.amount;
                          const isEven = idx % 2 === 0;
                          return (
                            <tr
                              key={r.id}
                              className={`border-b border-gray-200 ${isEven ? "" : "bg-gray-50/60"}`}
                            >
                              <td className="py-1 pr-2 text-gray-500 tabular-nums">
                                {rows.indexOf(r) + 1}
                              </td>
                              <td className="py-1 pr-3 tabular-nums whitespace-nowrap">
                                {format(r.receivedAt, "d MMM yy")}
                              </td>
                              <td className="py-1 pr-3 font-mono text-gray-700">
                                {r.receiptNumber}
                              </td>
                              <td className="py-1 pr-3 font-medium">
                                {r.receivedFrom}
                                {r.notes && (
                                  <span className="block text-gray-500 font-normal text-[10px] leading-tight">
                                    {r.notes}
                                  </span>
                                )}
                              </td>
                              <td className="py-1 pr-3 text-gray-700">
                                {METHOD_LABELS[r.method] ?? r.method}
                              </td>
                              <td className="py-1 pr-3 text-gray-600">
                                {r.reference ?? "—"}
                              </td>
                              <td className="py-1 pr-0 text-right tabular-nums font-semibold">
                                {fmtAmt(r.amount)}
                              </td>
                              <td className="py-1 pl-3 text-right tabular-nums text-gray-600">
                                {fmtAmt(runningBalance)}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Month subtotal row */}
                        <tr key={`sub-${gi}`} className="border-t border-gray-400 bg-gray-50">
                          <td colSpan={6} className="py-1 pr-3 text-right text-xs font-semibold text-gray-700 italic">
                            {group.label} Total
                          </td>
                          <td className="py-1 pr-0 text-right tabular-nums font-bold border-t border-gray-400">
                            {fmtAmt(group.monthTotal)}
                          </td>
                          <td className="py-1 pl-3 text-right tabular-nums text-gray-500 border-t border-gray-400" />
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>

              {/* Grand total */}
              <div className="mt-4 border-t-2 border-gray-900 pt-3">
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="font-bold uppercase tracking-wide text-gray-900 py-1">
                        GRAND TOTAL
                      </td>
                      <td className="text-right tabular-nums font-bold text-lg text-gray-900 py-1">
                        Rs {fmtAmt(grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Method breakdown */}
              {methodBreakdown.length > 1 && (
                <div className="mt-4 pt-3 border-t border-gray-300">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-2">
                    Breakdown by Payment Method
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left pb-1 font-semibold text-gray-700">Method</th>
                        <th className="text-right pb-1 font-semibold text-gray-700">Amount (Rs)</th>
                        <th className="text-right pb-1 font-semibold text-gray-700">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {methodBreakdown.map(({ method, total }) => (
                        <tr key={method} className="border-b border-gray-100">
                          <td className="py-0.5">{METHOD_LABELS[method] ?? method}</td>
                          <td className="py-0.5 text-right tabular-nums font-medium">
                            {fmtAmt(total)}
                          </td>
                          <td className="py-0.5 text-right tabular-nums text-gray-500">
                            {((total / grandTotal) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-400 font-bold">
                        <td className="pt-1">Total</td>
                        <td className="pt-1 text-right tabular-nums">{fmtAmt(grandTotal)}</td>
                        <td className="pt-1 text-right tabular-nums">100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 pt-3 border-t border-gray-300 flex justify-between text-[10px] text-gray-500">
                <span>{COMPANY.name} — Confidential</span>
                <span>Printed on {format(new Date(), "d MMMM yyyy")}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
