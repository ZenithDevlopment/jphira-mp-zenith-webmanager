import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = { title: "Zenith 控制台", description: "JPhira 多人房间与谱池管理后台" }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}<Toaster /></body></html> }
