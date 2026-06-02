"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle, RotateCcw, PackageCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ProductComboboxField } from "@/components/ui/product-combobox-field";
import { updateSalesReturn } from "../../actions";

type Product  = { id: string; name: string; unitName: string; sellingPrice: number };
type LineItem = { key: number; productId: string; quantity: number | ""; unitPrice: number | "" };

export type EditableReturn = {
  id:           string;
  returnNumber: string;
  returnType:   "WASTE" | "FRESH";
  notes:        string | null;
  totalAmount:  number;
  items: {
    id:          string;
    productId:   string;
    productName: string;
    unitName:    string;
    quantity:    number;
    unitPrice:   number;
    totalPrice:  number;
  }[];
};

type Props = {
  open:     boolean;
  onClose:  () => void;
  ret:      EditableReturn;
  products: Product[];
};

let nextKey = 1000;
function makeKey() { return nextKey++; }

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReturnEditDialog({ open, onClose, ret, products }: Props) {
  const isFresh = ret.returnType === "FRESH";
  const router  = useRouter();

  const [lines,   setLines]   = useState<LineItem[]>([]);
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setLines(ret.items.map((i) => ({
        key:       makeKey(),
        productId: i.productId,
        quantity:  i.quantity,
        unitPrice: i.unitPrice,
      })));
      setNotes(ret.notes ?? "");
      setErrors({});
    }
  }, [open, ret]);

  function addLine() {
    setLines((prev) => [...prev, { key: makeKey(), productId: "", quantity: "", unitPrice: "" }]);
  }

  function removeLine(key: number) {
    setLines((prev) => prev.length > 1 ? prev.filter((l) => l.key !== key) : prev);
  }

  function updateLine(key: number, patch: Partial<Omit<LineItem, "key">>) {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${key}_productId`];
      delete next[`${key}_quantity`];
      delete next[`${key}_unitPrice`];
      delete next["_global"];
      return next;
    });
  }

  function validate() {
    const errs: Record<string, string> = {};
    let hasAny = false;
    for (const l of lines) {
      const qty   = Number(l.quantity);
      const price = Number(l.unitPrice);
      if (!l.productId)                          errs[`${l.key}_productId`] = "Select a product";
      if (l.quantity === "")                     errs[`${l.key}_quantity`]  = "Required";
      else if (qty <= 0)                         errs[`${l.key}_quantity`]  = "Must be > 0";
      if (l.unitPrice === "")                    errs[`${l.key}_unitPrice`] = "Required";
      else if (price < 0)                        errs[`${l.key}_unitPrice`] = "Must be ≥ 0";
      if (l.productId && qty > 0 && price >= 0) hasAny = true;
    }
    if (!hasAny && Object.keys(errs).length === 0) errs["_global"] = "Add at least one valid item";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }));
    setLoading(true);
    try {
      await updateSalesReturn(ret.id, { items, notes: notes.trim() || undefined });
      toast.success("Return updated");
      router.refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update return");
    } finally {
      setLoading(false);
    }
  }

  const total      = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const hasErrors  = Object.keys(errors).length > 0;
  const accentText = isFresh ? "text-green-700" : "text-orange-700";
  const accentBg   = isFresh ? "bg-green-50/60 dark:bg-green-950/20" : "bg-orange-50/60 dark:bg-orange-950/20";
  const accentBorder = isFresh ? "border-green-200 dark:border-green-800" : "border-orange-200 dark:border-orange-800";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full max-h-[92vh] flex flex-col p-0 gap-0">

        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {isFresh
              ? <PackageCheck className="h-5 w-5 text-green-600" />
              : <RotateCcw className="h-5 w-5 text-orange-600" />
            }
            Edit {isFresh ? "Fresh" : "Waste"} Return
            <span className="font-mono text-sm text-muted-foreground ml-1">— {ret.returnNumber}</span>
          </DialogTitle>
          {isFresh && (
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              Stock adjusts automatically: old quantities are reversed and new quantities are restocked.
            </p>
          )}
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Column headers */}
          <div className={`grid grid-cols-[3rem_minmax(14rem,1fr)_9rem_11rem_10rem_3rem] rounded-md text-xs font-semibold uppercase tracking-wide text-muted-foreground ${accentBg} border ${accentBorder} min-w-176`}>
            <div className="px-3 py-2.5">#</div>
            <div className="px-3 py-2.5">Product</div>
            <div className="px-3 py-2.5 text-right">Quantity</div>
            <div className="px-3 py-2.5 text-right">Unit Price (Rs)</div>
            <div className="px-3 py-2.5 text-right">Total (Rs)</div>
            <div />
          </div>

          {/* Line items */}
          <div className="rounded-md border divide-y overflow-x-auto">
            {lines.map((line, idx) => {
              const qty       = Number(line.quantity) || 0;
              const price     = Number(line.unitPrice) || 0;
              const lineTotal = qty * price;
              const errProd   = errors[`${line.key}_productId`];
              const errQty    = errors[`${line.key}_quantity`];
              const errPrice  = errors[`${line.key}_unitPrice`];
              const hasRowErr = !!(errProd || errQty || errPrice);

              return (
                <div
                  key={line.key}
                  className={`grid grid-cols-[3rem_minmax(14rem,1fr)_9rem_11rem_10rem_3rem] items-start min-w-176 transition-colors ${
                    hasRowErr ? "bg-destructive/5" : "hover:bg-muted/10"
                  }`}
                >
                  {/* Row number */}
                  <div className="px-3 py-3 text-sm font-medium text-muted-foreground/50 tabular-nums self-center">
                    {idx + 1}
                  </div>

                  {/* Product */}
                  <div className="px-3 py-2.5 space-y-1">
                    <ProductComboboxField
                      value={line.productId}
                      options={products.map((p) => ({ id: p.id, name: p.name, meta: p.unitName }))}
                      onSelect={(id) => {
                        const p = products.find((pr) => pr.id === id);
                        updateLine(line.key, { productId: id, unitPrice: p?.sellingPrice ?? "" });
                      }}
                      placeholder="Choose product…"
                      error={!!errProd}
                      triggerHeight="h-9"
                    />
                    {errProd && (
                      <p className="flex items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3" />{errProd}
                      </p>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="px-3 py-2.5 space-y-1">
                    <Input
                      type="number" min="0" step="0.001" placeholder="0"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, {
                        quantity: e.target.value === "" ? "" : parseFloat(e.target.value),
                      })}
                      className={`h-9 text-sm text-right tabular-nums ${errQty ? "border-destructive" : ""}`}
                    />
                    {errQty && <p className="text-[11px] text-destructive text-right">{errQty}</p>}
                  </div>

                  {/* Unit Price */}
                  <div className="px-3 py-2.5 space-y-1">
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, {
                        unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                      })}
                      className={`h-9 text-sm text-right tabular-nums ${errPrice ? "border-destructive" : ""}`}
                    />
                    {errPrice && <p className="text-[11px] text-destructive text-right">{errPrice}</p>}
                  </div>

                  {/* Line total */}
                  <div className="px-3 py-2.5 flex items-center justify-end min-h-11">
                    {lineTotal > 0
                      ? <span className={`text-sm tabular-nums font-semibold ${accentText}`}>{fmt(lineTotal)}</span>
                      : <span className="text-muted-foreground/30 text-sm">—</span>
                    }
                  </div>

                  {/* Remove */}
                  <div className="flex items-center justify-center min-h-11">
                    <Button
                      type="button" variant="ghost" size="icon"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 disabled:opacity-20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add row */}
          <Button
            type="button" variant="outline" size="sm"
            onClick={addLine}
            className="gap-1.5 text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>

          <Separator />

          {/* Notes + total side by side */}
          <div className="flex gap-6 items-start">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Notes <span className="normal-case font-normal tracking-normal">(optional)</span>
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. expired, damaged packaging..."
                className="text-sm resize-none"
              />
            </div>

            <div className={`rounded-lg border ${accentBg} ${accentBorder} p-4 min-w-48 space-y-2 shrink-0`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isFresh ? "Total Returned" : "Total Deducted"}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${total > 0 ? accentText : "text-muted-foreground/40"}`}>
                {total > 0 ? `Rs ${fmt(total)}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {lines.filter((l) => l.productId && Number(l.quantity) > 0).length} item(s)
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-4">
          <div>
            {errors["_global"] && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />{errors["_global"]}
              </p>
            )}
            {hasErrors && !errors["_global"] && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />Fix the errors in the rows above
              </p>
            )}
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading} className="min-w-32">
              {loading ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </div>

      </DialogContent>
    </Dialog>
  );
}
