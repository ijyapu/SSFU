"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { ErrorDisplay } from "@/components/ui/error-display";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { user } = useUser();
  const pathname = usePathname();

  useEffect(() => {
    console.error("[ERP] Dashboard page error", {
      digest:    error.digest,
      route:     pathname,
      userId:    user?.id,
      timestamp: new Date().toISOString(),
    });
  }, [error, pathname, user?.id]);

  return <ErrorDisplay error={error} reset={reset} />;
}
