"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { processSalesReturn } from "../../../actions";

type Product = { id: string; name: string; unitName: string; sellingPrice: number };

type LineItem = {
  key: number;
  productId: string;
  quantity: number | "";
  unitPrice: number | "";
};

let nextKey = 1;
function emptyLine(): LineItem {
  return { key: nextKey++, productId: "", quantity: "", unitPrice: "" };
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReturnFormPage({
  soId,
  products,
  detailHref,
}: {
  soId: string;
  products: Product[];
  detailHref: string;
}) {
  const router = useRouter();
  const [lines,   setLines]   = useState<LineItem[]>(() => [emptyLine()]);
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const listEndRef = useRef<HTMLDivElement>(null);

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function updateLine(key: number, patch: Partial<Omit<LineItem, "key">>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
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
    const returnItems = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        quantity:  Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      }));
    setLoading(true);
    try {
      await processSalesReturn(soId, { notes: notes.trim() || undefined, returnType: "WASTE", items: returnItems });
      toast.success("Waste return recorded successfully");
      router.push(detailHref);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record return");
      setLoading(false);
    }
  }

  const total     = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const itemCount = lines.filter((l) => l.productId && Number(l.quantity) > 0).length;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">

      {/* ── Left: items table ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0 rounded-lg border overflow-x-auto">

        {/* Column headers */}
        <div className="grid grid-cols-[3rem_minmax(12rem,1fr)_8rem_10rem_9rem_3rem] bg-muted/40 border-b min-w-152">
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground">#</div>
          <div className="px-3 py-3 text-xs font-semibold text-muted-foreground">Product</div>
          <div className="px-3 py-3 text-xs font-semibold text-muted-foreground text-right">Quantity</div>
          <div className="px-3 py-3 text-xs font-semibold text-muted-foreground text-right">Unit Price (Rs)</div>
          <div className="px-3 py-3 text-xs font-semibold text-muted-foreground text-right">Total (Rs)</div>
          <div />
        </div>

        {/* Rows */}
        <div className="divide-y">
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
                className={`grid grid-cols-[3rem_minmax(12rem,1fr)_8rem_10rem_9rem_3rem] items-start transition-colors min-w-152 ${
                  hasRowErr ? "bg-destructive/5" : "hover:bg-muted/20"
                }`}
              >
                {/* Row number */}
                <div className="px-4 py-3 text-sm font-medium text-muted-foreground/50 tabular-nums self-center">
                  {idx + 1}
                </div>

                {/* Product */}
                <div className="px-3 py-2.5 space-y-1">
                  <Select
                    value={line.productId}
                    onValueChange={(v) => {
                      if (!v) return;
                      const p = products.find((pr) => pr.id === v);
                      updateLine(line.key, { productId: v, unitPrice: p?.sellingPrice ?? "" });
                    }}
                  >
                    <SelectTrigger
                      className={`h-9 w-full text-sm ${errProd ? "border-destructive ring-1 ring-destructive/30" : ""}`}
                    >
                      <SelectValue placeholder="Choose a product…">
                        {products.find((p) => p.id === line.productId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent searchable>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id} label={p.name}>
                          {p.name}{" "}
                          <span className="text-xs text-muted-foreground">({p.unitName})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    className={`h-9 text-sm text-right tabular-nums ${errQty ? "border-destructive ring-1 ring-destructive/30" : ""}`}
                  />
                  {errQty && <p className="text-[11px] text-destructive text-right">{errQty}</p>}
                </div>

                {/* Unit price */}
                <div className="px-3 py-2.5 space-y-1">
                  <Input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.key, {
                      unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                    })}
                    className={`h-9 text-sm text-right tabular-nums ${errPrice ? "border-destructive ring-1 ring-destructive/30" : ""}`}
                  />
                  {errPrice && <p className="text-[11px] text-destructive text-right">{errPrice}</p>}
                </div>

                {/* Line total */}
                <div className="px-3 py-2.5 flex items-center justify-end min-h-11">
                  {lineTotal > 0 ? (
                    <span className="text-sm tabular-nums font-semibold text-orange-600">
                      {fmt(lineTotal)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30 text-sm">—</span>
                  )}
                </div>

                {/* Delete */}
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
        <div className="px-4 py-3 border-t bg-muted/20" ref={listEndRef}>
          <Button
            type="button" variant="outline" size="sm"
            onClick={addLine}
            className="gap-1.5 text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Another Item
          </Button>
        </div>
      </div>

      {/* ── Right: summary + notes + actions ──────────────────────── */}
      <div className="w-full xl:w-80 xl:shrink-0 rounded-lg border bg-muted/20 flex flex-col xl:sticky xl:top-6">

        {/* Summary */}
        <div className="p-5 space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Summary
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rows</span>
              <span className="font-medium tabular-nums">{lines.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items filled</span>
              <span className="font-medium tabular-nums">{itemCount}</span>
            </div>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium mt-0.5">Total Deducted</span>
            <span className={`text-xl font-bold tabular-nums leading-tight ${total > 0 ? "text-orange-600" : "text-muted-foreground/30"}`}>
              {total > 0 ? `Rs ${fmt(total)}` : "—"}
            </span>
          </div>
          {total > 0 && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This will be deducted from the invoice. Commission is recalculated on the net amount.
            </p>
          )}
        </div>

        <Separator />

        {/* Notes */}
        <div className="p-5 space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notes{" "}
            <span className="normal-case font-normal tracking-normal">(optional)</span>
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="e.g. expired on 2025-04-14, packaging damaged, returned from Lalitpur route..."
            className="text-sm resize-none"
          />
        </div>

        <Separator />

        {/* Actions */}
        <div className="p-5 space-y-3">
          {errors["_global"] && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errors["_global"]}
            </div>
          )}
          {hasErrors && !errors["_global"] && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Fix the errors highlighted in the rows
            </div>
          )}
          <Button
            className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleSubmit}
            disabled={loading}
          >
            <RotateCcw className="h-4 w-4" />
            {loading ? "Recording…" : "Record Waste Return"}
          </Button>
          <Button
            variant="outline" className="w-full"
            onClick={() => router.push(detailHref)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>

      </div>
    </div>
  );
}
