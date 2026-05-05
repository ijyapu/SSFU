import { AlertCircle, FileText, ShoppingCart, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeferredItem } from "../actions";

function fmtRs(n: number): string {
  return "Rs " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-amber-500 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function DeferredRow({ item }: { item: DeferredItem }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-sm">{item.label}</div>
        <div className="text-xs text-muted-foreground">{item.reference}</div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{item.dateLabel}</td>
      <td className="px-4 py-3 text-right tabular-nums text-sm">{fmtRs(item.totalAmount)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-green-700">{fmtRs(item.paidAmount)}</td>
      <td className="px-4 py-3 min-w-[120px]">
        <div className="text-right tabular-nums text-sm font-semibold text-amber-700 mb-1">
          {fmtRs(item.remaining)}
        </div>
        <ProgressBar paid={item.paidAmount} total={item.totalAmount} />
      </td>
    </tr>
  );
}

type SectionProps = {
  title: string;
  icon: React.ReactNode;
  items: DeferredItem[];
  emptyMsg: string;
};

function Section({ title, icon, items, emptyMsg }: SectionProps) {
  const total = items.reduce((s, i) => s + i.remaining, 0);
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
          <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
        </div>
        {items.length > 0 && (
          <span className="text-sm font-semibold text-amber-700 tabular-nums">{fmtRs(total)} owed</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground italic">{emptyMsg}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/10">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Paid</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Remaining</th>
              </tr>
            </thead>
            <tbody>{items.map((item) => <DeferredRow key={item.id} item={item} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type Props = { items: DeferredItem[] };

export function DeferredPanel({ items }: Props) {
  const invoices = items.filter((i) => i.type === "purchase_invoice");
  const orders   = items.filter((i) => i.type === "purchase_order");
  const payroll  = items.filter((i) => i.type === "payroll");
  const grandTotal = items.reduce((s, i) => s + i.remaining, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle>Deferred Obligations</CardTitle>
            {items.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                <AlertCircle className="h-3 w-3" />
                {items.length} outstanding
              </span>
            )}
          </div>
          {grandTotal > 0 && (
            <span className="text-sm font-semibold text-amber-700">
              Total outstanding: {fmtRs(grandTotal)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Amounts committed but not yet paid in cash — purchase invoices on credit, partial purchase orders, and finalized payroll not yet disbursed.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          <Section
            title="Purchase Invoices (credit)"
            icon={<FileText className="h-4 w-4 text-orange-600" />}
            items={invoices}
            emptyMsg="No unpaid purchase invoices."
          />
          <Section
            title="Purchase Orders"
            icon={<ShoppingCart className="h-4 w-4 text-amber-600" />}
            items={orders}
            emptyMsg="No outstanding purchase orders."
          />
          <Section
            title="Payroll"
            icon={<Users className="h-4 w-4 text-purple-600" />}
            items={payroll}
            emptyMsg="All finalized payroll has been disbursed."
          />
        </div>
      </CardContent>
    </Card>
  );
}
