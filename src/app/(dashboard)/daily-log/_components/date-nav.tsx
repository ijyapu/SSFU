"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

type Props = {
  validDate: string;
  prevDay:   string;
  nextDay:   string;
  dateLabel: string;
  isToday:   boolean;
  todayStr:  string;
};

export function DateNav({ validDate, prevDay, nextDay, dateLabel, isToday, todayStr }: Props) {
  const router         = useRouter();
  const dateInputRef   = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function navigate(date: string) {
    startTransition(() => router.push(`/daily-log?date=${date}`));
  }

  return (
    <div className={cn("flex items-center gap-1 ml-9 transition-opacity", isPending && "opacity-50")}>
      {/* Previous day */}
      <button
        onClick={() => navigate(prevDay)}
        disabled={isPending}
        title="Previous day"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Date label + calendar picker */}
      <div className="flex items-center gap-1 px-0.5">
        <span className="text-muted-foreground text-sm">
          {dateLabel}{isToday ? " (today)" : ""}
        </span>

        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          /* Calendar icon overlaid by a transparent native date input so clicking the
             icon opens the browser's date picker on all platforms */
          <div className="relative inline-flex">
            <button
              type="button"
              title="Jump to a date"
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={validDate}
              max={todayStr}
              onChange={(e) => { if (e.target.value) navigate(e.target.value); }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Jump to date"
            />
          </div>
        )}
      </div>

      {/* Next day */}
      <button
        onClick={() => !isToday && navigate(nextDay)}
        disabled={isToday || isPending}
        title="Next day"
        aria-disabled={isToday}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          isToday && "pointer-events-none opacity-30"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
