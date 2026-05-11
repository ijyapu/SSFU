"use client";

import { useState, useMemo, Fragment } from "react";
import { DateDisplay } from "@/components/ui/date-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";

export interface AuditEntry {
  id: string;
  userId: string;
  userLabel: string; // email or userId
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

interface Props {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  productMap?: Record<string, string>;
  userMap?: Record<string, string>;
}

const ACTION_COLORS: Record<string, string> = {
  SALES_ORDER_CONFIRM:    "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  SALES_ORDER_EDIT:       "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  SALES_ORDER_CANCEL:     "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  SALES_ORDER_DELETE:     "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  SALES_RETURN_CREATE:    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  SALES_RETURN_EDIT:      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  DAILY_LOG_CLOSE:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  DAILY_LOG_REOPEN:       "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  DAILY_LOG_DISCARD:      "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  DAILY_LOG_AUTO_ADJUST:  "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  DAILY_LOG_REPAIR:       "bg-slate-100 text-slate-700 dark:bg-slate-950/50 dark:text-slate-300",
  STOCK_CORRECTION:       "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  PAYMENT_EDIT:           "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  PAYMENT_DELETE:         "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

function toLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

const USER_KEYS = new Set(["createdBy", "closedBy", "autoAdjustedBy", "repairedBy", "userId", "updatedBy"]);

function renderCell(
  key: string,
  value: unknown,
  productMap?: Record<string, string>,
  userMap?: Record<string, string>,
): React.ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Product ID
  if (key === "productId" && typeof value === "string") {
    const name = productMap?.[value];
    return name ? `${name} (${value.slice(0, 8)}…)` : `${value.slice(0, 8)}… (ID)`;
  }

  // Known user-reference fields → resolve to email
  if (USER_KEYS.has(key) && typeof value === "string") {
    const email = userMap?.[value];
    return email ?? `${value.slice(0, 8)}… (ID)`;
  }

  // Other long IDs
  if (key.toLowerCase().endsWith("id") && typeof value === "string" && value.length > 12) {
    return `${value.slice(0, 8)}… (ID)`;
  }

  // items array — list of { productId, quantity }
  if (key === "items" && Array.isArray(value)) {
    return (
      <ul className="space-y-0.5">
        {(value as unknown[]).map((item, i) => {
          if (!item || typeof item !== "object") return <li key={i}>{String(item)}</li>;
          const it = item as Record<string, unknown>;
          const pid  = typeof it.productId === "string" ? it.productId : null;
          const name = pid ? (productMap?.[pid] ?? `${pid.slice(0, 8)}…`) : null;
          const qty  = it.quantity ?? it.qty;
          return (
            <li key={i}>
              {qty !== undefined && <span className="font-medium">{String(qty)} ×</span>}{" "}
              {name ?? JSON.stringify(item)}
            </li>
          );
        })}
      </ul>
    );
  }

  // changedProducts array — list of { productId, oldClosingQty, newClosingQty }
  if (key === "changedProducts" && Array.isArray(value)) {
    return (
      <ul className="space-y-0.5">
        {(value as unknown[]).map((item, i) => {
          if (!item || typeof item !== "object") return <li key={i}>{String(item)}</li>;
          const it   = item as Record<string, unknown>;
          const pid  = typeof it.productId === "string" ? it.productId : null;
          const name = pid ? (productMap?.[pid] ?? `${pid.slice(0, 8)}…`) : "?";
          return (
            <li key={i}>
              <span className="font-medium">{name}</span>
              {": "}
              {String(it.oldClosingQty ?? "?")} → {String(it.newClosingQty ?? "?")}
            </li>
          );
        })}
      </ul>
    );
  }

  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function SnapshotTable({ data, label, highlight, productMap, userMap }: { data: Record<string, unknown>; label: string; highlight?: "red" | "green"; productMap?: Record<string, string>; userMap?: Record<string, string> }) {
  const entries = Object.entries(data);
  const headerCls = highlight === "red" ? "text-red-600" : highlight === "green" ? "text-green-600" : "text-muted-foreground";
  return (
    <div>
      <p className={`text-xs font-semibold mb-1.5 ${headerCls}`}>{label}</p>
      <table className="w-full text-xs border border-border rounded overflow-hidden">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-b border-border last:border-0">
              <td className="px-2 py-1 font-medium text-muted-foreground bg-muted/40 w-1/3 whitespace-nowrap">
                {toLabel(k)}
              </td>
              <td className="px-2 py-1 break-all">{renderCell(k, v, productMap, userMap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffViewer({ before, after, productMap, userMap }: { before: unknown; after: unknown; productMap?: Record<string, string>; userMap?: Record<string, string> }) {
  const hasAfter  = after  !== null && after  !== undefined && typeof after  === "object";
  const hasBefore = before !== null && before !== undefined && typeof before === "object";

  if (!hasBefore && !hasAfter) {
    return <p className="text-xs text-muted-foreground">No snapshot recorded.</p>;
  }

  // CREATE: only after exists
  if (!hasBefore && hasAfter) {
    return <SnapshotTable data={after as Record<string, unknown>} label="Created with" highlight="green" productMap={productMap} userMap={userMap} />;
  }

  // DELETE: only before exists
  if (hasBefore && !hasAfter) {
    return <SnapshotTable data={before as Record<string, unknown>} label="Deleted record" highlight="red" productMap={productMap} userMap={userMap} />;
  }

  // UPDATE: show changed fields side by side
  const b = before as Record<string, unknown>;
  const a = after  as Record<string, unknown>;
  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  const changedKeys = allKeys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  const displayKeys = changedKeys.length > 0 ? changedKeys : allKeys;

  return (
    <div className="space-y-2">
      {changedKeys.length > 0 && (
        <p className="text-xs text-muted-foreground">{changedKeys.length} field{changedKeys.length !== 1 ? "s" : ""} changed</p>
      )}
      <table className="w-full text-xs border border-border rounded overflow-hidden">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            <th className="px-2 py-1 text-left font-medium text-muted-foreground w-1/4">Field</th>
            <th className="px-2 py-1 text-left font-medium text-red-600 w-[37.5%]">Before</th>
            <th className="px-2 py-1 text-left font-medium text-green-600 w-[37.5%]">After</th>
          </tr>
        </thead>
        <tbody>
          {displayKeys.map((k) => (
            <tr key={k} className="border-b border-border last:border-0">
              <td className="px-2 py-1 font-medium text-muted-foreground bg-muted/20 whitespace-nowrap">{toLabel(k)}</td>
              <td className="px-2 py-1 break-all text-red-700">{renderCell(k, b[k], productMap, userMap)}</td>
              <td className="px-2 py-1 break-all text-green-700">{renderCell(k, a[k], productMap, userMap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditLogTable({ entries, total, page, pageSize, productMap, userMap }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { sortKey, sortDir, toggle: sortToggle } = useSortable("createdAt");

  const sorted = useMemo(() => {
    if (!sortKey) return entries;
    return [...entries].sort((a, b) => {
      const aVals: Record<string, string> = { createdAt: a.createdAt, userLabel: a.userLabel, action: a.action, entityType: a.entityType };
      const bVals: Record<string, string> = { createdAt: b.createdAt, userLabel: b.userLabel, action: b.action, entityType: b.entityType };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [entries, sortKey, sortDir]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Audit Log</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {total} total entries — page {page} of {Math.max(1, totalPages)}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              {(() => { const sp = { sortKey, sortDir, toggle: sortToggle }; return (
              <tr>
                <th className="w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"><SortButton col="createdAt"  label="When"   {...sp} /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"><SortButton col="userLabel"  label="User"   {...sp} /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"><SortButton col="action"     label="Action" {...sp} /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"><SortButton col="entityType" label="Entity" {...sp} /></th>
              </tr>
              ); })()}
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No audit log entries yet.
                  </td>
                </tr>
              )}
              {sorted.map((entry) => {
                const isExpanded = expanded.has(entry.id);
                const hasDiff    = !!(entry.before || entry.after);
                return (
                  <Fragment key={entry.id}>
                    <tr
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="pl-3 py-3">
                        {hasDiff && (
                          <button
                            onClick={() => toggle(entry.id)}
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />
                            }
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                        <DateDisplay date={entry.createdAt} fmt="d MMM yyyy, HH:mm" />
                      </td>
                      <td className="px-4 py-3 text-xs truncate max-w-45" title={entry.userId}>
                        {entry.userLabel}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={entry.action} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {entry.entityType}
                        {entry.entityId && (
                          <span className="ml-1 font-mono opacity-60">{entry.entityId.slice(0, 8)}…</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasDiff && (
                      <tr className="border-b border-border bg-muted/10">
                        <td />
                        <td colSpan={4} className="px-4 py-3">
                          <DiffViewer before={entry.before} after={entry.after} productMap={productMap} userMap={userMap} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/settings/audit-log?page=${page - 1}`}
                  className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
                >
                  Previous
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`/settings/audit-log?page=${page + 1}`}
                  className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
                >
                  Next
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
