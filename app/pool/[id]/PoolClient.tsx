"use client"

import Link from "next/link"
import { ArrowLeft, Check, Pencil, Plus, RefreshCw, Star, Trash2, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { api, type Pool } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function PoolClient({ id }: { id: string }) {
  const pathname = usePathname()
  const poolId = id || decodeURIComponent(pathname.match(/^\/pool\/([^/]+)/)?.[1] || "")
  const [pool, setPool] = useState<Pool | null>(null)
  const [error, setError] = useState("")
  const [chartId, setChartId] = useState("")
  const [favoriteId, setFavoriteId] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [replacementId, setReplacementId] = useState("")
  const [busy, setBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  async function load() {
    try { const result = await api.pools(); const found = result.pools.find((item) => item.id === Number(poolId)); if (!found) throw new Error("谱池不存在"); setPool(found); setFavoriteId(found.favoriteId === null ? "" : String(found.favoriteId)) } catch (reason) { setError(reason instanceof Error ? reason.message : "无法加载谱池") }
  }
  useEffect(() => { void load(); try { setIsAdmin(Boolean((JSON.parse(window.localStorage.getItem("zenith-session") || "null") as { isAdmin?: boolean } | null)?.isAdmin)) } catch { setIsAdmin(false) } }, [poolId])
  async function action(work: () => Promise<unknown>) { setBusy(true); setError(""); try { await work(); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败") } finally { setBusy(false) } }
  function replaceChart(oldId: number) { const newId = Number(replacementId); if (!Number.isInteger(newId) || newId < 0 || newId === oldId) return; void action(async () => { await api.addChart(pool?.id ?? Number(poolId), newId); await api.removeChart(pool?.id ?? Number(poolId), oldId) }).then(() => { setEditingId(null); setReplacementId("") }) }
  if (error && !pool) return <DetailState message={error} />
  if (!pool) return <DetailState message="正在加载谱池..." loading />

  return <main className="min-h-screen bg-muted/40 p-5 lg:p-8"><div className="mx-auto max-w-5xl"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回控制台</Link><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">谱池详情</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Pool {pool.id}</h1></div><div className="flex gap-2">{pool.default && <Badge>默认谱池</Badge>}{pool.favoriteId !== null && <Badge variant="outline">收藏 {pool.favoriteId}</Badge>}</div></div>{error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}<Card><CardHeader><CardTitle>谱面列表</CardTitle><CardDescription>该谱池包含 {pool.chartIds.length} 张谱面，不能移除最后一张谱面。</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{pool.chartIds.map((id) => <div key={id} className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Chart ID</p>{editingId === id ? <div className="mt-2 flex gap-1"><Input autoFocus type="number" value={replacementId} onChange={(event) => setReplacementId(event.target.value)} placeholder={String(id)} /><Button size="sm" title="保存" onClick={() => replaceChart(id)} disabled={busy}><Check /></Button><Button variant="ghost" size="sm" title="取消" onClick={() => { setEditingId(null); setReplacementId("") }} disabled={busy}><X /></Button></div> : <div className="mt-1 flex items-center justify-between"><p className="font-mono font-medium">{id}</p>{isAdmin && <div className="flex gap-1"><Button variant="ghost" size="sm" title="修改谱面 ID" onClick={() => { setEditingId(id); setReplacementId(String(id)) }} disabled={busy}><Pencil /></Button><Button variant="ghost" size="sm" title="移除谱面" onClick={() => void action(() => api.removeChart(pool.id, id))} disabled={busy || pool.chartIds.length <= 1}><Trash2 /></Button></div>}</div>}</div>)}</div></CardContent></Card>{isAdmin && <div className="mt-6 grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>添加谱面</CardTitle><CardDescription>根据 API 提供的 chartId 添加谱面。</CardDescription></CardHeader><CardContent><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const id = Number(chartId); if (Number.isInteger(id)) void action(() => api.addChart(pool.id, id)).then(() => setChartId("")) }}><Input required type="number" value={chartId} onChange={(event) => setChartId(event.target.value)} placeholder="谱面 ID" /><Button type="submit" disabled={busy}><Plus />添加</Button></form></CardContent></Card><Card><CardHeader><CardTitle>谱池设置</CardTitle></CardHeader><CardContent className="space-y-4"><Button variant={pool.default ? "secondary" : "default"} className="w-full" onClick={() => void action(() => api.setPoolDefault(pool.id, !pool.default))} disabled={busy}>{pool.default ? "取消默认谱池" : "设为默认谱池"}</Button><div className="flex gap-2"><Input type="number" value={favoriteId} onChange={(event) => setFavoriteId(event.target.value)} placeholder="收藏夹 ID" /><Button variant="outline" onClick={() => void action(() => api.setPoolFavorite(pool.id, favoriteId ? Number(favoriteId) : null))} disabled={busy}><Star />保存收藏</Button></div><p className="text-xs text-muted-foreground">留空并保存可清除 favoriteId。</p></CardContent></Card></div>}</div></main>
}

function DetailState({ message, loading = false }: { message: string; loading?: boolean }) { return <main className="flex min-h-screen items-center justify-center p-5"><div className="text-center"><p className="text-sm text-muted-foreground">{message}</p>{loading ? <RefreshCw className="mx-auto mt-3 size-5 animate-spin text-primary" /> : <Button asChild className="mt-4"><a href="/">返回控制台</a></Button>}</div></main> }
