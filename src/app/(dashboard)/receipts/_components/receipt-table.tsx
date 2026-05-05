"use client";

import { useMemo } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Trash2, ImageIcon } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { DateDisplay } from "@/components/ui/date-display";
import { ReceiptFormDialog } from "./receipt-form-dialog";
import { deleteReceipt } from "../actions";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", BANK_TRANSFER: "Bank Transfer", CHECK: "Cheque",
  ESEWA: "eSewa", KHALTI: "Khalti", IME_PAY: "IME Pay",
  FONEPAY: "FonePay", OTHER: "Other",
};

const METHOD_COLORS: Record<string, string> = {
  CASH:          "bg-slate-100 text-slate-700",
  BANK_TRANSFER: "bg-slate-100 text-slate-700",
  CHECK:         "bg-slate-100 text-slate-700",
  ESEWA:         "bg-slate-100 text-slate-700",
  KHALTI:        "bg-slate-100 text-slate-700",
  IME_PAY:       "bg-slate-100 text-slate-700",
  FONEPAY:       "bg-slate-100 text-slate-700",
  OTHER:         "bg-slate-100 text-slate-700",
};

type Receipt = {
  id:           string;
  receiptNumber: string;
  receivedFrom: string;
  amount:       number;
  method:       string;
  reference:    string | null;
  notes:        string | null;
  photoUrl:     string | null | undefined;
  receivedAt:   string;
};

export function ReceiptTable({ receipts }: { receipts: Receipt[] }) {
  const { sortKey, sortDir, toggle } = useSortable("receivedAt");

  const sorted = useMemo(() => {
    return [...receipts].sort((a, b) => compareValues(
      a[sortKey as keyof Receipt] ?? "",
      b[sortKey as keyof Receipt] ?? "",
      sortDir
    ));
  }, [receipts, sortKey, sortDir]);

  async function handleDelete(id: string) {
    try {
      await deleteReceipt(id);
      toast.success("Receipt deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  const sp = { sortKey, sortDir, toggle };

  if (receipts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        No receipts recorded yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><SortButton col="receiptNumber" label="Receipt #" {...sp} /></TableHead>
            <TableHead><SortButton col="receivedFrom"  label="Received From" {...sp} /></TableHead>
            <TableHead numeric><SortButton col="amount" label="Amount (Rs)" {...sp} className="justify-end" /></TableHead>
            <TableHead><SortButton col="method"      label="Method"      {...sp} /></TableHead>
            <TableHead>Reference</TableHead>
            <TableHead><SortButton col="receivedAt"  label="Date"        {...sp} /></TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Photo</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs font-semibold">{r.receiptNumber}</TableCell>
              <TableCell className="font-medium">{r.receivedFrom}</TableCell>
              <TableCell numeric className="font-semibold text-green-700">
                Rs {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={`text-xs ${METHOD_COLORS[r.method] ?? METHOD_COLORS.OTHER}`}>
                  {METHOD_LABELS[r.method] ?? r.method}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{r.reference ?? "—"}</TableCell>
              <TableCell className="text-sm">
                <DateDisplay date={r.receivedAt} />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-45 truncate">
                {r.notes ?? "—"}
              </TableCell>
              <TableCell>
                {r.photoUrl ? (
                  <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" title="View photo">
                    <Image
                      src={r.photoUrl}
                      alt="Proof"
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded object-cover border border-border hover:opacity-80 transition-opacity"
                    />
                  </a>
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <ReceiptFormDialog mode="edit" receipt={r} />
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Receipt?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove {r.receiptNumber} from {r.receivedFrom}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90 text-white"
                          onClick={() => handleDelete(r.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
