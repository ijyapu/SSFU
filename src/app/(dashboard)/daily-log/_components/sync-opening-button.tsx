"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncOpeningQuantities } from "../actions";

export function SyncOpeningButton({ logId }: { logId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    try {
      const { updatedCount } = await syncOpeningQuantities(logId);
      if (updatedCount > 0) {
        toast.success(
          `${updatedCount} opening ${updatedCount === 1 ? "quantity" : "quantities"} updated from previous day's closing. Verify sold, used, and waste quantities before closing.`,
        );
      } else {
        toast.info("All opening quantities are already up to date.");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync opening quantities");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing…" : "Sync Opening Quantities"}
    </Button>
  );
}
