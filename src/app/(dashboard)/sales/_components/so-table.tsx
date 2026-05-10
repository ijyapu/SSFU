"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { DateDisplay } from "@/components/ui/date-display";
import { toast } from "sonner";
import { ExternalLink, Trash2, User } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmptyRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { deleteSalesOrder } from "../actions";
import { salesOrderHref } from "@/lib/sales-nav";

const STATUS_CONFIG = {
  DRAFT:          { label: "Draft",               className: "bg-muted text-muted-foreground" },
  CONFIRMED:      { label: "Confirmed",           className: "bg-slate-100 text-slate-700" },
  PARTIALLY_PAID: { label: "Partial",             className: "bg-amber-100 text-amber-700" },
  PAID:           { label: "Paid",                className: "bg-emerald-100 text-emerald-700" },
  CANCELLED:      { label: "Voided",              className: "bg-red-100 text-red-700" },
  LOST:           { label: "Lost / Not Returned", className: "bg-red-100 text-red-700" },
} as const;

type SO = {
  id: string;
  orderNumber: string;
  status: keyof typeof STATUS_CONFIG;
  salesmanId: string;
  customerName: string;
  orderDate: string;
  totalAmount: number;
  factoryAmount: number;
  amountPaid: number;
};

export function SoTable({ orders, from, to }: { orders: SO[]; from?: string; to?: string }) {
  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [activeSalesman,  setActiveSalesman]  = useState<string | null>(null);
  const { sortKey, sortDir, toggle }          = useSortable("orderDate");

  // Per-salesman stats for sidebar
  const salesmanStats = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; total: number }>();
    for (const o of orders) {
      const existing = map.get(o.salesmanId) ?? { id: o.salesmanId, name: o.customerName, count: 0, total: 0 };
      existing.count++;
      existing.total += o.factoryAmount;
      map.set(o.salesmanId, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchSalesman = !activeSalesman || o.salesmanId === activeSalesman;
      const matchStatus   = statusFilter === "all" || o.status === statusFilter;
      const matchSearch   = !q || o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
      return matchSalesman && matchStatus && matchSearch;
    });
  }, [orders, activeSalesman, statusFilter, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVals: Record<string, string | number> = { orderNumber: a.orderNumber, customerName: a.customerName, orderDate: a.orderDate, status: a.status, totalAmount: a.totalAmount, outstanding: a.factoryAmount - a.amountPaid };
      const bVals: Record<string, string | number> = { orderNumber: b.orderNumber, customerName: b.customerName, orderDate: b.orderDate, status: b.status, totalAmount: b.totalAmount, outstanding: b.factoryAmount - b.amountPaid };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [filtered, sortKey, sortDir]);

  async function handleDelete(id: string, orderNumber: string) {
    try {
      await deleteSalesOrder(id);
      toast.success(`${orderNumber} deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete order");
    }
  }

  return (
    <div className="flex gap-4 items-start">

      {/* ── Salesman Sidebar ── */}
      {salesmanStats.length > 0 && (
        <div className="hidden md:flex w-44 shrink-0 flex-col gap-0.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 pb-1">Salesmen</p>
          <button
            onClick={() => setActiveSalesman(null)}
            className={`flex items-center justify-between w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
              !activeSalesman ? "bg-accent font-medium" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span>All</span>
            <span className="text-xs">{orders.length}</span>
          </button>
          {salesmanStats.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSalesman(activeSalesman === s.id ? null : s.id)}
              className={`flex flex-col w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                activeSalesman === s.id ? "bg-accent font-medium" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{s.name}</span>
              </div>
              <div className="flex justify-between text-xs mt-0.5 pl-4.5">
                <span>{s.count} order{s.count !== 1 ? "s" : ""}</span>
                <span className="tabular-nums">
                  Rs {formatNumber(s.total, 0)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Main Table ── */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search by SO number or salesman..."
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
          {activeSalesman && (
            <button
              onClick={() => setActiveSalesman(null)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              {(() => { const sp = { sortKey, sortDir, toggle }; return (
              <TableRow className="bg-muted/40">
                <TableHead><SortButton col="orderNumber"  label="SO Number"  {...sp} /></TableHead>
                <TableHead><SortButton col="customerName" label="Salesman"   {...sp} /></TableHead>
                <TableHead><SortButton col="orderDate"    label="Date"       {...sp} /></TableHead>
                <TableHead><SortButton col="status"       label="Status"     {...sp} /></TableHead>
                <TableHead numeric><SortButton col="totalAmount"  label="Gross (Rs)"   {...sp} className="justify-end" /></TableHead>
                <TableHead numeric><SortButton col="outstanding"  label="Outstanding"  {...sp} className="justify-end" /></TableHead>
                <TableHead className="w-20" />
              </TableRow>
              ); })()}
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableEmptyRow
                  colSpan={7}
                  message={search || statusFilter !== "all" || activeSalesman
                    ? "No orders match your filters."
                    : "No sales orders yet."}
                />
              )}
              {sorted.map((so) => {
                const cfg = STATUS_CONFIG[so.status];
                const outstanding = so.factoryAmount - so.amountPaid;
                return (
                  <TableRow key={so.id}>
                    <TableCell className="font-mono font-medium">{so.orderNumber}</TableCell>
                    <TableCell>{so.customerName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <DateDisplay date={so.orderDate} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cfg.className}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell numeric>
                      {so.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell numeric>
                      {outstanding > 0.001 ? (
                        <span className="text-destructive font-medium">
                          {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-green-600">Collected</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link
                          href={salesOrderHref(so.id, from, to)}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {so.orderNumber}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove the order.
                                {!["DRAFT", "CANCELLED", "LOST"].includes(so.status) && " Stock will be restored."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(so.id, so.orderNumber)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {sorted.length} of {orders.length} order{orders.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
