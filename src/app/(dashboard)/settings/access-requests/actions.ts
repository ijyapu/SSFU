"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sendApprovalEmail, sendRejectionEmail } from "@/lib/email";

const approveSchema = z.object({
  id:    z.string().cuid(),
  email: z.string().email(),
  role:  z.enum(["employee", "accountant", "manager", "admin"]),
  note:  z.string().optional(),
});

const rejectSchema = z.object({
  id:   z.string().cuid(),
  note: z.string().optional(),
});

export async function approveRequest(values: z.infer<typeof approveSchema>) {
  await requirePermission("settings");

  const { id, email, role, note } = approveSchema.parse(values);

  // Get the admin performing the approval for the audit log
  const adminUser = await currentUser();

  // 1. Find the Clerk user by email
  const client = await clerkClient();
  const result = await client.users.getUserList({ emailAddress: [email] });
  const clerkUser = result.data[0];

  if (clerkUser) {
    // 2. Assign role in Clerk public metadata
    await client.users.updateUser(clerkUser.id, {
      publicMetadata: { role },
    });
  }

  // 3. Fetch the AccessRequest for the name
  const request = await prisma.accessRequest.findUniqueOrThrow({ where: { id } });

  // 4. Update the AccessRequest record
  await prisma.accessRequest.update({
    where: { id },
    data: {
      status:     "APPROVED",
      reviewedBy: clerkUser ? clerkUser.id : "admin",
      reviewNote: note ?? null,
    },
  });

  // 5. Write audit log recording who approved whom and what role was granted
  await prisma.auditLog.create({
    data: {
      userId:     adminUser!.id,
      action:     "APPROVE_ACCESS_REQUEST",
      entityType: "User",
      entityId:   clerkUser ? clerkUser.id : id,
      before:     { role: null },
      after:      { role },
    },
  });

  // 6. Send approval email — non-blocking
  await sendApprovalEmail(email, request.fullName, role).catch((err) =>
    console.error("[approveRequest] email failed:", err)
  );

  revalidatePath("/settings/access-requests");
}

export async function rejectRequest(values: z.infer<typeof rejectSchema>) {
  await requirePermission("settings");

  const { id, note } = rejectSchema.parse(values);

  const request = await prisma.accessRequest.findUniqueOrThrow({ where: { id } });

  await prisma.accessRequest.update({
    where: { id },
    data: {
      status:     "REJECTED",
      reviewNote: note ?? null,
    },
  });

  // Send rejection email — non-blocking
  await sendRejectionEmail(request.workEmail, request.fullName, note).catch((err) =>
    console.error("[rejectRequest] email failed:", err)
  );

  revalidatePath("/settings/access-requests");
}
