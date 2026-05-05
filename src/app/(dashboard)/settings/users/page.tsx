import { clerkClient, auth } from "@clerk/nextjs/server";
import { requirePermission, getCurrentRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRoleTable, type UserRow } from "./_components/user-role-table";
import { AccessRequestsClient } from "../access-requests/_components/access-requests-client";
import type { AppRole } from "@/types/globals";

export const metadata = { title: "Users & Roles — Settings" };

export default async function UsersPage() {
  const [currentRole] = await Promise.all([
    getCurrentRole(),
    requirePermission("settings"),
  ]);
  const { userId: currentUserId } = await auth();

  const [client, allRequests, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    clerkClient(),
    prisma.accessRequest.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
    prisma.accessRequest.count({ where: { status: "APPROVED" } }),
    prisma.accessRequest.count({ where: { status: "REJECTED" } }),
  ]);

  const { data: clerkUsers } = await client.users.getUserList({
    limit:   200,
    orderBy: "-created_at",
  });

  const users: UserRow[] = clerkUsers.map((u) => ({
    id:            u.id,
    email:         u.emailAddresses[0]?.emailAddress ?? "(no email)",
    fullName:      u.fullName,
    imageUrl:      u.imageUrl,
    role:          (u.publicMetadata?.role as AppRole) ?? null,
    createdAt:     new Date(u.createdAt).toISOString(),
    isCurrentUser: u.id === currentUserId,
  }));

  return (
    <div className="space-y-10">
      <UserRoleTable users={users} currentRole={currentRole} />
      <AccessRequestsClient
        requests={allRequests.map((r) => ({
          id:         r.id,
          fullName:   r.fullName,
          workEmail:  r.workEmail,
          department: r.department,
          jobTitle:   r.jobTitle,
          phone:      r.phone,
          reason:     r.reason,
          status:     r.status,
          reviewNote: r.reviewNote,
          createdAt:  r.createdAt.toISOString(),
        }))}
        counts={{ PENDING: pendingCount, APPROVED: approvedCount, REJECTED: rejectedCount }}
      />
    </div>
  );
}
