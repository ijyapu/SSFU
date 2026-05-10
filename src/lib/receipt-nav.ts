export function receiptsListHref(from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString();
  return qs ? `/receipts?${qs}` : "/receipts";
}

export function receiptsLedgerHref(from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString();
  return qs ? `/receipts/ledger?${qs}` : "/receipts/ledger";
}
