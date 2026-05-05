"use client";

import { useState } from "react";
import { DateDisplay } from "@/components/ui/date-display";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Movement = {
  id: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  notes: string | null;
  createdAt: string;
  referenceType: string | null;
  referenceId: string | null;
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ADJUSTMENT_IN:  { label: "Adjustment In",  color: "bg-emerald-100 text-emerald-700" },
  ADJUSTMENT_OUT: { label: "Adjustment Out", color: "bg-red-100 text-red-700" },
  PURCHASE:       { label: "Purchase",        color: "bg-blue-100 text-blue-700" },
  SALE:           { label: "Sale",            color: "bg-amber-100 text-amber-700" },
  PRODUCTION_IN:  { label: "Production In",  color: "bg-emerald-100 text-emerald-700" },
  PRODUCTION_OUT: { label: "Production Out", color: "bg-amber-100 text-amber-700" },
  RETURN_IN:      { label: "Return In",       color: "bg-emerald-100 text-emerald-700" },
  RETURN_OUT:     { label: "Return Out",      color: "bg-red-100 text-red-700" },
  OPENING_STOCK:  { label: "Opening Stock",  color: "bg-slate-100 text-slate-600" },
};

export function ProductMovementHistory({
  movements,
  unit,
}: {
  movements: Movement[];
  unit: string;
}) {
  const [typeFilter, setTypeFilter] = useState("all");

  const types = [...new Set(movements.map((m) => m.type))];

  const filtered = typeFilter === "all"
    ? movements
    : movements.filter((m) => m.type === typeFilter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]?.label ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} records</span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No movements recorded.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => {
              const cfg = TYPE_LABELS[m.type] ?? { label: m.type, color: "bg-gray-100 text-gray-700" };
              const isIn = m.quantity > 0;
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    <DateDisplay date={m.createdAt} fmt="dd MMM yyyy, HH:mm" />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cfg.color}>
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={isIn ? "text-green-600" : "text-destructive"}>
                      {isIn ? "+" : ""}{m.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">{unit}</span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {m.stockBefore.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {m.stockAfter.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {m.notes ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
