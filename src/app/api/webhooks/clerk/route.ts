import { headers } from "next/headers";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";
import { sendRequestReceivedEmail, sendAdminNewRequestAlert } from "@/lib/email";

// Diagnostic: lets you confirm the route is reachable without a redirect
export function GET() {
  return new Response(JSON.stringify({ ok: true, route: "clerk-webhook" }), {
    headers: { "content-type": "application/json" },
  });
}

type ClerkUserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    first_name: string | null;
    last_name:  string | null;
    email_addresses:          { email_address: string; id: string }[];
    primary_email_address_id: string | null;
  };
};

export async function POST(req: Request) {
  try {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET is not set in environment");
      return new Response("CLERK_WEBHOOK_SECRET not set", { status: 500 });
    }

    const headersList  = await headers();
    const svixId        = headersList.get("svix-id");
    const svixTimestamp = headersList.get("svix-timestamp");
    const svixSignature = headersList.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("[clerk-webhook] Missing svix headers", { svixId, svixTimestamp, svixSignature: !!svixSignature });
      return new Response("Missing svix headers", { status: 400 });
    }

    const body = await req.text();
    const wh   = new Webhook(secret);

    let event: ClerkUserCreatedEvent;
    try {
      event = wh.verify(body, {
        "svix-id":        svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ClerkUserCreatedEvent;
    } catch (err) {
      console.error("[clerk-webhook] Signature verification failed:", String(err));
      return new Response("Invalid webhook signature", { status: 400 });
    }

    if (event.type !== "user.created") return new Response("OK", { status: 200 });

    const { first_name, email_addresses, primary_email_address_id } = event.data;
    const primaryEmail = email_addresses.find(
      (e) => e.id === primary_email_address_id
    )?.email_address ?? email_addresses[0]?.email_address;

    if (!primaryEmail) return new Response("No email found", { status: 200 });

    const fullName  = [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || "Unknown";
    const firstName = event.data.first_name ?? "there";

    // Create a pending access request so admins see an in-app notification
    // and can action it from /settings/access-requests. Skip if one already exists.
    const existing = await prisma.accessRequest.findFirst({
      where: { workEmail: primaryEmail, status: "PENDING" },
    });
    if (!existing) {
      await prisma.accessRequest.create({
        data: {
          fullName,
          workEmail:  primaryEmail,
          department: "",
          jobTitle:   "",
        },
      });
    }

    await Promise.allSettled([
      sendRequestReceivedEmail(primaryEmail, firstName),
      sendAdminNewRequestAlert({ fullName, workEmail: primaryEmail }),
    ]);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[clerk-webhook] Unexpected error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
