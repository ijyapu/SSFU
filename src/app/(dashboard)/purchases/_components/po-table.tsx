"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { DateDisplay } from "@/components/ui/date-display";
import { toast } from "sonner";
import { ExternalLink, Trash2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { deletePurchaseOrder } from "../actions";

const STATUS_CONFIG = {
  DRAFT:              { label: "Draft",               className: "bg-gray-100 text-gray-700" },
  CONFIRMED:          { label: "Confirmed",           className: "bg-blue-100 text-blue-700" },
  PARTIALLY_RECEIVED: { label: "Partial",             className: "bg-amber-100 text-amber-700" },
  RECEIVED:           { label: "Received",            className: "bg-emerald-100 text-emerald-700" },
  CANCELLED:          { label: "Cancelled",           className: "bg-red-100 text-red-700" },
} as const;

type PO = {
  id: string;
  orderNumber: string;
  status: keyof typeof STATUS_CONFIG;
  supplierName: string;
  orderDate: string;
  totalAmount: number;
  amountPaid: number;
  itemCount: number;
};

export function PoTable({ orders }: { orders: PO[] }) {
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { sortKey, sortDir, toggle }  = useSortable("orderDate");

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.supplierName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVals: Record<string, string | number> = { orderNumber: a.orderNumber, supplierName: a.supplierName, orderDate: a.orderDate, status: a.status, totalAmount: a.totalAmount, outstanding: a.totalAmount - a.amountPaid };
      const bVals: Record<string, string | number> = { orderNumber: b.orderNumber, supplierName: b.supplierName, orderDate: b.orderDate, status: b.status, totalAmount: b.totalAmount, outstanding: b.totalAmount - b.amountPaid };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [filtered, sortKey, sortDir]);

  async function handleDelete(id: string, orderNumber: string) {
    try {
      await deletePurchaseOrder(id);
      toast.success(`${orderNumber} deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete order");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by PO number or vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {(() => { const sp = { sortKey, sortDir, toggle }; return (
            <TableRow>
              <TableHead><SortButton col="orderNumber"  label="PO Number"   {...sp} /></TableHead>
              <TableHead><SortButton col="supplierName" label="Vendor"    {...sp} /></TableHead>
              <TableHead><SortButton col="orderDate"    label="Date"        {...sp} /></TableHead>
              <TableHead><SortButton col="status"       label="Status"      {...sp} /></TableHead>
              <TableHead numeric><SortButton col="totalAmount"  label="Total (Rs)"   {...sp} className="justify-end" /></TableHead>
              <TableHead numeric><SortButton col="outstanding"  label="Outstanding"  {...sp} className="justify-end" /></TableHead>
              <TableHead className="w-20" />
            </TableRow>
            ); })()}
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search || statusFilter !== "all"
                    ? "No orders match your filters."
                    : "No purchase orders yet."}
                </TableCell>
              </TableRow>
            )}
            {sorted.map((po) => {
              const cfg = STATUS_CONFIG[po.status];
              const outstanding = po.totalAmount - po.amountPaid;
              return (
                <TableRow key={po.id}>
                  <TableCell className="font-mono font-medium">{po.orderNumber}</TableCell>
                  <TableCell>{po.supplierName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <DateDisplay date={po.orderDate} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cfg.className}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell numeric>
                    {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell numeric>
                    {outstanding > 0.001 ? (
                      <span className="text-destructive font-medium">
                        {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-green-600">Paid</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/purchases/${po.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      {po.status === "DRAFT" && (
                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {po.orderNumber}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Draft orders with no payments can be deleted permanently.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(po.id, po.orderNumber)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {sorted.length} of {orders.length} orders
      </p>
    </div>
  );
}
