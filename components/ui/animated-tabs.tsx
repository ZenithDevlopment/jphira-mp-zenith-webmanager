"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type AnimatedTabsProps = {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  className?: string
}

export function AnimatedTabs({ value, onValueChange, options, disabled, className }: AnimatedTabsProps) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = React.useState({ left: 0, width: 0 })

  const updateThumb = React.useCallback(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLButtonElement>(`[data-state="active"]`)
    if (!active) return
    const listRect = list.getBoundingClientRect()
    const rect = active.getBoundingClientRect()
    setThumb({ left: rect.left - listRect.left, width: rect.width })
  }, [])

  React.useLayoutEffect(() => {
    updateThumb()
  }, [updateThumb])

  React.useEffect(() => {
    updateThumb()
  }, [value, updateThumb])

  React.useEffect(() => {
    const handleResize = () => updateThumb()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [updateThumb])

  return (
    <div ref={listRef} role="tablist" className={cn("relative flex w-full h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground", className)}>
      <span
        aria-hidden
        className="absolute inset-y-1 z-0 rounded-md bg-background shadow"
        style={{ left: thumb.left, width: thumb.width, transition: "left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            data-state={active ? "active" : "inactive"}
            aria-selected={active}
            disabled={disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
