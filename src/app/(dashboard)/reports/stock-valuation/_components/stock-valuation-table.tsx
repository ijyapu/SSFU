"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";

export interface StockRow {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  costPrice: number;
  totalValue: number;
  reorderLevel: number;
  belowReorder: boolean;
}

export interface StockCategory {
  name: string;
  products: StockRow[];
  subtotal: number;
}

interface Props {
  categories: StockCategory[];
  grandTotal: number;
  asOf: string;
}

const Rs = (n: number) =>
  "Rs " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function StockValuationTable({ categories, grandTotal, asOf }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { sortKey, sortDir, toggle: sortToggle } = useSortable("name");

  function sortProducts(products: StockRow[]) {
    if (!sortKey) return products;
    return [...products].sort((a, b) => {
      const aVals: Record<string, string | number> = { name: a.name, currentStock: a.currentStock, reorderLevel: a.reorderLevel, costPrice: a.costPrice, totalValue: a.totalValue };
      const bVals: Record<string, string | number> = { name: b.name, currentStock: b.currentStock, reorderLevel: b.reorderLevel, costPrice: b.costPrice, totalValue: b.totalValue };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }

  function toggle(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); } else { next.add(name); }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm text-muted-foreground">Total Inventory Value</p>
          <p className="text-2xl font-bold">{Rs(grandTotal)}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">Current stock × cost price per product</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">As of</p>
          <p className="text-sm font-medium">{asOf}</p>
        </div>
      </div>

      {/* Category groups */}
      {categories.map((cat) => {
        const isCollapsed = collapsed.has(cat.name);
        return (
          <Card key={cat.name}>
            <CardHeader
              className="pb-2 cursor-pointer select-none"
              onClick={() => toggle(cat.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed
                    ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    ({cat.products.length} product{cat.products.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <span className="text-sm font-semibold">{Rs(cat.subtotal)}</span>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-t border-border bg-muted/20">
                    {(() => { const sp = { sortKey, sortDir, toggle: sortToggle }; return (
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground"><SortButton col="name"         label="Product"    {...sp} /></th>
                      <th title="Current quantity on hand" className="px-4 py-2 text-right tabular-nums text-xs font-medium text-muted-foreground"><SortButton col="currentStock" label="Stock"      {...sp} className="justify-end" /></th>
                      <th title="Minimum quantity before reordering" className="px-4 py-2 text-right tabular-nums text-xs font-medium text-muted-foreground"><SortButton col="reorderLevel" label="Reorder"    {...sp} className="justify-end" /></th>
                      <th title="Purchase price per unit" className="px-4 py-2 text-right tabular-nums text-xs font-medium text-muted-foreground"><SortButton col="costPrice"    label="Cost Price" {...sp} className="justify-end" /></th>
                      <th title="Stock × cost price" className="px-4 py-2 text-right tabular-nums text-xs font-medium text-muted-foreground"><SortButton col="totalValue"   label="Value"      {...sp} className="justify-end" /></th>
                    </tr>
                    ); })()}
                  </thead>
                  <tbody>
                    {sortProducts(cat.products).map((p) => (
                      <tr
                        key={p.id}
                        className={`border-t border-border last:border-0 ${p.belowReorder ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                      >
                        <td className="px-4 py-2">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.sku}</div>
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums ${p.belowReorder ? "text-amber-600 font-medium" : ""}`}>
                          {p.currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                          <span className="text-xs text-muted-foreground ml-1">{p.unit}</span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground text-xs">
                          {p.reorderLevel > 0
                            ? p.reorderLevel.toLocaleString(undefined, { maximumFractionDigits: 3 })
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{Rs(p.costPrice)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">{Rs(p.totalValue)}</td>
                      </tr>
                    ))}
                    {/* Category subtotal */}
                    <tr className="border-t border-border bg-muted/30">
                      <td colSpan={4} className="px-4 py-2 text-xs font-medium text-muted-foreground">
                        {cat.name} subtotal
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-sm">
                        {Rs(cat.subtotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Grand total */}
      <div className="flex justify-end">
        <div className="rounded-lg border border-border px-6 py-3 bg-muted/30">
          <span className="text-sm text-muted-foreground mr-4">Grand Total</span>
          <span className="text-lg font-bold">{Rs(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
