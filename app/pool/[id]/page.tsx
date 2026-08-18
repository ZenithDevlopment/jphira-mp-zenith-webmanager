"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { api, type Pool } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PoolPage() {
  const params = useParams<{ id: string }>()
  const [pool, setPool] = useState<Pool | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    void api.pools().then((result) => {
      const found = result.pools.find((item) => item.id === Number(params.id))
      if (!found) throw new Error("谱池不存在")
      setPool(found)
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "无法加载谱池"))
  }, [params.id])

  if (error) return <DetailState message={error} />
  if (!pool) return <DetailState message="正在加载谱池..." loading />

  return <main className="min-h-screen bg-muted/40 p-5 lg:p-8"><div className="mx-auto max-w-5xl"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回控制台</Link><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">谱池详情</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Pool {pool.id}</h1></div><div className="flex gap-2">{pool.default && <Badge>默认谱池</Badge>}{pool.favoriteId !== null && <Badge variant="outline">收藏 {pool.favoriteId}</Badge>}</div></div><Card><CardHeader><CardTitle>谱面列表</CardTitle><CardDescription>该谱池包含 {pool.chartIds.length} 张谱面</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{pool.chartIds.map((chartId) => <div key={chartId} className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Chart ID</p><p className="mt-1 font-mono font-medium">{chartId}</p></div>)}</div></CardContent></Card></div></main>
}

function DetailState({ message, loading = false }: { message: string; loading?: boolean }) { return <main className="flex min-h-screen items-center justify-center p-5"><div className="text-center"><p className="text-sm text-muted-foreground">{message}</p>{loading ? <RefreshCw className="mx-auto mt-3 size-5 animate-spin text-primary" /> : <Button asChild className="mt-4"><Link href="/">返回控制台</Link></Button>}</div></main> }
