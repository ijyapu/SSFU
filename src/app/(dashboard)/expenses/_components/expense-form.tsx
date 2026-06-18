
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { expenseSchema, type ExpenseFormValues } from "@/lib/validators/expense";
import { submitExpense, updateExpense } from "../actions";

type Expense = {
  id: string;
  categoryId: string;
  description: string;
  amount: number;
  date: string;
  notes: string | null;
  attachmentUrl: string | null;
};

type Category = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  categories: Category[];
};

export function ExpenseForm({ open, onClose, expense, categories }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  // Adjust photoUrl during render when open/expense changes (avoids setState-in-effect)
  if (prevOpen !== open) {
    setPrevOpen(open);
    setPhotoUrl(open ? (expense?.attachmentUrl ?? null) : null);
  }

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      categoryId:    "",
      description:   "",
      amount:        0,
      date:          format(new Date(), "yyyy-MM-dd"),
      notes:         "",
      attachmentUrl: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        expense
          ? {
              categoryId:    expense.categoryId,
              description:   expense.description,
              amount:        expense.amount,
              date:          expense.date.slice(0, 10),
              notes:         expense.notes ?? "",
              attachmentUrl: expense.attachmentUrl ?? null,
            }
          : {
              categoryId:    "",
              description:   "",
              amount:        0,
              date:          format(new Date(), "yyyy-MM-dd"),
              notes:         "",
              attachmentUrl: null,
            }
      );
    }
  }, [open, expense, form]);

  async function onSubmit(values: ExpenseFormValues) {
    try {
      const payload: ExpenseFormValues = { ...values, attachmentUrl: photoUrl ?? null };
      if (expense) {
        await updateExpense(expense.id, payload);
        toast.success("Expense updated");
      } else {
        await submitExpense(payload);
        toast.success("Expense submitted");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save expense");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Submit Expense"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category">
                          {categories.find(c => c.id === field.value)?.name}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent searchable>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Fuel for delivery van" />
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
                        type="number"
                        min="0.01"
                        step="0.01"
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
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
                    <Textarea {...field} rows={2} placeholder="Optional additional details..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PhotoUpload
              value={photoUrl}
              onChange={setPhotoUrl}
              label="Receipt / proof photo"
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Saving..."
                  : expense ? "Save Changes" : "Submit Expense"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
