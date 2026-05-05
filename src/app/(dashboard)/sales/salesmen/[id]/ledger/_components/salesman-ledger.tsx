"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DateDisplay } from "@/components/ui/date-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { SortButton } from "@/components/ui/sort-icon";

type LedgerRow = {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  totalTaken: number;
  wasteReturned: number;
  netAmount: number;
  commissionPct: number;
  commissionAmount: number;
  factoryAmount: number;
  collected: number;
  balance: number;
};

type Props = {
  customerName: string;
  commissionPct: number;
  openingBalance: number;
  rows: LedgerRow[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT:          "Draft",
  CONFIRMED:      "Confirmed",
  PARTIALLY_PAID: "Partial",
  PAID:           "Paid",
  CANCELLED:      "Voided",
  LOST:           "Lost / Not Returned",
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT:          "bg-gray-100 text-gray-600",
  CONFIRMED:      "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID:           "bg-emerald-100 text-emerald-700",
  CANCELLED:      "bg-red-100 text-red-600",
  LOST:           "bg-amber-100 text-amber-700",
};

export function SalesmanLedger({ commissionPct, openingBalance, rows }: Props) {
  const { sortKey, sortDir, toggle } = useSortable("orderDate");

  // Pre-compute running balance in chronological order (oldest → newest)
  const rowsWithRunning = useMemo(() => {
    const chronological = [...rows].sort((a, b) =>
      a.orderDate < b.orderDate ? -1 : a.orderDate > b.orderDate ? 1 : 0
    );
    let running = openingBalance;
    const runMap = new Map<string, number>();
    for (const r of chronological) {
      running += r.balance;
      runMap.set(r.id, running);
    }
    return rows.map((r) => ({ ...r, runningBalance: runMap.get(r.id) ?? 0 }));
  }, [rows, openingBalance]);

  const sorted = useMemo(() => {
    if (!sortKey) return rowsWithRunning;
    return [...rowsWithRunning].sort((a, b) => {
      const av = a[sortKey as keyof typeof a] as string | number;
      const bv = b[sortKey as keyof typeof a] as string | number;
      return compareValues(av, bv, sortDir);
    });
  }, [rowsWithRunning, sortKey, sortDir]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      totalTaken:       acc.totalTaken       + r.totalTaken,
      wasteReturned:    acc.wasteReturned    + r.wasteReturned,
      netAmount:        acc.netAmount        + r.netAmount,
      commissionAmount: acc.commissionAmount + r.commissionAmount,
      factoryAmount:    acc.factoryAmount    + r.factoryAmount,
      collected:        acc.collected        + r.collected,
      balance:          acc.balance          + r.balance,
    }),
    { totalTaken: 0, wasteReturned: 0, netAmount: 0, commissionAmount: 0, factoryAmount: 0, collected: 0, balance: 0 }
  ), [rows]);

  const totalOutstanding = openingBalance + totals.balance;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Total Dispatched</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold">Rs {totals.totalTaken.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} order{rows.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Commission ({commissionPct}%)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-amber-600">Rs {totals.commissionAmount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">deducted from factory</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Total Collected</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-green-700">Rs {totals.collected.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">of Rs {totals.factoryAmount.toFixed(2)} owed</p>
          </CardContent>
        </Card>
        <Card className={totalOutstanding > 0.005 ? "border-amber-300 bg-amber-50/40" : "border-green-300 bg-green-50/40"}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-xl font-bold ${totalOutstanding > 0.005 ? "text-amber-700" : "text-green-700"}`}>
              Rs {Math.abs(totalOutstanding).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalOutstanding > 0.005 ? "still owed to factory" : totalOutstanding < -0.005 ? "credit / overpaid" : "fully settled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          No dispatch records found for this salesman.
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              {(() => {
                const sp = { sortKey, sortDir, toggle };
                return (
                  <TableRow>
                    <TableHead><SortButton col="orderDate"        label="Date"        {...sp} /></TableHead>
                    <TableHead><SortButton col="orderNumber"      label="Dispatch #"  {...sp} /></TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead numeric><SortButton col="totalTaken"       label="Taken (Rs)"   {...sp} className="justify-end" /></TableHead>
                    <TableHead numeric><SortButton col="wasteReturned"    label="Waste (Rs)"   {...sp} className="justify-end" /></TableHead>
                    <TableHead numeric><SortButton col="commissionAmount" label="Comm. (Rs)"   {...sp} className="justify-end" /></TableHead>
                    <TableHead numeric><SortButton col="factoryAmount"    label="Factory (Rs)" {...sp} className="justify-end" /></TableHead>
                    <TableHead numeric><SortButton col="collected"        label="Paid (Rs)"    {...sp} className="justify-end" /></TableHead>
                    <TableHead numeric><SortButton col="balance"          label="Due (Rs)"     {...sp} className="justify-end" /></TableHead>
                    <TableHead numeric><SortButton col="runningBalance"   label="Running Bal." {...sp} className="justify-end" /></TableHead>
                  </TableRow>
                );
              })()}
            </TableHeader>
            <TableBody>
              {/* Opening balance row */}
              {openingBalance !== 0 && (
                <TableRow className="bg-blue-50/40 text-sm italic">
                  <TableCell colSpan={9} className="text-muted-foreground pl-3">
                    Opening balance brought forward
                  </TableCell>
                  <TableCell numeric className={openingBalance > 0 ? "font-semibold text-amber-600" : "font-semibold text-green-700"}>
                    {openingBalance.toFixed(2)}
                  </TableCell>
                </TableRow>
              )}

              {sorted.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm whitespace-nowrap">
                    <DateDisplay date={row.orderDate} fmt="d MMM yyyy" />
                  </TableCell>
                  <TableCell>
                    <Link href={`/sales/${row.id}`} className="font-mono text-sm text-primary hover:underline">
                      {row.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs ${STATUS_BADGE[row.status] ?? ""}`}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell numeric>{row.totalTaken.toFixed(2)}</TableCell>
                  <TableCell numeric className="text-orange-600">
                    {row.wasteReturned > 0 ? `− ${row.wasteReturned.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell numeric className="text-amber-600">{row.commissionAmount.toFixed(2)}</TableCell>
                  <TableCell numeric className="font-medium">{row.factoryAmount.toFixed(2)}</TableCell>
                  <TableCell numeric className="text-green-700">
                    {row.collected > 0 ? row.collected.toFixed(2) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell numeric className={row.balance > 0.005 ? "font-medium text-amber-600" : "text-green-700"}>
                    {row.balance > 0.005 ? row.balance.toFixed(2) : row.balance < -0.005 ? `(${Math.abs(row.balance).toFixed(2)})` : "—"}
                  </TableCell>
                  <TableCell numeric className={row.runningBalance > 0.005 ? "font-semibold text-amber-700" : "font-semibold text-green-700"}>
                    {row.runningBalance.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals row */}
              <TableRow className="bg-muted/50 font-semibold border-t-2 text-sm">
                <TableCell colSpan={3} className="pl-3">
                  Totals — {rows.length} dispatch{rows.length !== 1 ? "es" : ""}
                </TableCell>
                <TableCell numeric>{totals.totalTaken.toFixed(2)}</TableCell>
                <TableCell numeric className="text-orange-600">
                  {totals.wasteReturned > 0 ? `− ${totals.wasteReturned.toFixed(2)}` : <span className="text-muted-foreground font-normal">—</span>}
                </TableCell>
                <TableCell numeric className="text-amber-600">{totals.commissionAmount.toFixed(2)}</TableCell>
                <TableCell numeric>{totals.factoryAmount.toFixed(2)}</TableCell>
                <TableCell numeric className="text-green-700">{totals.collected.toFixed(2)}</TableCell>
                <TableCell numeric className={totals.balance > 0.005 ? "text-amber-600" : "text-green-700"}>
                  {totals.balance.toFixed(2)}
                </TableCell>
                <TableCell numeric className={totalOutstanding > 0.005 ? "text-amber-700" : "text-green-700"}>
                  {totalOutstanding.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
