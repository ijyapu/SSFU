"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod/v4";
import { format } from "date-fns";
import { DateDisplay } from "@/components/ui/date-display";
import { Trash2, Plus, Banknote, Wifi, ImageIcon, Loader2, CheckCircle2, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { addPayrollDeduction, deletePayrollDeduction, applyWithdrawalToPayroll } from "../../../employees/actions";

const deductionSchema = z.object({
  amount:      z.number({ error: "Amount is required" }).positive("Must be greater than 0"),
  givenBy:     z.string().optional(),
  givenAt:     z.string().min(1, "Date is required"),
  paymentMode: z.enum(["CASH", "ONLINE"]),
  notes:       z.string().optional(),
});

type FormValues = z.infer<typeof deductionSchema>;

type DeductionEntry = {
  id: string;
  amount: number;
  givenBy: string | null;
  givenAt: string | null;
  paymentMode: string;
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
  withdrawalId: string | null;
};

type WithdrawalEntry = {
  id: string;
  amount: number;
  takenAt: string;
  notes: string | null;
  paymentMode: string;
  isAppliedHere: boolean;
  isAppliedElsewhere: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  payrollItemId: string;
  employeeName: string;
  basicSalary: number;
  carryoverIn: number;
  deductionEntries: DeductionEntry[];
  currentRemaining: number;
  withdrawals: WithdrawalEntry[];
  isFinalized: boolean;
};

export function DeductionDialog({
  open, onClose, payrollItemId, employeeName, basicSalary, carryoverIn,
  deductionEntries, currentRemaining, withdrawals: initialWithdrawals, isFinalized,
}: Props) {
  const [photoUrl, setPhotoUrl]       = useState<string | null>(null);
  const [showForm, setShowForm]       = useState(deductionEntries.length === 0);
  const [entries, setEntries]         = useState<DeductionEntry[]>(deductionEntries);
  const [remaining, setRemaining]     = useState(currentRemaining);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalEntry[]>(initialWithdrawals);
  const [applying, setApplying]       = useState<string | null>(null);

  const totalDeductions = entries.reduce((s, e) => s + e.amount, 0);
  const unappliedWithdrawals = withdrawals.filter((w) => !w.isAppliedHere && !w.isAppliedElsewhere);

  const fmtRs = (n: number) =>
    `Rs ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const form = useForm<FormValues>({
    resolver: zodResolver(deductionSchema),
    defaultValues: {
      amount:      undefined,
      givenBy:     "",
      givenAt:     format(new Date(), "yyyy-MM-dd"),
      paymentMode: "CASH",
      notes:       "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await addPayrollDeduction(payrollItemId, {
        ...values,
        photoUrl: photoUrl ?? undefined,
      });

      const newEntry: DeductionEntry = {
        id:           crypto.randomUUID(),
        amount:       values.amount,
        givenBy:      values.givenBy || null,
        givenAt:      values.givenAt,
        paymentMode:  values.paymentMode,
        notes:        values.notes || null,
        photoUrl:     photoUrl,
        createdAt:    new Date().toISOString(),
        withdrawalId: null,
      };
      setEntries((prev) => [...prev, newEntry]);
      setRemaining((prev) => prev - values.amount);

      toast.success("Payment deduction recorded");
      form.reset({ amount: undefined, givenBy: "", givenAt: format(new Date(), "yyyy-MM-dd"), paymentMode: "CASH", notes: "" });
      setPhotoUrl(null);
      setShowForm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record deduction");
    }
  }

  async function handleDelete(entry: DeductionEntry) {
    setDeleting(entry.id);
    try {
      await deletePayrollDeduction(entry.id, payrollItemId);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setRemaining((prev) => prev + entry.amount);
      if (entry.withdrawalId) {
        setWithdrawals((prev) =>
          prev.map((w) => w.id === entry.withdrawalId ? { ...w, isAppliedHere: false } : w)
        );
      }
      toast.success("Deduction removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove deduction");
    } finally {
      setDeleting(null);
    }
  }

  async function handleApply(withdrawal: WithdrawalEntry) {
    setApplying(withdrawal.id);
    try {
      await applyWithdrawalToPayroll(withdrawal.id, payrollItemId);
      setWithdrawals((prev) =>
        prev.map((w) => w.id === withdrawal.id ? { ...w, isAppliedHere: true } : w)
      );
      const newEntry: DeductionEntry = {
        id:           crypto.randomUUID(),
        amount:       withdrawal.amount,
        givenBy:      null,
        givenAt:      withdrawal.takenAt.slice(0, 10),
        paymentMode:  withdrawal.paymentMode,
        notes:        withdrawal.notes ?? `Advance applied (taken ${withdrawal.takenAt.slice(0, 10)})`,
        photoUrl:     null,
        createdAt:    new Date().toISOString(),
        withdrawalId: withdrawal.id,
      };
      setEntries((prev) => [...prev, newEntry]);
      setRemaining((prev) => prev - withdrawal.amount);
      toast.success("Salary advance applied to payroll");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply advance");
    } finally {
      setApplying(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Salary Deductions — {employeeName}</DialogTitle>
          <div className="flex flex-wrap items-center gap-3 text-sm mt-1">
            <span className="text-muted-foreground">
              Salary: <span className="font-medium text-foreground">{fmtRs(basicSalary)}</span>
            </span>
            {carryoverIn > 0 && (
              <span className="text-blue-600">
                + {fmtRs(carryoverIn)} carried over
              </span>
            )}
            {totalDeductions > 0 && (
              <span className="text-emerald-600">
                Paid: {fmtRs(totalDeductions)}
              </span>
            )}
            <span className="font-semibold">
              Remaining: {fmtRs(remaining)}
            </span>
          </div>
        </DialogHeader>

        {/* Salary advances section */}
        {withdrawals.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Salary Advances ({withdrawals.length})
            </p>
            <div className="rounded-lg border divide-y">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-start gap-3 p-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{fmtRs(w.amount)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {w.paymentMode === "CASH" ? "Cash" : "Online"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <DateDisplay date={w.takenAt} />
                      </span>
                      {w.isAppliedHere && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Applied
                        </Badge>
                      )}
                      {w.isAppliedElsewhere && (
                        <span className="text-xs text-muted-foreground italic">Applied elsewhere</span>
                      )}
                    </div>
                    {w.notes && (
                      <p className="text-xs text-muted-foreground">{w.notes}</p>
                    )}
                  </div>
                  {!w.isAppliedHere && !w.isAppliedElsewhere && !isFinalized && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs shrink-0"
                      disabled={applying === w.id}
                      onClick={() => handleApply(w)}
                    >
                      {applying === w.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Apply to Payroll"
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {unappliedWithdrawals.length > 0 && !isFinalized && (
              <p className="text-xs text-amber-600">
                {unappliedWithdrawals.length} advance{unappliedWithdrawals.length !== 1 ? "s" : ""} not yet applied to this payroll run.
              </p>
            )}
          </div>
        )}

        {/* Existing deduction entries */}
        {entries.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Payments recorded ({entries.length})
            </p>
            <div className="rounded-lg border divide-y">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3">
                  <div className="mt-0.5 shrink-0">
                    {entry.paymentMode === "CASH" ? (
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Wifi className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{fmtRs(entry.amount)}</span>
                      {entry.withdrawalId ? (
                        <Badge variant="secondary" className="text-xs">Applied Advance</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">Payroll Payment</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        <DateDisplay date={entry.givenAt ?? entry.createdAt} />
                      </span>
                    </div>
                    {entry.givenBy && (
                      <p className="text-xs text-muted-foreground">Given by: {entry.givenBy}</p>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground">{entry.notes}</p>
                    )}
                    {entry.photoUrl && (
                      <a
                        href={entry.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ImageIcon className="h-3 w-3" />
                        View proof photo
                      </a>
                    )}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={deleting === entry.id}
                          className="shrink-0"
                        />
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this deduction?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {entry.withdrawalId
                            ? `This will un-apply the salary advance of ${fmtRs(entry.amount)}. The advance will become available to apply again.`
                            : `${fmtRs(entry.amount)} will be added back to the net pay.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(entry)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new deduction form */}
        {showForm ? (
          <>
            {(entries.length > 0 || withdrawals.length > 0) && <Separator />}
            <p className="text-sm font-medium">Record a payment</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (Rs) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="0.01"
                            placeholder="0.00"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="givenAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date taken *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="givenBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Given by</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Who handed the money" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment method *</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          {(["CASH", "ONLINE"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => field.onChange(mode)}
                              className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                field.value === mode
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background hover:bg-muted"
                              }`}
                            >
                              {mode === "CASH"
                                ? <><Banknote className="h-4 w-4" /> Cash</>
                                : <><Wifi className="h-4 w-4" /> Online</>}
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Week 1 advance, festival bonus deduction…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <PhotoUpload
                  value={photoUrl}
                  onChange={setPhotoUrl}
                  label="Proof photo (optional)"
                />

                <div className="flex gap-2 pt-1">
                  {(entries.length > 0 || withdrawals.length > 0) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setShowForm(false); form.reset(); setPhotoUrl(null); }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1">
                    {form.formState.isSubmitting ? "Saving…" : "Record Payment"}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4" />
            Add another payment
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
