"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Pencil, AlertTriangle } from "lucide-react";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { receiptSchema, type ReceiptFormValues } from "@/lib/validators/receipts";
import {
  createReceipt, updateReceipt,
  checkSalesmanPaymentDuplicate, type SalesmanDuplicateMatch,
} from "../actions";

const METHOD_LABELS: Record<string, string> = {
  CASH:          "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHECK:         "Cheque",
  ESEWA:         "eSewa",
  KHALTI:        "Khalti",
  IME_PAY:       "IME Pay",
  FONEPAY:       "FonePay",
  OTHER:         "Other",
};

type Props = {
  mode:    "create";
} | {
  mode:    "edit";
  receipt: {
    id:           string;
    receivedFrom: string;
    amount:       number;
    method:       string;
    reference:    string | null;
    notes:        string | null;
    photoUrl:     string | null | undefined;
    receivedAt:   string;
  };
};

export function ReceiptFormDialog(props: Props) {
  const [open, setOpen]               = useState(false);
  const [pendingValues, setPending]   = useState<ReceiptFormValues | null>(null);
  const [duplicates, setDuplicates]   = useState<SalesmanDuplicateMatch[]>([]);
  const [confirming, setConfirming]   = useState(false);

  const isEdit = props.mode === "edit";
  const today  = new Date().toISOString().split("T")[0];

  const form = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: isEdit
      ? {
          receivedFrom: props.receipt.receivedFrom,
          amount:       props.receipt.amount,
          method:       props.receipt.method as ReceiptFormValues["method"],
          reference:    props.receipt.reference ?? "",
          notes:        props.receipt.notes ?? "",
          photoUrl:     props.receipt.photoUrl ?? null,
          receivedAt:   props.receipt.receivedAt.split("T")[0],
        }
      : {
          receivedFrom: "",
          amount:       0,
          method:       "CASH",
          reference:    "",
          notes:        "",
          photoUrl:     null,
          receivedAt:   today,
        },
  });

  async function doSave(values: ReceiptFormValues) {
    try {
      if (isEdit) {
        await updateReceipt(props.receipt.id, values);
        toast.success("Receipt updated");
      } else {
        await createReceipt(values);
        toast.success("Receipt recorded");
        form.reset({ receivedFrom: "", amount: 0, method: "CASH", reference: "", notes: "", photoUrl: null, receivedAt: today });
      }
      setOpen(false);
      setPending(null);
      setDuplicates([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function onSubmit(values: ReceiptFormValues) {
    // Skip duplicate check if amount is zero or date is missing
    if (values.amount > 0 && values.receivedAt) {
      const matches = await checkSalesmanPaymentDuplicate(values.amount, values.receivedAt);
      if (matches.length > 0) {
        setPending(values);
        setDuplicates(matches);
        return; // Show confirmation dialog; do not save yet
      }
    }
    await doSave(values);
  }

  async function handleConfirm() {
    if (!pendingValues) return;
    setConfirming(true);
    try {
      await doSave(pendingValues);
    } finally {
      setConfirming(false);
    }
  }

  function handleDismiss() {
    setPending(null);
    setDuplicates([]);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {isEdit ? (
          <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
            <Pencil className="h-3.5 w-3.5" />
          </DialogTrigger>
        ) : (
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4" />
            Record Receipt
          </DialogTrigger>
        )}

        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Receipt" : "Record Receipt"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField
                control={form.control}
                name="receivedFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received From *</FormLabel>
                    <FormControl>
                      <Input placeholder="Person or company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (Rs) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min="0.01" step="0.01" placeholder="0.00"
                          value={field.value === 0 ? "" : field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="receivedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(METHOD_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="Cheque no, txn ID…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Optional notes…" className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="photoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PhotoUpload
                        value={field.value ?? null}
                        onChange={field.onChange}
                        label="Proof Photo (optional)"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Checking…" : isEdit ? "Save Changes" : "Record Receipt"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Soft duplicate warning — shown after submit if a matching SalesmanPayment exists */}
      <AlertDialog open={duplicates.length > 0} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              Possible Duplicate Detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              The following Salesman Payment{duplicates.length !== 1 ? "s" : ""} match
              this receipt by amount and date. This may indicate the same cash has
              already been recorded.
            </AlertDialogDescription>
            <div className="rounded-md border divide-y mt-3">
              {duplicates.map((m) => (
                <div key={m.id} className="px-3 py-2 text-xs space-y-0.5">
                  <div className="font-medium text-foreground">{m.salesmanName}</div>
                  <div className="text-muted-foreground">
                    Order {m.orderNumber} &nbsp;·&nbsp;
                    Rs {m.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} &nbsp;·&nbsp;
                    {format(new Date(m.paidAt), "d MMM yyyy")}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              If this is a different transaction, proceed. Otherwise go back and
              check your records.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDismiss}>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={confirming}>
              {confirming ? "Saving…" : "Record Anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
