import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Frame-Options",        value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
  ...(!isDev
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js App Router requires unsafe-inline for its streaming runtime scripts
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.clerk.com https://*.clerk.accounts.dev https://ssfi.work https://*.ssfi.work https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://img.clerk.com https://ssfi.work https://*.ssfi.work",
      "font-src 'self' data:",
      "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://ssfi.work https://*.ssfi.work https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://challenges.cloudflare.com",
      "frame-src https://*.clerk.accounts.dev https://*.clerk.com https://ssfi.work https://*.ssfi.work https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(!isDev ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "ssfi.work" },
      { protocol: "https", hostname: "**.ssfi.work" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const sentryEnvReady =
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !!process.env.SENTRY_AUTH_TOKEN;

// Skip withSentryConfig entirely when env vars aren't set — sourcemaps.disable
// only suppresses upload; sentry-cli still tries to create releases and fails
// with 401 if SENTRY_AUTH_TOKEN is missing.
export default sentryEnvReady
  ? withSentryConfig(nextConfig, {
      org:     process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent:  !process.env.CI,
      disableLogger:            true,
      automaticVercelMonitors:  false,
      sourcemaps: {
        filesToDeleteAfterUpload: [".next/static/**/*.map"],
      },
    })
  : nextConfig;
