"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface SalesmanSalesRow {
  customerId: string;
  salesmanName: string;
  orderCount: number;
  totalRevenue: number;
  totalPaid: number;
  outstanding: number;
  avgOrderValue: number;
}

interface Props {
  rows: SalesmanSalesRow[];
  from: string;
  to: string;
  totalRevenue: number;
}

type SortKey = "salesmanName" | "orderCount" | "totalRevenue" | "totalPaid" | "outstanding" | "avgOrderValue";

const Rs = (n: number) =>
  "Rs " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

const PRESETS = [
  { label: "This Month",    from: () => fmt(startOfMonth(new Date())), to: () => fmt(endOfMonth(new Date())) },
  { label: "Last Month",    from: () => fmt(startOfMonth(subMonths(new Date(), 1))), to: () => fmt(endOfMonth(subMonths(new Date(), 1))) },
  { label: "Last 3 Months", from: () => fmt(startOfMonth(subMonths(new Date(), 2))), to: () => fmt(endOfMonth(new Date())) },
  { label: "This Year",     from: () => fmt(startOfYear(new Date())), to: () => fmt(endOfMonth(new Date())) },
];

export function SalesmanSalesTable({ rows, from, to, totalRevenue }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch]   = useState("");

  function navigate(newFrom: string, newTo: string) {
    startTransition(() => router.push(`/reports/sales-by-salesman?from=${newFrom}&to=${newTo}`));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    navigate(fd.get("from") as string, fd.get("to") as string);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) =>
      r.salesmanName.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === "string") {
        const cmp = av.localeCompare(bv as string);
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [rows, sortKey, sortDir, search]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  }

  const Th = ({ col, label, title, right }: { col: SortKey; label: string; title?: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      title={title}
      className={`px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-1">{label}<SortIcon col={col} /></span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Date controls */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const pFrom = p.from(), pTo = p.to();
          const active = from === pFrom && to === pTo;
          return (
            <button
              key={p.label}
              onClick={() => navigate(pFrom, pTo)}
              disabled={pending}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
            >
              {p.label}
            </button>
          );
        })}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 ml-2">
          <input type="date" name="from" defaultValue={from} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          <span className="text-muted-foreground text-sm">to</span>
          <input type="date" name="to" defaultValue={to} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          <button type="submit" disabled={pending} className="px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Apply</button>
        </form>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-6 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-bold">{Rs(totalRevenue)}</p>
          <p className="text-[11px] text-muted-foreground/70">All salesmen combined</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Salesmen</p>
          <p className="text-xl font-bold">{rows.length}</p>
          <p className="text-[11px] text-muted-foreground/70">Active in this period</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Period</p>
          <p className="text-sm font-medium">
            {format(new Date(from), "d MMM yyyy")} — {format(new Date(to), "d MMM yyyy")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Sales by Salesman</CardTitle>
            <input
              type="search"
              placeholder="Search salesman..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm w-48"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
                  <Th col="salesmanName"  label="Salesman" />
                  <Th col="orderCount"    label="Orders"      title="Number of sales orders placed"    right />
                  <Th col="totalRevenue"  label="Revenue"     title="Total billed amount (inc. commission)" right />
                  <Th col="totalPaid"     label="Collected"   title="Cash payments received so far"    right />
                  <Th col="outstanding"   label="Outstanding" title="Unpaid balance still owed"        right />
                  <Th col="avgOrderValue" label="Avg Order"   title="Average value per order"          right />
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No sales in this period.
                    </td>
                  </tr>
                )}
                {sorted.map((row, i) => (
                  <tr key={row.customerId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{row.salesmanName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.orderCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{Rs(row.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Rs(row.totalPaid)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${row.outstanding > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {Rs(row.outstanding)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Rs(row.avgOrderValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
