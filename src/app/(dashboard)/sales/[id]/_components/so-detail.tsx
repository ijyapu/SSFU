"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DateDisplay } from "@/components/ui/date-display";
import {
  CheckCircle, XCircle, CreditCard, Loader2, Pencil, AlertTriangle, Printer, SquarePen, Trash2,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ERPSection } from "@/components/ui/erp-section";
import { SortButton } from "@/components/ui/sort-icon";
import { formatAmount, formatQty } from "@/lib/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { SoPaymentForm, type ExistingPayment } from "./so-payment-form";
import { ReturnFormInline } from "./return-form-inline";
import { confirmSalesOrder, voidSalesOrder, markSalesOrderLost, deleteSalesmanPayment } from "../../actions";

const STATUS_CONFIG = {
  DRAFT:          { label: "Draft",              className: "bg-muted text-muted-foreground" },
  CONFIRMED:      { label: "Confirmed",          className: "bg-slate-100 text-slate-700" },
  PARTIALLY_PAID: { label: "Partial Payment",    className: "bg-amber-100 text-amber-700" },
  PAID:           { label: "Paid",               className: "bg-emerald-100 text-emerald-700" },
  CANCELLED:      { label: "Voided",             className: "bg-red-100 text-red-700" },
  LOST:           { label: "Lost / Not Returned", className: "bg-red-100 text-red-700" },
} as const;

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", BANK_TRANSFER: "Bank Transfer", CHECK: "Cheque", OTHER: "Other",
};

