"use client";

import { useState } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type ProductOption = {
  id:    string;
  name:  string;
  meta?: string; // second line shown in dropdown (e.g. unit, SKU, price)
};

type Props = {
  value:             string;
  options:           ProductOption[];
  onSelect:          (id: string) => void;
  placeholder?:      string;
  searchPlaceholder?: string;
  emptyText?:        string;
  error?:            boolean;
  className?:        string;
  triggerHeight?:    string;
};

export function ProductComboboxField({
  value,
  options,
  onSelect,
  placeholder      = "Select product…",
  searchPlaceholder = "Search by name…",
  emptyText        = "No product found.",
  error,
  className,
  triggerHeight    = "h-9",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <div
            role="combobox"
            aria-expanded={open}
            aria-controls="product-options-list"
            className={cn(
              `flex ${triggerHeight} w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm hover:bg-accent`,
              !value && "text-muted-foreground",
              error && "border-destructive",
              className
            )}
          >
            <span className="truncate">{selected?.name ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </div>
        }
      />
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList id="product-options-list">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.name}
                  onSelect={() => { onSelect(o.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", value === o.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{o.name}</p>
                    {o.meta && <p className="text-xs text-muted-foreground">{o.meta}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
