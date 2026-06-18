import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { DateFilter } from "@/components/ui/date-filter";
import { formatAmount } from "@/lib/format";
import { Banknote, Calendar, BookOpen, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { ReceiptFormDialog } from "./_components/receipt-form-dialog";
import { ReceiptTable } from "./_components/receipt-table";
import { ReceiptPaymentFormDialog } from "./_components/receipt-payment-form-dialog";
import { ReceiptPaymentTable } from "./_components/receipt-payment-table";
import { receiptsLedgerHref } from "@/lib/receipt-nav";

export const metadata = { title: "Receipts" };

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function ReceiptsPage({ searchParams }: Props) {
  await requirePermission("receipts");

  const { from: rawFrom, to: rawTo } = await searchParams;

  const dateWhere = rawFrom || rawTo ? {
    ...(rawFrom ? { gte: new Date(rawFrom + "T00:00:00.000Z") } : {}),
    ...(rawTo   ? { lte: new Date(rawTo   + "T23:59:59.999Z") } : {}),
  } : undefined;

  const [receipts, payments] = await Promise.all([
    prisma.receipt.findMany({
      where:   { deletedAt: null, ...(dateWhere ? { receivedAt: dateWhere } : {}) },
      orderBy: { receivedAt: "desc" },
      take:    500,
    }),
    prisma.receiptPayment.findMany({
      where:   { deletedAt: null, ...(dateWhere ? { paidAt: dateWhere } : {}) },
      orderBy: { paidAt: "desc" },
      take:    500,
    }),
  ]);

  const serialisedReceipts = receipts.map((r) => ({
    id:            r.id,
    receiptNumber: r.receiptNumber,
    receivedFrom:  r.receivedFrom,
    amount:        Number(r.amount),
    method:        r.method,
    reference:     r.reference,
    notes:         r.notes,
    photoUrl:      r.photoUrl,
    receivedAt:    r.receivedAt.toISOString(),
  }));

  const serialisedPayments = payments.map((p) => ({
    id:            p.id,
    paymentNumber: p.paymentNumber,
    paidTo:        p.paidTo,
    amount:        Number(p.amount),
    method:        p.method,
    reference:     p.reference,
    notes:         p.notes,
    photoUrl:      p.photoUrl,
    paidAt:        p.paidAt.toISOString(),
  }));

  const totalReceived  = serialisedReceipts.reduce((sum, r) => sum + r.amount, 0);
  const totalPaid      = serialisedPayments.reduce((sum, p) => sum + p.amount, 0);
  const netBalance     = totalReceived - totalPaid;

  const now = new Date();
  const thisMonthReceipts = serialisedReceipts
    .filter((r) => {
      const d = new Date(r.receivedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Receipts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track money borrowed or received, and payments made back
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={receiptsLedgerHref(rawFrom, rawTo)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Ledger
          </Link>
          <ReceiptFormDialog mode="create" />
        </div>
      </div>

      {/* Date filter */}
      <div className="shrink-0 -mt-2">
        <Suspense>
          <DateFilter from={rawFrom} to={rawTo} />
        </Suspense>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 shrink-0">
        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Received</p>
            <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatAmount(totalReceived)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{rawFrom || rawTo ? "Filtered period" : "All time"}</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Paid Out</p>
            <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatAmount(totalPaid)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{rawFrom || rawTo ? "Filtered period" : "All time"}</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Balance</p>
            <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className={`text-2xl font-bold mt-1 ${netBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatAmount(netBalance)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Received minus paid out</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Month</p>
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-1">{formatAmount(thisMonthReceipts)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Receipts this month</p>
        </div>
      </div>

      {/* Receipts (money in) */}
      <section className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-green-600" />
            <h2 className="text-lg font-semibold">Money Received</h2>
            <span className="text-sm text-muted-foreground">({serialisedReceipts.length})</span>
          </div>
        </div>
        <ReceiptTable receipts={serialisedReceipts} />
      </section>

      {/* Payments (money out) */}
      <section className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-red-500" />
            <h2 className="text-lg font-semibold">Payments Made</h2>
            <span className="text-sm text-muted-foreground">({serialisedPayments.length})</span>
          </div>
          <ReceiptPaymentFormDialog mode="create" />
        </div>
        <ReceiptPaymentTable payments={serialisedPayments} />
      </section>
    </div>
  );
}
