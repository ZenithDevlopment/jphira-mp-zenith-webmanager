"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

/** Light / dark / system switch. Renders a placeholder until the theme is resolved client side. */
export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="切换主题">
          {mounted && isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>浅色{theme === "light" ? " ✓" : ""}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>深色{theme === "dark" ? " ✓" : ""}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>跟随系统{theme === "system" ? " ✓" : ""}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
