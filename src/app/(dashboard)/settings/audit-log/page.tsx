import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { requirePermission } from "@/lib/auth";
import { AuditLogTable, type AuditEntry } from "./_components/audit-log-table";

export const metadata = { title: "Audit Log — Settings" };

const PAGE_SIZE = 30;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission("settings");
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, parseInt(rawPage ?? "1", 10));

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
    }),
  ]);

  // Resolve Clerk user emails for display
  const userIds = Array.from(new Set(logs.map((l) => l.userId)));
  const userMap = new Map<string, string>();

  if (userIds.length > 0) {
    try {
      const client = await clerkClient();
      const { data: users } = await client.users.getUserList({ userId: userIds, limit: 100 });
      for (const u of users) {
        const email = u.emailAddresses[0]?.emailAddress ?? u.id;
        userMap.set(u.id, email);
      }
    } catch {
      // Non-fatal — fall back to userId
    }
  }

  // Collect all productIds referenced in before/after snapshots (top-level and nested in arrays)
  const productIds = new Set<string>();
  for (const l of logs) {
    for (const snap of [l.before, l.after]) {
      if (!snap || typeof snap !== "object") continue;
      const s = snap as Record<string, unknown>;
      if (typeof s.productId === "string") productIds.add(s.productId);
      for (const arrayKey of ["items", "changedProducts"]) {
        if (Array.isArray(s[arrayKey])) {
          for (const item of s[arrayKey] as unknown[]) {
            if (item && typeof item === "object") {
              const pid = (item as Record<string, unknown>).productId;
              if (typeof pid === "string") productIds.add(pid);
            }
          }
        }
      }
    }
  }
  const productMap: Record<string, string> = {};
  if (productIds.size > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, name: true },
    });
    for (const p of products) productMap[p.id] = p.name;
  }

  const userRecord: Record<string, string> = Object.fromEntries(userMap);

  const entries: AuditEntry[] = logs.map((l) => ({
    id:         l.id,
    userId:     l.userId,
    userLabel:  userMap.get(l.userId) ?? l.userId,
    action:     l.action,
    entityType: l.entityType,
    entityId:   l.entityId,
    before:     l.before,
    after:      l.after,
    createdAt:  l.createdAt.toISOString(),
  }));

  return (
    <AuditLogTable
      entries={entries}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      productMap={productMap}
      userMap={userRecord}
    />
  );
}
