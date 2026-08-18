import * as React from "react"
import { cn } from "@/lib/utils"
export function Badge({ className, variant = "secondary", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "outline" }) { return <div className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", variant === "default" ? "border-transparent bg-primary text-primary-foreground" : variant === "outline" ? "bg-background" : "border-transparent bg-secondary text-secondary-foreground", className)} {...props} /> }
