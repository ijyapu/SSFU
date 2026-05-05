"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { DateDisplay } from "@/components/ui/date-display";
import { PackageCheck, CreditCard, CheckCircle, XCircle, Loader2, Printer } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { ReceiveForm } from "./receive-form";
import { PaymentForm } from "./payment-form";
import { confirmPurchaseOrder, cancelPurchaseOrder } from "../../actions";

const STATUS_CONFIG = {
  DRAFT:              { label: "Draft",               className: "bg-gray-100 text-gray-700" },
  CONFIRMED:          { label: "Confirmed",           className: "bg-blue-100 text-blue-700" },
  PARTIALLY_RECEIVED: { label: "Partially Received", className: "bg-amber-100 text-amber-700" },
  RECEIVED:           { label: "Received",            className: "bg-emerald-100 text-emerald-700" },
  CANCELLED:          { label: "Cancelled",           className: "bg-red-100 text-red-700" },
} as const;

type PoItem = {
  id: string;
  productId: string;
  productName: string;
  unitName: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  totalCost: number;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
};

type Props = {
  id: string;
  orderNumber: string;
  status: keyof typeof STATUS_CONFIG;
  supplierName: string;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  subtotal: number;
  totalAmount: number;
  amountPaid: number;
  items: PoItem[];
  payments: Payment[];
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHECK: "Cheque",
  OTHER: "Other",
};

export function PoDetail(props: Props) {
  const {
    id, orderNumber, status, supplierName, orderDate, expectedDate,
    notes, subtotal, totalAmount, amountPaid, items, payments,
  } = props;

  const [receiveOpen, setReceiveOpen]   = useState(false);
  const [paymentOpen, setPaymentOpen]   = useState(false);
  const [confirming,  setConfirming]    = useState(false);
  const [cancelling,  setCancelling]    = useState(false);
  const { sortKey, sortDir, toggle }    = useSortable("productName");

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const aVals: Record<string, string | number> = { productName: a.productName, quantity: Number(a.quantity), receivedQty: Number(a.receivedQty), unitCost: Number(a.unitCost), totalCost: Number(a.totalCost) };
      const bVals: Record<string, string | number> = { productName: b.productName, quantity: Number(b.quantity), receivedQty: Number(b.receivedQty), unitCost: Number(b.unitCost), totalCost: Number(b.totalCost) };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [items, sortKey, sortDir]);

  const outstanding = totalAmount - amountPaid;
  const cfg = STATUS_CONFIG[status];

  const pendingItems = items.filter(
    (i) => Number(i.receivedQty) < Number(i.quantity)
  );

  async function handleConfirm() {
    setConfirming(true);
    try {
      await confirmPurchaseOrder(id);
      toast.success("Order confirmed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to confirm order");
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this purchase order?")) return;
    setCancelling(true);
    try {
      await cancelPurchaseOrder(id);
      toast.success("Order cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status + actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={`${cfg.className} text-sm px-3 py-1`}>
            {cfg.label}
          </Badge>
          <span className="text-muted-foreground text-sm">
            <DateDisplay date={orderDate} />
          </span>
          {expectedDate && (
            <span className="text-muted-foreground text-sm flex items-center gap-1">
              · Expected <DateDisplay date={expectedDate} />
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Link href={`/purchases/${id}/print`} target="_blank">
            <Button variant="outline">
              <Printer className="h-4 w-4" />
              Print Invoice
            </Button>
          </Link>
          {status === "DRAFT" && (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Confirm Order
              </Button>
            </>
          )}
          {(status === "CONFIRMED" || status === "PARTIALLY_RECEIVED") && (
            <>
              {outstanding > 0.001 && (
                <Button variant="outline" onClick={() => setPaymentOpen(true)}>
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </Button>
              )}
              {pendingItems.length > 0 && (
                <Button onClick={() => setReceiveOpen(true)}>
                  <PackageCheck className="h-4 w-4" />
                  Receive Goods
                </Button>
              )}
            </>
          )}
          {status === "RECEIVED" && outstanding > 0.001 && (
            <Button variant="outline" onClick={() => setPaymentOpen(true)}>
              <CreditCard className="h-4 w-4" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Items table — takes 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          {/* PO info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{supplierName}</span>
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
            </CardContent>
          </Card>

          {/* Items */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                {(() => { const sp = { sortKey, sortDir, toggle }; return (
                <TableRow>
                  <TableHead><SortButton col="productName" label="Product"   {...sp} /></TableHead>
                  <TableHead numeric><SortButton col="quantity"    label="Ordered"   {...sp} className="justify-end" /></TableHead>
                  <TableHead numeric><SortButton col="receivedQty" label="Received"  {...sp} className="justify-end" /></TableHead>
                  <TableHead numeric><SortButton col="unitCost"    label="Unit Cost" {...sp} className="justify-end" /></TableHead>
                  <TableHead numeric><SortButton col="totalCost"   label="Total"     {...sp} className="justify-end" /></TableHead>
                </TableRow>
                ); })()}
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => {
                  const fullyReceived = Number(item.receivedQty) >= Number(item.quantity);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">{item.unitName}</div>
                      </TableCell>
                      <TableCell numeric>
                        {Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      </TableCell>
                      <TableCell numeric>
                        <span className={fullyReceived ? "text-green-600 font-medium" : "text-amber-600"}>
                          {Number(item.receivedQty).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </span>
                      </TableCell>
                      <TableCell numeric className="text-muted-foreground">
                        Rs {Number(item.unitCost).toFixed(2)}
                      </TableCell>
                      <TableCell numeric className="font-medium">
                        Rs {Number(item.totalCost).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          {/* Totals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>Rs {subtotal.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>Rs {totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span>Rs {amountPaid.toFixed(2)}</span>
              </div>
              {outstanding > 0.001 && (
                <div className="flex justify-between font-semibold text-destructive">
                  <span>Outstanding</span>
                  <span>Rs {outstanding.toFixed(2)}</span>
                </div>
              )}
              {outstanding <= 0.001 && amountPaid > 0 && (
                <div className="flex items-center gap-1.5 text-green-600 font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Fully paid
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment history */}
          {payments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Rs {p.amount.toFixed(2)}</span>
                      <span className="text-muted-foreground">{METHOD_LABELS[p.method] ?? p.method}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <DateDisplay date={p.paidAt} />
                      {p.reference && ` · ${p.reference}`}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ReceiveForm
        poId={id}
        items={pendingItems}
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
      />
      <PaymentForm
        poId={id}
        outstanding={outstanding}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
      />
    </div>
  );
}
