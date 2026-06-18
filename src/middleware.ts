import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ROLE_PROTECTED_ROUTES } from "@/lib/roles";
import type { AppRole } from "@/types/globals";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/auth-callback",
  "/request-access(.*)",
  "/unauthorized",
  "/pending",
  "/api/webhooks(.*)",
  "/api/health",
]);

export default clerkMiddleware(async (auth, req) => {
  // Webhook routes must bypass Clerk entirely — returning undefined still
  // triggers Clerk's session-handshake redirect (307), which webhook senders
  // don't follow. NextResponse.next() skips all Clerk processing.
  if (req.nextUrl.pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  // Always let public routes through
  if (isPublicRoute(req)) return;

  // Ensure the user is signed in
  await auth.protect();

  // Role enforcement via session claims — fast but can be stale by a few minutes
  // after a role is assigned. Per-page requirePermission() uses currentUser() for
  // the authoritative live check. Here we only block users whose claims already
  // show a role that isn't allowed (defence-in-depth, not the primary gate).
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.publicMetadata?.role as AppRole | undefined) ?? null;
  const { pathname } = req.nextUrl;

  if (role && role !== "superadmin") {
    const restricted = ROLE_PROTECTED_ROUTES.find((r) => r.pattern.test(pathname));
    if (restricted && !(restricted.allowed as AppRole[]).includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }
  // No role in claims → let the request through to the page.
  // requirePermission() / requireMinRole() in each page calls currentUser()
  // which always returns fresh data and will redirect to /pending if still no role.
});

export const config = {
  matcher: [
    // Exclude _next, api/webhooks, and static file extensions
    "/((?!_next|api/webhooks|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Exclude /api/webhooks from the api catch-all
    "/(api(?!/webhooks)|trpc)(.*)",
  ],
};
