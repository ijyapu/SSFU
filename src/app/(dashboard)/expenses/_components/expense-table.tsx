"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { DateDisplay } from "@/components/ui/date-display";
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Tag } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { ExpenseForm } from "./expense-form";
import { approveExpense, rejectExpense, deleteExpense } from "../actions";

const STATUS_CONFIG = {
  SUBMITTED: { label: "Pending",  className: "bg-amber-100 text-amber-700" },
  APPROVED:  { label: "Paid",     className: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "Rejected", className: "bg-red-100 text-red-700" },
} as const;

type Category = { id: string; name: string };

type Expense = {
  id: string;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: number;
  date: string;
  status: keyof typeof STATUS_CONFIG;
  notes: string | null;
  submittedBy: string;
  submittedByName: string;
  attachmentUrl: string | null;
};

type Props = {
  expenses: Expense[];
  categories: Category[];
  currentUserId: string;
  canApprove: boolean;
};

export function ExpenseTable({ expenses, categories, currentUserId, canApprove }: Props) {
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen]         = useState(false);
  const [editExpense, setEditExpense]   = useState<Expense | null>(null);
  const { sortKey, sortDir, toggle }    = useSortable("date");

  const filtered = expenses.filter((e) => {
    const matchSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.categoryName.toLowerCase().includes(search.toLowerCase());
    const matchStatus   = statusFilter === "all"   || e.status === statusFilter;
    const matchCategory = categoryFilter === "all" || e.categoryId === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVals: Record<string, string | number> = { date: a.date, description: a.description, category: a.categoryName, amount: a.amount, status: a.status, submittedBy: a.submittedByName };
      const bVals: Record<string, string | number> = { date: b.date, description: b.description, category: b.categoryName, amount: b.amount, status: b.status, submittedBy: b.submittedByName };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [filtered, sortKey, sortDir]);

  async function handleApprove(id: string) {
    try {
      await approveExpense(id);
      toast.success("Expense marked as paid");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectExpense(id);
      toast.success("Expense rejected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      toast.success("Expense removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete expense");
    }
  }

  const totalFiltered = sorted.reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = sorted
    .filter((e) => e.status === "APPROVED")
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-36">
              <span>
                {statusFilter === "all"
                  ? "All statuses"
                  : (STATUS_CONFIG[statusFilter as keyof typeof STATUS_CONFIG]?.label ?? "All statuses")}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
            <SelectTrigger className="w-44">
              <span>
                {categoryFilter === "all"
                  ? "All categories"
                  : (categories.find((c) => c.id === categoryFilter)?.name ?? "All categories")}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditExpense(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" />
          Submit Expense
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {(() => { const sp = { sortKey, sortDir, toggle }; return (<>
                <TableHead><SortButton col="date"        label="Date"         {...sp} /></TableHead>
                <TableHead><SortButton col="description" label="Description"  {...sp} /></TableHead>
                <TableHead><SortButton col="category"    label="Category"     {...sp} /></TableHead>
                <TableHead numeric><SortButton col="amount" label="Amount (Rs)" {...sp} className="justify-end" /></TableHead>
                <TableHead><SortButton col="status"      label="Status"       {...sp} /></TableHead>
                <TableHead><SortButton col="submittedBy" label="Submitted By" {...sp} /></TableHead>
                <TableHead className="w-28" />
              </>); })()}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search || statusFilter !== "all" || categoryFilter !== "all"
                    ? "No expenses match your filters."
                    : "No expenses yet."}
                </TableCell>
              </TableRow>
            )}
            {sorted.map((expense) => {
              const cfg       = STATUS_CONFIG[expense.status];
              const isOwner   = expense.submittedBy === currentUserId;
              const canEdit   = isOwner && expense.status === "SUBMITTED";
              const canDelete = isOwner || canApprove;

              return (
                <TableRow key={expense.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    <DateDisplay date={expense.date} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{expense.description}</div>
                    {expense.notes && (
                      <div className="text-xs text-muted-foreground truncate max-w-48">
                        {expense.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      <Tag className="h-3 w-3" />
                      {expense.categoryName}
                    </Badge>
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cfg.className}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {expense.submittedByName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Approve / Reject — approvers only, pending only */}
                      {canApprove && expense.status === "SUBMITTED" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleApprove(expense.id)}
                            title="Mark as Paid"
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleReject(expense.id)}
                            title="Reject"
                          >
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}

                      {/* Edit — only submitter when pending */}
                      {(canEdit || canApprove) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setEditExpense(expense); setFormOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Delete */}
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                              <AlertDialogDescription>
                                &quot;{expense.description}&quot; — Rs {expense.amount.toFixed(2)}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(expense.id)}>
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

      {/* Footer totals */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {sorted.length} expense{sorted.length !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-6">
            <span className="text-muted-foreground">
              Filtered total:{" "}
              <span className="font-medium text-foreground">
                Rs {totalFiltered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
            {statusFilter !== "REJECTED" && (
              <span className="text-muted-foreground">
                Paid:{" "}
                <span className="font-medium text-green-600">
                  Rs {totalApproved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      <ExpenseForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditExpense(null); }}
        expense={editExpense}
        categories={categories}
      />
    </div>
  );
}
