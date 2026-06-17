"use client";

import { useEffect } from "react";

// Catches errors that escape the root layout — replaces the entire document.
// Clerk context is gone here, so no useUser / no role check.
// Must include <html> and <body>. Cannot use Tailwind (stylesheet is gone).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ERP] Global error (outside root layout)", {
      digest:    error.digest,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#111" }}>
        <div style={{
          display:        "flex",
          minHeight:      "100vh",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "2rem",
        }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div style={{
              display:         "inline-flex",
              alignItems:      "center",
              justifyContent:  "center",
              width:           56,
              height:          56,
              borderRadius:    "50%",
              background:      "#fee2e2",
              marginBottom:    "1.25rem",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
              Something went wrong
            </h2>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
              An unexpected error occurred. Please try again or contact your administrator.
            </p>

            {error.digest && (
              <div style={{
                background:   "#f3f4f6",
                border:       "1px solid #e5e7eb",
                borderRadius: "0.375rem",
                padding:      "0.625rem 0.75rem",
                marginBottom: "1.5rem",
                textAlign:    "left",
                fontSize:     "0.75rem",
                color:        "#6b7280",
              }}>
                <span style={{ fontWeight: 600, color: "#111" }}>Error ID: </span>
                <code style={{ fontFamily: "monospace", userSelect: "all" }}>{error.digest}</code>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  padding:      "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  border:       "1px solid #d1d5db",
                  background:   "#fff",
                  cursor:       "pointer",
                  fontSize:     "0.875rem",
                  fontFamily:   "inherit",
                  color:        "#111",
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  padding:         "0.5rem 1rem",
                  borderRadius:    "0.375rem",
                  border:          "1px solid transparent",
                  background:      "#111",
                  color:           "#fff",
                  cursor:          "pointer",
                  fontSize:        "0.875rem",
                  fontFamily:      "inherit",
                  textDecoration:  "none",
                  display:         "inline-flex",
                  alignItems:      "center",
                  gap:             "0.375rem",
                }}
              >
                Go to Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
