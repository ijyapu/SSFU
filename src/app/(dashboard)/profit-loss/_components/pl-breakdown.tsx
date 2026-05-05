"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type CategoryLine = { name: string; amount: number };

type Props = {
  revenue:    number;
  cogs:       number;
  expenses:   CategoryLine[];
  payroll:    number;
};

function fmt(n: number) {
  return `Rs ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ProfitIndicator({ value }: { value: number }) {
  if (value > 0) return <TrendingUp   className="h-5 w-5 text-green-600" />;
  if (value < 0) return <TrendingDown className="h-5 w-5 text-destructive" />;
  return                <Minus        className="h-5 w-5 text-muted-foreground" />;
}

export function PlBreakdown({ revenue, cogs, expenses, payroll }: Props) {
  const grossProfit       = revenue - cogs;
  const totalExpenses     = expenses.reduce((s, e) => s + e.amount, 0);
  const totalOpex         = totalExpenses + payroll;
  const netProfit         = grossProfit - totalOpex;
  const grossMarginPct    = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMarginPct      = revenue > 0 ? (netProfit   / revenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(revenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Net sales after commission</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {fmt(grossProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue minus cost of goods · {grossMarginPct.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Operating Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{fmt(totalOpex)}</p>
            <p className="text-xs text-muted-foreground mt-1">Approved costs + finalized payroll</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Net Profit
              <ProfitIndicator value={netProfit} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {fmt(netProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              After all costs deducted · {netMarginPct.toFixed(1)}% net margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed breakdown */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Income statement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between font-medium">
              <span>Revenue</span>
              <span className="text-green-700">{fmt(revenue)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Cost of Goods Sold (COGS)</span>
              <span className="text-destructive">({fmt(cogs)})</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Gross Profit</span>
              <span className={grossProfit >= 0 ? "text-green-600" : "text-destructive"}>
                {fmt(grossProfit)}
              </span>
            </div>

            {/* Operating expenses */}
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Operating Expenses
              </p>
              {expenses.map((line) => (
                <div key={line.name} className="flex justify-between text-muted-foreground">
                  <span className="pl-2">— {line.name}</span>
                  <span className="text-destructive">({fmt(line.amount)})</span>
                </div>
              ))}
              {payroll > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="pl-2">— Payroll</span>
                  <span className="text-destructive">({fmt(payroll)})</span>
                </div>
              )}
              {totalOpex === 0 && (
                <p className="text-muted-foreground pl-2 text-xs">No approved expenses or finalized payroll.</p>
              )}
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Net Profit / (Loss)</span>
              <span className={netProfit >= 0 ? "text-green-600" : "text-destructive"}>
                {netProfit >= 0 ? fmt(netProfit) : `(${fmt(Math.abs(netProfit))})`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Expense breakdown by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalOpex === 0 ? (
              <p className="text-muted-foreground text-sm">No expenses in this period.</p>
            ) : (
              <>
                {payroll > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">Payroll</span>
                      <span>{fmt(payroll)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (payroll / totalOpex) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                )}
                {expenses.map((line) => (
                  <div key={line.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{line.name}</span>
                      <span>{fmt(line.amount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-muted-foreground/40 rounded-full"
                        style={{ width: `${Math.min(100, (line.amount / totalOpex) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{fmt(totalOpex)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
