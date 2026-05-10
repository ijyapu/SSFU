export function purchaseListHref(from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString();
  return qs ? `/purchases?${qs}` : "/purchases";
}

export function purchaseNewHref(from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString();
  return qs ? `/purchases/new?${qs}` : "/purchases/new";
}

export function purchaseEditHref(id: string, from?: string, to?: string): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to",   to);
  const qs = p.toString();
  return qs ? `/purchases/${id}/edit?${qs}` : `/purchases/${id}/edit`;
}
