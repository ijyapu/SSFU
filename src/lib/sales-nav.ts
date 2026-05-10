/** Builds /sales with optional date-filter query string preserved. */
export function salesListHref(from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString();
  return qs ? `/sales?${qs}` : "/sales";
}

/** Builds /sales/[id] with optional date-filter query string preserved. */
export function salesOrderHref(id: string, from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString();
  return qs ? `/sales/${id}?${qs}` : `/sales/${id}`;
}

/** Builds /sales/[id]/edit with optional date-filter query string preserved. */
export function salesEditHref(id: string, from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString();
  return qs ? `/sales/${id}/edit?${qs}` : `/sales/${id}/edit`;
}
