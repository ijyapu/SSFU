"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Lock, Loader2, Printer, ArrowRight } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { DeductionDialog } from "./deduction-dialog";
import { finalizePayrollRun } from "../../../employees/actions";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type DeductionEntry = {
  id: string;
  amount: number;
  givenBy: string | null;
  givenAt: string | null;
  paymentMode: string;
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
};

type PayrollItem = {
  id: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  position: string;
  basicSalary: number;   // this month's salary
  carryoverIn: number;   // unpaid balance from previous month
  totalPaid: number;     // sum of all partial payments recorded
  remaining: number;     // basicSalary + carryoverIn − totalPaid
  notes: string | null;
  deductionEntries: DeductionEntry[];
};

type Props = {
  id: string;
  month: number;
  year: number;
  status: "DRAFT" | "FINALIZED";
  notes: string | null;
  items: PayrollItem[];
  autoPrint?: boolean;
};

export function PayrollDetail({ id, month, year, status, notes, items, autoPrint }: Props) {
  const [finalizing, setFinalizing] = useState(false);

  const printTriggered = useRef(false);
  useEffect(() => {
    if (autoPrint && !printTriggered.current) {
      printTriggered.current = true;
      window.print();
    }
  }, [autoPrint]);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const { sortKey, sortDir, toggle } = useSortable("employeeName");

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const aVals: Record<string, string | number> = { employeeName: a.employeeName, department: a.department, basicSalary: a.basicSalary, carryoverIn: a.carryoverIn, totalPaid: a.totalPaid, remaining: a.remaining };
      const bVals: Record<string, string | number> = { employeeName: b.employeeName, department: b.department, basicSalary: b.basicSalary, carryoverIn: b.carryoverIn, totalPaid: b.totalPaid, remaining: b.remaining };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [items, sortKey, sortDir]);

  const period    = `${MONTHS[month - 1]} ${year}`;
  const finalized = status === "FINALIZED";

  const totalSalary    = items.reduce((s, i) => s + i.basicSalary, 0);
  const totalCarryover = items.reduce((s, i) => s + i.carryoverIn, 0);
  const totalOwed      = items.reduce((s, i) => s + i.basicSalary + i.carryoverIn, 0);
  const totalPaid      = items.reduce((s, i) => s + i.totalPaid, 0);
  const totalRemaining = items.reduce((s, i) => s + i.remaining, 0);
  const hasCarryover   = totalCarryover > 0;

  async function handleFinalize() {
    if (!confirm(`Finalize the ${period} payroll? You can still add payments after finalizing.`)) return;
    setFinalizing(true);
    try {
      await finalizePayrollRun(id);
      toast.success(`${period} payroll finalized`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to finalize payroll");
    } finally {
      setFinalizing(false);
    }
  }

  const openItem = items.find((i) => i.id === openItemId) ?? null;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 14mm; }

          /* Hide app shell — use exact attribute/element selectors only */
          [data-sidebar="sidebar"], header { display: none !important; }

          /* Hide interactive / screen-only elements */
          .no-print, .payroll-actions, .hide-on-print { display: none !important; }

          /* Show print header */
          .print-header { display: block !important; }

          /* Let the table expand to full width */
          .payroll-table-wrapper {
            overflow: visible !important;
            width: 100% !important;
          }
          .payroll-table-wrapper > div {
            min-width: 0 !important;
            width: 100% !important;
          }
          .payroll-table-wrapper table {
            width: 100% !important;
            font-size: 9pt;
            border-collapse: collapse;
          }
          .payroll-table-wrapper th,
          .payroll-table-wrapper td {
            padding: 4px 6px !important;
            font-size: 9pt !important;
          }

          /* Summary below table, not side-by-side */
          .payroll-grid { display: block !important; }
          .payroll-summary { width: 100% !important; margin-top: 16px; }
          .payroll-summary > div { break-inside: avoid; }
        }
        .print-header { display: none; }
      `}</style>

      {/* Print-only header */}
      <div className="print-header text-center mb-4">
        <div className="text-base font-bold uppercase">{COMPANY.name}</div>
        <div className="text-xs">{COMPANY.address} | PAN: {COMPANY.pan} | Tel: {COMPANY.phone}</div>
        <div className="text-sm font-semibold mt-1">Payroll — {period}</div>
        <div className="text-xs text-gray-500">
          Status: {finalized ? "Finalized" : "Draft"} · {items.length} employee{items.length !== 1 ? "s" : ""}
        </div>
        <hr className="mt-2 border-gray-400" />
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          {finalized ? (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-sm px-3 py-1">
              <Lock className="h-3.5 w-3.5 mr-1" />
              Finalized
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-sm px-3 py-1">
              Draft
            </Badge>
          )}
          <span className="text-muted-foreground text-sm">
            {items.length} employee{items.length !== 1 ? "s" : ""}
          </span>
          {totalRemaining > 0 && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
              Rs {fmt(totalRemaining)} remaining to pay
            </Badge>
          )}
        </div>
        <div className="flex gap-2 payroll-actions">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          {!finalized && (
            <Button onClick={handleFinalize} disabled={finalizing}>
              {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Finalize
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 payroll-grid">
        {/* Main table */}
        <div className="lg:col-span-3 overflow-x-auto payroll-table-wrapper">
          <div className="rounded-lg border min-w-160">
            <Table>
              <TableHeader>
                {(() => { const sp = { sortKey, sortDir, toggle }; return (
                <TableRow className="bg-muted/40">
                  <TableHead className="w-48"><SortButton col="employeeName" label="Employee"       {...sp} /></TableHead>
                  <TableHead numeric><SortButton col="basicSalary"  label="Salary (Rs)"    {...sp} className="justify-end" /></TableHead>
                  {hasCarryover && (
                    <TableHead numeric className="text-blue-600"><SortButton col="carryoverIn" label="Carryover (Rs)" {...sp} className="justify-end" /></TableHead>
                  )}
                  <TableHead numeric>Total Owed (Rs)</TableHead>
                  <TableHead numeric><SortButton col="totalPaid"    label="Paid (Rs)"      {...sp} className="justify-end" /></TableHead>
                  <TableHead numeric><SortButton col="remaining"    label="Remaining (Rs)" {...sp} className="justify-end" /></TableHead>
                  <TableHead className="w-24 hide-on-print" />
                </TableRow>
                ); })()}
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => {
                  const totalOwedItem = item.basicSalary + item.carryoverIn;
                  const fullyPaid     = item.remaining <= 0.005;
                  return (
                    <TableRow key={item.id} className={fullyPaid ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{item.department} · {item.position}</div>
                        <div className="text-xs text-muted-foreground font-mono">{item.employeeNo}</div>
                        {item.deductionEntries.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.deductionEntries.length} payment{item.deductionEntries.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </TableCell>
                      <TableCell numeric>
                        {fmt(item.basicSalary)}
                      </TableCell>
                      {hasCarryover && (
                        <TableCell numeric className="text-blue-600">
                          {item.carryoverIn > 0 ? `+${fmt(item.carryoverIn)}` : "—"}
                        </TableCell>
                      )}
                      <TableCell numeric className="font-medium">
                        {fmt(totalOwedItem)}
                      </TableCell>
                      <TableCell numeric>
                        {item.totalPaid > 0 ? (
                          <span className="text-emerald-600 font-medium">{fmt(item.totalPaid)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell numeric>
                        {fullyPaid ? (
                          <span className="text-muted-foreground text-xs">Fully paid</span>
                        ) : (
                          <span className={`font-semibold ${item.remaining > 0 ? "text-amber-600" : ""}`}>
                            {fmt(item.remaining)}
                            {item.carryoverIn === 0 && item.remaining > 0 && (
                              <span className="flex items-center justify-end gap-0.5 text-xs font-normal text-muted-foreground mt-0.5">
                                <ArrowRight className="h-3 w-3" />
                                carries over
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hide-on-print">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setOpenItemId(item.id)}
                        >
                          Payments
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4 payroll-summary">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {period} Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {notes && <p className="text-muted-foreground italic text-xs mb-3">{notes}</p>}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Salaries</span>
                <span>Rs {fmt(totalSalary)}</span>
              </div>

              {hasCarryover && (
                <div className="flex justify-between text-blue-600">
                  <span>+ Carried Over</span>
                  <span>Rs {fmt(totalCarryover)}</span>
                </div>
              )}

              <div className="flex justify-between font-medium">
                <span>Total Owed</span>
                <span>Rs {fmt(totalOwed)}</span>
              </div>

              <Separator />

              <div className="flex justify-between text-emerald-600">
                <span>Paid So Far</span>
                <span>Rs {fmt(totalPaid)}</span>
              </div>

              <div className="flex justify-between font-bold text-base">
                <span>Remaining</span>
                <span className={totalRemaining > 0 ? "text-amber-600" : ""}>
                  Rs {fmt(totalRemaining)}
                </span>
              </div>

              {totalRemaining > 0 && (
                <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  Rs {fmt(totalRemaining)} will carry over to next month
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment progress per employee */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Payment Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => {
                const totalOwedItem = item.basicSalary + item.carryoverIn;
                const pct = totalOwedItem > 0
                  ? Math.min(100, Math.round((item.totalPaid / totalOwedItem) * 100))
                  : 0;
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate font-medium">{item.employeeName.split(" ")[0]}</span>
                      <span className="text-muted-foreground shrink-0">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deduction dialog */}
      {openItem && (
        <DeductionDialog
          open={openItemId !== null}
          onClose={() => setOpenItemId(null)}
          payrollItemId={openItem.id}
          employeeName={openItem.employeeName}
          basicSalary={openItem.basicSalary}
          carryoverIn={openItem.carryoverIn}
          deductionEntries={openItem.deductionEntries}
          currentRemaining={openItem.remaining}
        />
      )}
    </div>
  );
}
