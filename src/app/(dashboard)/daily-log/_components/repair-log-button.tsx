"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { repairDailyLog } from "../actions";

type Props = { logId: string; dateLabel: string };

export function RepairLogButton({ logId, dateLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRepair() {
    startTransition(async () => {
      try {
        const result = await repairDailyLog(logId);
        toast.success(
          result.repairedCount > 0
            ? `Repaired ${result.repairedCount} product${result.repairedCount !== 1 ? "s" : ""} — closing quantities recalculated.`
            : "Log is already consistent — no changes needed.",
        );
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to repair log");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wrench className="h-3.5 w-3.5" />
        Repair
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repair Daily Log — {dateLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will recalculate this daily log from live source records.
              Manual production/waste fields will stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
            <li>Sold and fresh-return quantities re-synced from live sales orders</li>
            <li>Closing quantities recalculated using the updated figures</li>
            <li><strong>Produced, used, waste, and damaged values are preserved</strong></li>
            <li>No stock movements are created or modified</li>
            <li>Log is marked Auto-adjusted</li>
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRepair} disabled={isPending}>
              {isPending ? "Repairing..." : "Yes, Repair Log"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
