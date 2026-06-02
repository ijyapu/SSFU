"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, RotateCcw, PackageCheck, AlertCircle, SquarePen } from "lucide-react";
import { toNepaliDateString } from "@/lib/nepali-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProductComboboxField } from "@/components/ui/product-combobox-field";
import { Separator } from "@/components/ui/separator";
import { processSalesReturn } from "../../actions";

type Product  = { id: string; name: string; unitName: string; sellingPrice: number };
type LineItem = { key: number; productId: string; quantity: number | ""; unitPrice: number | "" };

type PreviousReturnItem = {
  id:          string;
  productId:   string;
  productName: string;
  unitName:    string;
  quantity:    number;
  unitPrice:   number;
  totalPrice:  number;
};

type PreviousReturn = {
  id: string;
  returnNumber: string;
  returnType?: "WASTE" | "FRESH";
  notes: string | null;
  totalAmount: number;
  createdAt: string;
  items: PreviousReturnItem[];
};

let nextKey = 1;
function emptyLine(): LineItem {
  return { key: nextKey++, productId: "", quantity: "", unitPrice: "" };
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReturnFormInline({
  soId,
  products,
  previousReturns = [],
  returnType = "WASTE",
}: {
  soId:            string;
  products:        Product[];
  previousReturns?: PreviousReturn[];
  returnType?:     "WASTE" | "FRESH";
}) {
  const isFresh = returnType === "FRESH";
  const router = useRouter();
  const [lines,   setLines]   = useState<LineItem[]>(() => [emptyLine()]);
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
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
    setSuccess(false);
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
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }));
    setLoading(true);
    try {
      await processSalesReturn(soId, { notes: notes.trim() || undefined, returnType, items: returnItems });
      toast.success(isFresh ? "Fresh return recorded — stock restocked" : "Waste return recorded");
      // Reset form for next entry
      setLines([emptyLine()]);
      setNotes("");
      setSuccess(true);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record return");
    } finally {
      setLoading(false);
    }
  }

  const total     = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const hasErrors = Object.keys(errors).length > 0;

  const accentBg   = isFresh ? "bg-green-50/30 dark:bg-green-950/10"   : "bg-orange-50/30 dark:bg-orange-950/10";
  const accentHead = isFresh ? "bg-green-100/60 dark:bg-green-950/20"  : "bg-orange-100/60 dark:bg-orange-950/20";
  const accentIcon = isFresh ? "text-green-600"  : "text-orange-600";
  const accentText = isFresh ? "text-green-600"  : "text-orange-600";
  const accentBtn  = isFresh
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-orange-600 hover:bg-orange-700 text-white";

  return (
    <div className={`rounded-lg border ${accentBg}`}>

      {/* Section header */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${accentHead} rounded-t-lg`}>
        {isFresh
          ? <PackageCheck className={`h-4 w-4 ${accentIcon}`} />
          : <RotateCcw className={`h-4 w-4 ${accentIcon}`} />
        }
        <span className="font-semibold text-sm">
          {isFresh ? "Record Fresh Return" : "Record Waste Return"}
        </span>
        <span className="text-xs text-muted-foreground">
          {isFresh
            ? "— good condition goods returned to inventory, deducted from invoice"
            : "— expired or damaged goods, deducted from invoice, not restocked"
          }
        </span>
      </div>

      {/* Previously recorded returns */}
      {previousReturns.length > 0 && (
        <div className="border-b">
          <div className="px-4 py-2 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Previously Recorded Returns
          </div>
          <div className="divide-y">
            {previousReturns.map((r) => (
              <div key={r.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-semibold ${isFresh ? "text-green-700" : "text-orange-700"}`}>{r.returnNumber}</span>
                    <span className="text-xs text-muted-foreground flex flex-col leading-snug">
                      <span>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="text-[10px] text-muted-foreground/60">{toNepaliDateString(new Date(r.createdAt))}</span>
                    </span>
                    {r.notes && (
                      <span className="text-xs text-muted-foreground italic">· {r.notes}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold tabular-nums ${isFresh ? "text-green-700" : "text-orange-700"}`}>
                      − Rs {fmt(r.totalAmount)}
                    </span>
                    <Link
                      href={`/sales/${soId}/return/${r.id}/edit`}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Edit return"
                    >
                      <SquarePen className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                <div className="rounded border divide-y text-xs bg-background">
                  <div className="grid grid-cols-[minmax(0,1fr)_7rem_9rem_9rem] px-3 py-1.5 text-muted-foreground font-medium bg-muted/30">
                    <span>Product</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Unit Price</span>
                    <span className="text-right">Total</span>
                  </div>
                  {r.items.map((i) => (
                    <div key={i.id} className="grid grid-cols-[minmax(0,1fr)_7rem_9rem_9rem] px-3 py-1.5">
                      <span>{i.productName} <span className="text-muted-foreground">({i.unitName})</span></span>
                      <span className="text-right tabular-nums">{i.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                      <span className="text-right tabular-nums text-muted-foreground">Rs {i.unitPrice.toFixed(2)}</span>
                      <span className="text-right tabular-nums font-medium">Rs {fmt(i.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row">

        {/* Left: entry table */}
        <div className="flex-1 min-w-0 overflow-x-auto">

          {/* Column headers */}
          <div className="grid grid-cols-[3rem_minmax(12rem,1fr)_8rem_10rem_9rem_3rem] border-b bg-muted/30 min-w-152">
            <div className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">#</div>
            <div className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Product</div>
            <div className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right">Quantity</div>
            <div className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right">Unit Price (Rs)</div>
            <div className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right">Total (Rs)</div>
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
                  className={`grid grid-cols-[3rem_minmax(12rem,1fr)_8rem_10rem_9rem_3rem] min-w-152 items-start transition-colors ${
                    hasRowErr ? "bg-destructive/5" : "hover:bg-muted/10"
                  }`}
                >
                  <div className="px-4 py-2.5 text-sm font-medium text-muted-foreground/50 tabular-nums self-center">
                    {idx + 1}
                  </div>

                  <div className="px-3 py-2 space-y-1">
                    <ProductComboboxField
                      value={line.productId}
                      options={products.map((p) => ({ id: p.id, name: p.name, meta: p.unitName }))}
                      onSelect={(id) => {
                        const p = products.find((pr) => pr.id === id);
                        updateLine(line.key, { productId: id, unitPrice: p?.sellingPrice ?? "" });
                      }}
                      placeholder="Choose product…"
                      error={!!errProd}
                      triggerHeight="h-8"
                    />
                    {errProd && (
                      <p className="flex items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3" />{errProd}
                      </p>
                    )}
                  </div>

                  <div className="px-3 py-2 space-y-1">
                    <Input
                      type="number" min="0" step="0.001" placeholder="0"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, {
                        quantity: e.target.value === "" ? "" : parseFloat(e.target.value),
                      })}
                      className={`h-8 text-sm text-right tabular-nums ${errQty ? "border-destructive" : ""}`}
                    />
                    {errQty && <p className="text-[11px] text-destructive text-right">{errQty}</p>}
                  </div>

                  <div className="px-3 py-2 space-y-1">
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, {
                        unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                      })}
                      className={`h-8 text-sm text-right tabular-nums ${errPrice ? "border-destructive" : ""}`}
                    />
                    {errPrice && <p className="text-[11px] text-destructive text-right">{errPrice}</p>}
                  </div>

                  <div className="px-3 py-2 flex items-center justify-end min-h-10">
                    {lineTotal > 0 ? (
                      <span className={`text-sm tabular-nums font-semibold ${accentText}`}>{fmt(lineTotal)}</span>
                    ) : (
                      <span className="text-muted-foreground/30 text-sm">—</span>
                    )}
                  </div>

                  <div className="flex items-center justify-center min-h-10">
                    <Button
                      type="button" variant="ghost" size="icon"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      className="h-7 w-7 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 disabled:opacity-20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 border-t" ref={listEndRef}>
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Right: notes + summary + actions */}
        <div className="xl:w-64 xl:shrink-0 xl:border-l border-t xl:border-t-0 flex flex-col">

          <div className="p-4 space-y-3 flex-1">
            {/* Running total */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{isFresh ? "Total Returned" : "Total Deducted"}</span>
              <span className={`text-base font-bold tabular-nums ${total > 0 ? accentText : "text-muted-foreground/30"}`}>
                {total > 0 ? `Rs ${fmt(total)}` : "—"}
              </span>
            </div>

            <Separator />

            <div className="space-y-1.5">
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
          </div>

          <div className="p-4 space-y-2 border-t">
            {success && (
              <p className="flex items-center gap-1.5 text-xs text-green-600">
                ✓ {isFresh ? "Fresh return recorded — stock restocked" : "Waste return recorded"} — form reset
              </p>
            )}
            {errors["_global"] && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errors["_global"]}
              </p>
            )}
            {hasErrors && !errors["_global"] && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />Fix errors in the rows
              </p>
            )}
            <Button
              className={`w-full gap-1.5 ${accentBtn}`}
              size="sm"
              onClick={handleSubmit}
              disabled={loading}
            >
              {isFresh
                ? <PackageCheck className="h-3.5 w-3.5" />
                : <RotateCcw className="h-3.5 w-3.5" />
              }
              {loading ? "Recording…" : isFresh ? "Record Fresh Return" : "Record Waste Return"}
            </Button>
          </div>
        </div>

      </div>

    </div>
  );
}
