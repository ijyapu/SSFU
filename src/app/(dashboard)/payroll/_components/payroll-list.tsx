"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, ExternalLink, Trash2, Lock, Printer } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { CreateRunForm } from "./create-run-form";
import { deletePayrollRun } from "../../employees/actions";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type PayrollRun = {
  id: string;
  month: number;
  year: number;
  status: "DRAFT" | "FINALIZED";
  notes: string | null;
  totalPayroll: number;
  totalPaid: number;
  employeeCount: number;
  createdAt: string;
  lastEditedBy: string | null;
};

export function PayrollList({ runs }: { runs: PayrollRun[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const { sortKey, sortDir, toggle } = useSortable("period");

  const sorted = useMemo(() => {
    if (!sortKey) return runs;
    return [...runs].sort((a, b) => {
      const aVals: Record<string, string | number> = { period: a.year * 12 + a.month, status: a.status, employeeCount: a.employeeCount, totalPayroll: a.totalPayroll, totalPaid: a.totalPaid };
      const bVals: Record<string, string | number> = { period: b.year * 12 + b.month, status: b.status, employeeCount: b.employeeCount, totalPayroll: b.totalPayroll, totalPaid: b.totalPaid };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [runs, sortKey, sortDir]);

  async function handleDelete(id: string, label: string) {
    try {
      await deletePayrollRun(id);
      toast.success(`${label} payroll deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete payroll run");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Payroll Run
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {(() => { const sp = { sortKey, sortDir, toggle }; return (
            <TableRow>
              <TableHead><SortButton col="period"        label="Period"          {...sp} /></TableHead>
              <TableHead><SortButton col="status"        label="Status"          {...sp} /></TableHead>
              <TableHead numeric><SortButton col="employeeCount" label="Employees"     {...sp} className="justify-end" /></TableHead>
              <TableHead numeric><SortButton col="totalPayroll"  label="Total Owed (Rs)" {...sp} className="justify-end" /></TableHead>
              <TableHead numeric><SortButton col="totalPaid"     label="Paid Out (Rs)" {...sp} className="justify-end" /></TableHead>
              <TableHead>Last Edited By</TableHead>
              <TableHead className="w-20" />
            </TableRow>
            ); })()}
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No payroll runs yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((run) => {
              const label = `${MONTHS[run.month - 1]} ${run.year}`;
              return (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell>
                    {run.status === "FINALIZED" ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                        <Lock className="h-3 w-3 mr-1" />
                        Finalized
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        Draft
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell numeric className="text-muted-foreground">
                    {run.employeeCount}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {run.totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell numeric>
                    {run.totalPaid > 0 ? (
                      <span className="text-emerald-600 font-medium">
                        {run.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {run.lastEditedBy ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/payroll/${run.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={`Print ${label} payroll`}
                        onClick={() => window.open(`/payroll/${run.id}?print=1`, "_blank")}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {label} payroll?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the {label} payroll run and all its payment records.
                              If a following month exists, its carryover will be recalculated automatically.
                              This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(run.id, label)}>
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

      <CreateRunForm open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
