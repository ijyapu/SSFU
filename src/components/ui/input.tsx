"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const TEXT_TYPES = new Set(["text", "search", "tel", undefined])

function Input({ className, type, onChange, onWheel, ...props }: React.ComponentProps<"input">) {
  const shouldCapitalize = TEXT_TYPES.has(type as string | undefined)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (shouldCapitalize && e.target.value.length > 0) {
      e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)
    }
    onChange?.(e)
  }

  function handleWheel(e: React.WheelEvent<HTMLInputElement>) {
    if (type === "number") e.currentTarget.blur()
    onWheel?.(e)
  }

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      autoCapitalize={shouldCapitalize ? "sentences" : undefined}
      onWheel={handleWheel}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      onChange={handleChange}
      {...props}
    />
  )
}

export { Input }
