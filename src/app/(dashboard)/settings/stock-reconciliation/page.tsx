import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { ERPPageHeader } from "@/components/ui/erp-page-header";
import { ERPSection } from "@/components/ui/erp-section";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmptyRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { AlertTriangle, CheckCircle2, Package } from "lucide-react";

export const metadata = { title: "Stock Reconciliation" };

const INCREASE_TYPES = new Set([
  "PURCHASE", "ADJUSTMENT_IN", "RETURN_IN", "DAILY_IN",
]);

export default async function StockReconciliationPage() {
  await requirePermission("settings");

  // Fetch all active products with their unit
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id:           true,
      name:         true,
      sku:          true,
      currentStock: true,
      unit:         { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  // Aggregate stock movements per product per type
  const movements = await prisma.stockMovement.groupBy({
    by:   ["productId", "type"],
    _sum: { quantity: true },
  });

  // Build a map: productId → { in: number, out: number }
  const movMap = new Map<string, { inQty: number; outQty: number }>();
  for (const m of movements) {
    if (!movMap.has(m.productId)) movMap.set(m.productId, { inQty: 0, outQty: 0 });
    const entry = movMap.get(m.productId)!;
    const qty   = Number(m._sum.quantity ?? 0);
    if (INCREASE_TYPES.has(m.type)) entry.inQty  += qty;
    else                             entry.outQty += qty;
  }

  // Build reconciliation rows
  type RecRow = {
    id:            string;
    name:          string;
    sku:           string;
    unit:          string;
    currentStock:  number;
    expectedStock: number;
    difference:    number;
    ok:            boolean;
  };

  const rows: RecRow[] = products.map((p) => {
    const { inQty = 0, outQty = 0 } = movMap.get(p.id) ?? {};
    const expectedStock = inQty - outQty;
    const currentStock  = Number(p.currentStock);
    const difference    = currentStock - expectedStock;
    return {
      id:           p.id,
      name:         p.name,
      sku:          p.sku,
      unit:         p.unit.name,
      currentStock,
      expectedStock,
      difference,
      ok:           Math.abs(difference) < 0.0005,
    };
  });

  // Mismatches first, then matched — secondary sort by name
  rows.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  // Summary stats
  const totalChecked  = rows.length;
  const totalOk       = rows.filter((r) => r.ok).length;
  const totalMismatch = totalChecked - totalOk;
  const totalVariance = rows.reduce((s, r) => s + Math.abs(r.difference), 0);

  return (
    <div className="space-y-6">
      <ERPPageHeader
        title="Stock Reconciliation"
        subtitle="Verify that Product.currentStock matches the balance calculated from StockMovement history."
      />

      {/* Explanation */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <strong className="text-foreground">How this works:</strong>{" "}
        <span>
          StockMovement is the authoritative audit trail — every stock change
          (purchase, sale, adjustment, return, daily log) writes a record here.
          Product.currentStock is a cached live total updated atomically alongside
          each movement. This page checks whether the two agree. A mismatch
          indicates a data integrity issue that should be investigated.
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Products Checked
          </p>
          <p className="text-2xl font-bold tabular-nums mt-0.5">{totalChecked}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Matching
          </p>
          <p className="text-2xl font-bold tabular-nums text-emerald-600 mt-0.5">{totalOk}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Mismatched
          </p>
          <p className={`text-2xl font-bold tabular-nums mt-0.5 ${totalMismatch > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
            {totalMismatch}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Total Variance</p>
          <p className={`text-2xl font-bold tabular-nums mt-0.5 ${totalVariance > 0.0005 ? "text-destructive" : "text-muted-foreground"}`}>
            {formatNumber(totalVariance)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">absolute sum</p>
        </div>
      </div>

      {/* Reconciliation table */}
      <ERPSection
        header={
          <div className="flex items-center justify-between w-full">
            <p className="text-sm font-medium">All Products</p>
            <p className="text-xs text-muted-foreground">
              Expected = Σ(in movements) − Σ(out movements)
            </p>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead numeric>Current Stock</TableHead>
                <TableHead numeric>Expected Stock</TableHead>
                <TableHead numeric>Difference</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmptyRow colSpan={6} message="No active products found." />
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={row.ok ? "" : "bg-amber-50/50 dark:bg-amber-950/20"}
                  >
                    <TableCell>
                      <div className="font-medium text-sm">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.unit}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{row.sku}</span>
                    </TableCell>
                    <TableCell numeric>
                      <span className="tabular-nums">{formatNumber(row.currentStock)}</span>
                    </TableCell>
                    <TableCell numeric>
                      <span className="tabular-nums">{formatNumber(row.expectedStock)}</span>
                    </TableCell>
                    <TableCell numeric>
                      {row.ok ? (
                        <span className="tabular-nums text-muted-foreground">0.000</span>
                      ) : (
                        <span className={`tabular-nums font-semibold ${row.difference > 0 ? "text-blue-600" : "text-destructive"}`}>
                          {row.difference > 0 ? "+" : ""}
                          {formatNumber(row.difference)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.ok ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Mismatch
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ERPSection>

      {/* Legend */}
      <div className="text-xs text-muted-foreground space-y-1 px-1">
        <p>
          <strong className="text-foreground">Increase movements (+):</strong>{" "}
          PURCHASE, ADJUSTMENT_IN, RETURN_IN, DAILY_IN
        </p>
        <p>
          <strong className="text-foreground">Decrease movements (−):</strong>{" "}
          SALE, ADJUSTMENT_OUT, RETURN_OUT, DAILY_OUT
        </p>
        <p>
          <strong className="text-foreground">Difference:</strong>{" "}
          currentStock − expectedStock. Positive = cached stock is higher than
          movements imply. Negative = lower. Zero = consistent.
        </p>
      </div>
    </div>
  );
}
