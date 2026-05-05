import { Fragment } from "react";
import { format } from "date-fns";
import { toNepaliDateString } from "@/lib/nepali-date";
import { ExternalLink } from "lucide-react";
import type { CustomerLedgerEntry } from "../actions";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const METHOD_LABELS: Record<string, string> = {
  CASH:          "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHECK:         "Cheque",
  ESEWA:         "eSewa",
  KHALTI:        "Khalti",
  IME_PAY:       "IME Pay",
  FONEPAY:       "fonePay",
  OTHER:         "Other",
};

const TYPE_CONFIG = {
  INVOICE:    { label: "Invoice",    colorRow: "hover:bg-blue-50/20 dark:hover:bg-blue-950/10",    amtClass: "text-blue-700",    sign: "+" },
  RETURN:     { label: "Return",     colorRow: "hover:bg-orange-50/20 dark:hover:bg-orange-950/10", amtClass: "text-orange-700",  sign: "−" },
  COMMISSION: { label: "Commission", colorRow: "hover:bg-amber-50/20 dark:hover:bg-amber-950/10",  amtClass: "text-amber-700",   sign: "−" },
  PAYMENT:    { label: "Payment",    colorRow: "hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10", amtClass: "text-emerald-700", sign: "−" },
} as const;

const TYPE_ORDER: Record<string, number> = { INVOICE: 0, RETURN: 1, COMMISSION: 2, PAYMENT: 3 };

function DateCell({ date }: { date: string }) {
  const d = new Date(date);
  return (
    <div>
      <div className="text-xs">{format(d, "dd MMM yyyy")}</div>
      <div className="text-[10px] text-muted-foreground/60">{toNepaliDateString(d)}</div>
    </div>
  );
}

type OrderGroup = {
  salesOrderId: string | null;
  groupDate:    string;
  orderRef:     string;
  entries:      CustomerLedgerEntry[];
};

function buildGroups(entries: CustomerLedgerEntry[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>();
  const groups: OrderGroup[] = [];

  for (const e of entries) {
    const key = e.salesOrderId ?? `__standalone__${e.id}`;
    if (!map.has(key)) {
      const g: OrderGroup = {
        salesOrderId: e.salesOrderId,
        groupDate:    e.date,
        orderRef:     e.reference,
        entries:      [],
      };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key)!.entries.push(e);
  }

  for (const g of groups) {
    // Use the invoice date as the group anchor date (for sorting groups)
    const inv = g.entries.find((e) => e.type === "INVOICE");
    if (inv) g.groupDate = inv.date;

    // Sort entries within the group: invoice → return → commission → payment
    g.entries.sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));
  }

  // Sort groups by their anchor date, then by order reference
  groups.sort((a, b) => {
    const diff = a.groupDate.localeCompare(b.groupDate);
    return diff !== 0 ? diff : a.orderRef.localeCompare(b.orderRef);
  });

  return groups;
}

export function LedgerTable({
  entries,
  openingBalance,
  closingBalance,
  from,
  to,
}: {
  entries:        CustomerLedgerEntry[];
  openingBalance: number;
  closingBalance: number;
  from:           string;
  to:             string;
}) {
  const groups = buildGroups(entries);

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm border-collapse">

        {/* ── Opening Balance ── */}
        <thead>
          <tr className="bg-amber-50/60 dark:bg-amber-950/10 border-b">
            <th className="px-4 py-3 text-left w-32 font-semibold text-amber-800">Opening Balance</th>
            <th className="px-4 py-3 text-left text-amber-700 text-xs font-normal" colSpan={3}>
              as of {format(new Date(from), "dd MMM yyyy")} · {toNepaliDateString(new Date(from))}
            </th>
            <th className={`px-4 py-3 text-right font-bold tabular-nums w-36 ${openingBalance > 0.005 ? "text-blue-600" : "text-emerald-600"}`}>
              Rs {fmt(openingBalance)}
            </th>
          </tr>
          <tr className="bg-muted/30 border-b text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <th className="px-4 py-1.5 text-left">Date</th>
            <th className="px-4 py-1.5 text-left">Type</th>
            <th className="px-4 py-1.5 text-left">Invoice / Ref No.</th>
            <th className="px-4 py-1.5 text-left">Description</th>
            <th className="px-4 py-1.5 text-right">Amount</th>
          </tr>
        </thead>

        <tbody>
          {groups.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground/60 italic">
                No transactions in this period
              </td>
            </tr>
          )}

          {groups.map((group, gi) => (
            <Fragment key={group.salesOrderId ?? `standalone-${gi}`}>
              {/* Order group header */}
              <tr className="bg-slate-50/80 dark:bg-slate-900/30 border-t-2 border-t-slate-200 dark:border-t-slate-700">
                <td colSpan={5} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {group.orderRef}
                  <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                    {format(new Date(group.groupDate), "dd MMM yyyy")} · {toNepaliDateString(new Date(group.groupDate))}
                  </span>
                </td>
              </tr>

              {/* Entries for this order */}
              {group.entries.map((e) => {
                const cfg = TYPE_CONFIG[e.type];
                const amount = e.type === "INVOICE" ? e.invoiceAmount : e.paymentAmount;

                return (
                  <tr key={e.id} className={`border-b ${cfg.colorRow}`}>
                    <td className="px-4 py-2.5 w-32">
                      <DateCell date={e.date} />
                    </td>
                    <td className="px-4 py-2.5 w-28">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        e.type === "INVOICE"    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" :
                        e.type === "RETURN"     ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40" :
                        e.type === "COMMISSION" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40" :
                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40"
                      }`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {e.salesOrderId ? (
                        <a
                          href={`/sales/${e.salesOrderId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-0.5 text-primary hover:underline"
                        >
                          {e.reference} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : e.reference}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {e.type === "PAYMENT"
                        ? <>
                            {METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod}
                            {e.description && ` · ${e.description}`}
                          </>
                        : e.description
                      }
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${cfg.amtClass}`}>
                      {cfg.sign} {fmt(amount)}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>

        {/* ── Closing Balance ── */}
        <tfoot>
          <tr className={`border-t-2 ${closingBalance > 0.005 ? "bg-blue-50/60 dark:bg-blue-950/10" : "bg-emerald-50/60 dark:bg-emerald-950/10"}`}>
            <td className="px-4 py-3 font-bold text-sm">Closing Balance</td>
            <td className="px-4 py-3 text-xs text-muted-foreground" colSpan={2}>
              as of {format(new Date(to), "dd MMM yyyy")} · {toNepaliDateString(new Date(to))}
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground text-right">
              {closingBalance > 0.005 ? "Salesman owes you" : closingBalance < -0.005 ? "You owe salesman" : "Settled"}
            </td>
            <td className={`px-4 py-3 text-right font-bold text-base tabular-nums ${closingBalance > 0.005 ? "text-blue-700" : "text-emerald-600"}`}>
              Rs {fmt(Math.abs(closingBalance))}
            </td>
          </tr>
        </tfoot>

      </table>
    </div>
  );
}
