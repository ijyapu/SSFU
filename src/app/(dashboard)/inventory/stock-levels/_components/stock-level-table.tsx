"use client";

import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";

type StockItem = {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  costPrice: number;
  stockValue: number;
  status: "ok" | "low" | "out";
  category: { name: string };
  unit: { name: string };
};

type Props = {
  items: StockItem[];
  totalValue: number;
};

const STATUS_CONFIG = {
  ok:  { label: "OK",          icon: CheckCircle,  className: "text-green-600",  badge: "bg-emerald-100 text-emerald-700" },
  low: { label: "Low Stock",   icon: AlertTriangle, className: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  out: { label: "Out of Stock", icon: XCircle,      className: "text-destructive", badge: "bg-red-100 text-red-700" },
};

export function StockLevelTable({ items, totalValue }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { sortKey, sortDir, toggle } = useSortable("currentStock");

  const categories = [...new Set(items.map((i) => i.category.name))].sort();

  const filtered = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    const matchCat = categoryFilter === "all" || item.category.name === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVals: Record<string, string | number> = { name: a.name, category: a.category.name, currentStock: a.currentStock, reorderLevel: a.reorderLevel, stockValue: a.stockValue, status: a.status };
      const bVals: Record<string, string | number> = { name: b.name, category: b.category.name, currentStock: b.currentStock, reorderLevel: b.reorderLevel, stockValue: b.stockValue, status: b.status };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [filtered, sortKey, sortDir]);

  const filteredValue = filtered.reduce((sum, i) => sum + i.stockValue, 0);

  function StockBar({ item }: { item: StockItem }) {
    if (item.reorderLevel === 0) return null;
    const pct = Math.min((item.currentStock / (item.reorderLevel * 2)) * 100, 100);
    const color =
      item.status === "out" ? "bg-destructive" :
      item.status === "low" ? "bg-amber-400" : "bg-green-500";
    return (
      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search product or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {(() => { const sp = { sortKey, sortDir, toggle }; return (
            <TableRow>
              <TableHead><SortButton col="name"         label="Product"       {...sp} /></TableHead>
              <TableHead><SortButton col="category"     label="Category"      {...sp} /></TableHead>
              <TableHead numeric><SortButton col="currentStock" label="Current Stock" {...sp} className="justify-end" /></TableHead>
              <TableHead numeric><SortButton col="reorderLevel" label="Reorder At"    {...sp} className="justify-end" /></TableHead>
              <TableHead numeric><SortButton col="stockValue"   label="Stock Value"   {...sp} className="justify-end" /></TableHead>
              <TableHead><SortButton col="status"       label="Status"        {...sp} /></TableHead>
            </TableRow>
            ); })()}
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No products match your filters.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((item) => {
              const cfg = STATUS_CONFIG[item.status];
              const StatusIcon = cfg.icon;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.category.name}</Badge>
                  </TableCell>
                  <TableCell numeric>
                    <div className={`font-medium ${item.status !== "ok" ? cfg.className : ""}`}>
                      {item.currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      <span className="text-xs text-muted-foreground ml-1">{item.unit.name}</span>
                    </div>
                    <StockBar item={item} />
                  </TableCell>
                  <TableCell numeric className="text-muted-foreground">
                    {item.reorderLevel > 0
                      ? `${item.reorderLevel.toLocaleString()} ${item.unit.name}`
                      : "—"}
                  </TableCell>
                  <TableCell numeric>
                    {item.stockValue > 0
                      ? `Rs ${item.stockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : <span className="text-muted-foreground">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={`h-3.5 w-3.5 ${cfg.className}`} />
                      <Badge variant="secondary" className={cfg.badge}>
                        {cfg.label}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer totals */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {sorted.length} of {items.length} products
        </span>
        <div className="flex items-center gap-6 text-muted-foreground">
          <span>
            Showing value:{" "}
            <span className="font-medium text-foreground">
              Rs {filteredValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
          <span>
            Total inventory:{" "}
            <span className="font-medium text-foreground">
              Rs {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