type SoItem = {
  id: string;
  productId: string;
  productName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type Payment = {
  id:        string;
  amount:    number;
  method:    string;
  reference: string | null;
  notes:     string | null;
  paidAt:    string;
};

type ReturnItem = {
  id:          string;
  productId:   string;
  productName: string;
  unitName:    string;
  quantity:    number;
  unitPrice:   number;
  totalPrice:  number;
};

type SalesReturn = {
  id: string;
  returnNumber: string;
  returnType: "WASTE" | "FRESH";
  notes: string | null;
  totalAmount: number;
  createdAt: string;
  items: ReturnItem[];
};

type Product = { id: string; name: string; unitName: string; sellingPrice: number };

type Props = {
  id: string;
  orderNumber: string;
  status: keyof typeof STATUS_CONFIG;
  customerName: string;
  orderDate: string;
  notes: string | null;
  subtotal: number;
  totalAmount: number;
  commissionPct: number;
  commissionAmount: number;
  factoryAmount: number;
  amountPaid: number;
  items: SoItem[];
  payments: Payment[];
  returns: SalesReturn[];
  products: Product[];
  salesmanTotalOutstanding: number;
  editHref?: string;
};

export function SoDetail(props: Props) {
  const {
    id, orderNumber, status, customerName, orderDate,
    notes, totalAmount, commissionPct, commissionAmount, factoryAmount,
    amountPaid, items, payments, returns, products, salesmanTotalOutstanding,
    editHref,
  } = props;

  const [paymentOpen,    setPaymentOpen]    = useState(false);
  const [editingPayment, setEditingPayment] = useState<ExistingPayment | undefined>(undefined);
  const [confirming,   setConfirming]   = useState(false);
  const [voidOpen,     setVoidOpen]     = useState(false);
  const [voiding,      setVoiding]      = useState(false);
  const [lostOpen,     setLostOpen]     = useState(false);
  const [markingLost,  setMarkingLost]  = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [deletePaymentPending, startDeletePayment] = useTransition();

  function handleDeletePayment() {
    if (!deletingPaymentId) return;
    startDeletePayment(async () => {
      try {
        await deleteSalesmanPayment(deletingPaymentId);
        toast.success("Payment deleted.");
        setDeletingPaymentId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete payment.");
      }
    });
  }
  const { sortKey, sortDir, toggle }    = useSortable("productName");

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const aVals: Record<string, string | number> = { productName: a.productName, quantity: a.quantity, unitPrice: a.unitPrice, totalPrice: a.totalPrice };
      const bVals: Record<string, string | number> = { productName: b.productName, quantity: b.quantity, unitPrice: b.unitPrice, totalPrice: b.totalPrice };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [items, sortKey, sortDir]);

  const wasteReturns  = returns.filter((r) => r.returnType !== "FRESH");
  const freshReturns  = returns.filter((r) => r.returnType === "FRESH");
  const totalReturns  = returns.reduce((sum, r) => sum + r.totalAmount, 0);
  const netAmount     = totalAmount - totalReturns;
  const outstanding   = factoryAmount - amountPaid;
  const cfg           = STATUS_CONFIG[status];

  const isActive   = status === "CONFIRMED" || status === "PARTIALLY_PAID" || status === "PAID";
  const isTerminal = status === "CANCELLED" || status === "LOST";
  const isDraft    = status === "DRAFT";

  const canRecordReturn  = isActive;
  const canVoid          = !isTerminal;
  const canMarkLost      = !isDraft && !isTerminal;
  const canRecordPayment = isActive;
  const canEdit          = !isTerminal;

  async function handleConfirm() {
    setConfirming(true);
    try {
      await confirmSalesOrder(id);
      toast.success("Order confirmed — stock deducted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to confirm order");
    } finally {
      setConfirming(false);
    }
  }

  async function handleVoid() {
    setVoiding(true);
    try {
      await voidSalesOrder(id);
      const msg = status === "PAID"
        ? `Sale voided — stock restored. Refund ${formatAmount(amountPaid)} to the customer.`
        : (status === "CONFIRMED" || status === "PARTIALLY_PAID")
        ? "Sale voided — stock restored to inventory"
        : "Sale voided";
      toast.success(msg, { duration: 6000 });
      setVoidOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to void sale");
    } finally {
      setVoiding(false);
    }
  }

  async function handleMarkLost() {
    setMarkingLost(true);
    try {
      await markSalesOrderLost(id);
      toast.success("Order marked as lost — stock NOT restored");
      setLostOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark order as lost");
    } finally {
      setMarkingLost(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={`${cfg.className} text-sm px-3 py-1`}>
            {cfg.label}
          </Badge>
          <span className="text-muted-foreground text-sm">
            <DateDisplay date={orderDate} />
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/sales/${id}/print`}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Printer className="h-4 w-4" />
            Print Invoice
          </Link>
          {canEdit && (
            <Link
              href={editHref ?? `/sales/${id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Pencil className="h-4 w-4" />
              Edit Order
            </Link>
          )}
          {isDraft && (
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Confirm &amp; Dispatch
            </Button>
          )}
          {canVoid && (
            <Button variant="outline" onClick={() => setVoidOpen(true)}>
              <XCircle className="h-4 w-4" />
              Void Sale
            </Button>
          )}
          {canMarkLost && (
            <Button
              variant="outline"
              onClick={() => setLostOpen(true)}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <AlertTriangle className="h-4 w-4" />
              Mark as Lost
            </Button>
          )}
          {canRecordPayment && (
            <Button onClick={() => { setEditingPayment(undefined); setPaymentOpen(true); }}>
              <CreditCard className="h-4 w-4" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Banner for voided orders */}
      {status === "CANCELLED" && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>
              <span className="font-medium">Sale Voided.</span>{" "}
              This sale was cancelled and all dispatched stock has been restored to inventory.
            </p>
            {amountPaid > 0.001 && (
              <p className="font-semibold">
                {formatAmount(amountPaid)} was collected — a refund must be issued to the customer.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Banner for lost orders */}
      {status === "LOST" && (
        <div className="flex items-start gap-3 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>
              <span className="font-medium">Dispatched — Not Returned.</span>{" "}
              Goods were physically taken and will not come back. Stock was NOT restored.
            </p>
            {amountPaid > 0.001 ? (
              <p>
                {formatAmount(amountPaid)} was already collected.
                The business absorbs the physical loss — no refund is issued.
              </p>
            ) : (
              <p>The outstanding balance has been waived and is excluded from collections.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Items + order info */}
        <div className="lg:col-span-2 space-y-4">
          <ERPSection header={<p className="text-sm font-medium text-muted-foreground">Order Details</p>}>
            <div className="px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salesman</span>
                <span className="font-medium">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Number</span>
                <span className="font-mono">{orderNumber}</span>
              </div>
              {notes && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Notes</span>
                  <span className="text-right">{notes}</span>
                </div>
              )}
            </div>
          </ERPSection>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                {(() => { const sp = { sortKey, sortDir, toggle }; return (
                <TableRow className="bg-muted/40">
                  <TableHead><SortButton col="productName" label="Product"    {...sp} /></TableHead>
                  <TableHead numeric><SortButton col="quantity"   label="Qty"        {...sp} className="justify-end" /></TableHead>
                  <TableHead numeric><SortButton col="unitPrice"  label="Unit Price" {...sp} className="justify-end" /></TableHead>
                  <TableHead numeric><SortButton col="totalPrice" label="Total"      {...sp} className="justify-end" /></TableHead>
                </TableRow>
                ); })()}
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">{item.unitName}</div>
                    </TableCell>
                    <TableCell numeric>
                      {formatQty(item.quantity)}
                    </TableCell>
                    <TableCell numeric className="text-muted-foreground">
                      {formatAmount(item.unitPrice)}
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {formatAmount(item.totalPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <ERPSection header={<p className="text-sm font-medium text-muted-foreground">Summary</p>}>
            <div className="px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Taken</span>
                <span>{formatAmount(totalAmount)}</span>
              </div>

              {totalReturns > 0.001 && (
                <div className="flex justify-between text-orange-600">
                  <span>Returns Deducted</span>
                  <span>− {formatAmount(totalReturns)}</span>
                </div>
              )}

              {totalReturns > 0.001 && (
                <>
                  <div className="border-t" />
                  <div className="flex justify-between text-muted-foreground">
                    <span>Net Amount</span>
                    <span>{formatAmount(netAmount)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-amber-600">
                <span className="flex items-center gap-1">
                  Commission
                  <span className="text-xs bg-amber-100 text-amber-700 rounded px-1 py-0.5 font-mono">
                    {netAmount.toFixed(2)} × {commissionPct}%
                  </span>
                </span>
                <span>− {formatAmount(commissionAmount)}</span>
              </div>

              <div className="border-t" />

              <div className="flex justify-between font-semibold">
                <span>Factory Amount</span>
                <span>{formatAmount(factoryAmount)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Collected</span>
                <span>{formatAmount(amountPaid)}</span>
              </div>
              {outstanding > 0.001 && status !== "LOST" && (
                <div className="flex justify-between font-semibold text-destructive">
                  <span>Outstanding</span>
                  <span>{formatAmount(outstanding)}</span>
                </div>
              )}
              {status === "LOST" && outstanding > 0.001 && (
                <div className="flex justify-between text-muted-foreground line-through text-xs">
                  <span>Outstanding (waived)</span>
                  <span>{formatAmount(outstanding)}</span>
                </div>
              )}
              {outstanding <= 0.001 && amountPaid > 0 && status !== "LOST" && (
                <div className="flex items-center gap-1.5 text-green-600 font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Fully collected
                </div>
              )}
            </div>
          </ERPSection>

          {payments.length > 0 && (
            <ERPSection header={<p className="text-sm font-medium text-muted-foreground">Payments</p>}>
              <div className="px-4 py-3 space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatAmount(p.amount)}</span>
                        <span className="text-muted-foreground">{METHOD_LABELS[p.method] ?? p.method}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <DateDisplay date={p.paidAt} />
                        {p.reference && ` · ${p.reference}`}
                      </div>
                    </div>
                    <div className="flex items-center shrink-0 gap-0.5">
                      <button
                        onClick={() => { setEditingPayment(p); setPaymentOpen(true); }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit payment"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingPaymentId(p.id)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                        title="Delete payment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ERPSection>
          )}

          {returns.length > 0 && (
            <ERPSection header={<p className="text-sm font-medium text-muted-foreground">Returns from Market</p>}>
              <div className="px-4 py-3 space-y-4">
                {returns.map((r) => {
                  const isFresh = r.returnType === "FRESH";
                  return (
                    <div key={r.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium">{r.returnNumber}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isFresh ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {isFresh ? "Fresh" : "Waste"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <DateDisplay date={r.createdAt} />
                        {r.notes && ` · ${r.notes}`}
                      </div>
                      <div className="rounded border divide-y text-xs">
                        {r.items.map((i) => (
                          <div key={i.id} className="flex justify-between px-2 py-1">
                            <span>{i.productName} <span className="text-muted-foreground">({i.unitName})</span></span>
                            <span className="tabular-nums">×{formatQty(i.quantity)} = {formatAmount(i.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">{isFresh ? "Restocked & deducted" : "Total deducted"}</span>
                        <span>{formatAmount(r.totalAmount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ERPSection>
          )}
        </div>
      </div>

      {/* Return forms — always visible for active orders */}
      {canRecordReturn && (
        <div className="space-y-4">
          <ReturnFormInline
            soId={id}
            products={products}
            previousReturns={wasteReturns}
            returnType="WASTE"
          />
          <ReturnFormInline
            soId={id}
            products={products}
            previousReturns={freshReturns}
            returnType="FRESH"
          />
        </div>
      )}

      <SoPaymentForm
        soId={id}
        factoryAmount={factoryAmount}
        outstanding={outstanding}
        salesmanTotalOutstanding={salesmanTotalOutstanding}
        open={paymentOpen}
        editPayment={editingPayment}
        onClose={() => { setPaymentOpen(false); setEditingPayment(undefined); }}
      />

      {/* Void Sale dialog */}
      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void This Sale?</AlertDialogTitle>
            <AlertDialogDescription>
              Use this when the sale did not happen or needs to be fully cancelled.
            </AlertDialogDescription>

            {status === "PAID" ? (
              <div className="space-y-2">
                <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                  <span className="font-medium">Stock will be restored.</span>{" "}
                  All items will be returned to inventory.
                </div>
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <span className="font-medium">Refund required:</span>{" "}
                  {formatAmount(amountPaid)} was already collected and must be returned to the customer.
                </div>
              </div>
            ) : status === "CONFIRMED" || status === "PARTIALLY_PAID" ? (
              <div className="space-y-2">
                <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                  <span className="font-medium">Stock will be restored.</span>{" "}
                  All items from this order will be returned to inventory.
                </div>
                {amountPaid > 0 && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    <span className="font-medium">Partial refund required:</span>{" "}
                    {formatAmount(amountPaid)} was collected and must be returned to the customer.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
                This is a draft — no stock was ever deducted.
              </div>
            )}

            <p className="text-sm font-medium text-destructive">
              This action cannot be undone.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              disabled={voiding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voiding ? "Voiding..." : "Yes, Void Sale"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Lost dialog */}
      <AlertDialog open={lostOpen} onOpenChange={setLostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              Mark as Dispatched — Not Returned?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Use this <span className="font-medium">only</span> if goods were physically
              taken by the salesman and will <span className="font-medium">not</span> be
              returned to the factory.
            </AlertDialogDescription>
            <div className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-800 space-y-1">
              <p className="font-medium">Stock will NOT be restored.</p>
              <p>The goods are considered gone. This is a business loss absorbed by the factory.</p>
            </div>
            {status === "PAID" ? (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                Payment of <span className="font-medium">{formatAmount(amountPaid)}</span> was
                already collected. No refund is issued — the business absorbs the physical loss.
              </div>
            ) : (
              <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-800">
                The salesman&apos;s outstanding balance will be cleared for this order.
              </div>
            )}
            <p className="text-sm font-medium text-destructive">
              This action cannot be undone.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markingLost}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkLost}
              disabled={markingLost}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {markingLost ? "Marking..." : "Yes, Mark as Lost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Delete payment confirmation */}
      <AlertDialog
        open={!!deletingPaymentId}
        onOpenChange={(open) => { if (!open && !deletePaymentPending) setDeletingPaymentId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              The payment will be permanently removed. The order&apos;s collected amount and status
              will be recalculated automatically. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePaymentPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayment}
              disabled={deletePaymentPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePaymentPending ? "Deleting…" : "Yes, delete payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
