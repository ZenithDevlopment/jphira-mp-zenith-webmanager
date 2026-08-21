"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Check, ExternalLink, Loader2, Pencil, Plus, RefreshCw, Search, Star, Trash2, TriangleAlert, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { api, phiraApi, type PhiraChart, type PhiraCollection, type Pool } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"

type ChartDetail = { data: PhiraChart; error?: boolean }
type CollectionDetail = { loaded: boolean; notFound: boolean; data: PhiraCollection | null }
type SearchState = { query: string; page: number; loading: boolean; results: PhiraChart[] | null; count: number; error: boolean }

function fmtRating(rating: number) { return `${Math.round(rating * 100)}%` }
function levelBadgeVariant(level: string): "default" | "secondary" | "outline" {
  const m = level.match(/(AT|IN|HD|EZ|SP)?\s*Lv\.?(\d+)/i)
  const diff = m ? Number(m[2]) : 0
  if (diff >= 16) return "default"
  if (diff >= 14) return "secondary"
  return "outline"
}

export default function PoolClient({ id }: { id: string }) {
  const pathname = usePathname()
  const poolId = id || decodeURIComponent(pathname.match(/^\/pool\/([^/]+)/)?.[1] || "")
  const [pool, setPool] = useState<Pool | null>(null)
  const [error, setError] = useState("")
  const [favoriteId, setFavoriteId] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [replacementId, setReplacementId] = useState("")
  const [busy, setBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [charts, setCharts] = useState<Record<number, ChartDetail>>({})
  const [collection, setCollection] = useState<CollectionDetail>({ loaded: false, notFound: false, data: null })
  const [addOpen, setAddOpen] = useState(false)
  const [addId, setAddId] = useState("")
  const [idPreview, setIdPreview] = useState<{ loading: boolean; data: PhiraChart | null; notFound: boolean }>({ loading: false, data: null, notFound: false })
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [search, setSearch] = useState<SearchState>({ query: "", page: 1, loading: false, results: null, count: 0, error: false })

  async function load() {
    try { const result = await api.pools(); const found = result.pools.find((item) => item.id === Number(poolId)); if (!found) throw new Error("谱池不存在"); setPool(found); setFavoriteId(found.favoriteId === null ? "" : String(found.favoriteId)) } catch (reason) { setError(reason instanceof Error ? reason.message : "无法加载谱池") }
  }
  async function loadCharts(ids: number[]) {
    setCharts((prev) => {
      const next = { ...prev }
      for (const id of ids) {
        if (next[id]) continue
        next[id] = { data: { id } as PhiraChart }
      }
      return next
    })
    for (const id of ids) {
      if (charts[id]?.data?.name) continue
      const data = await phiraApi.chart(id)
      setCharts((prev) => ({ ...prev, [id]: data ? { data } : { data: { id } as PhiraChart, error: true } }))
    }
  }
  async function loadCollection() {
    const favId = Number(pool?.favoriteId)
    if (!Number.isInteger(favId) || favId === 0) { setCollection({ loaded: true, notFound: false, data: null }); return }
    setCollection((prev) => ({ ...prev, loaded: false, notFound: false }))
    const data = await phiraApi.collection(favId)
    setCollection({ loaded: true, notFound: !data, data })
  }
  useEffect(() => { void load(); try { setIsAdmin(Boolean((JSON.parse(window.localStorage.getItem("zenith-session") || "null") as { isAdmin?: boolean } | null)?.isAdmin)) } catch { setIsAdmin(false) } }, [poolId])
  const chartIdsKey = pool?.chartIds.join(",")
  useEffect(() => { if (pool) { void loadCharts(pool.chartIds); void loadCollection() } }, [pool?.id, chartIdsKey, pool?.favoriteId])

  async function action(work: () => Promise<unknown>) { setBusy(true); setError(""); try { await work(); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败") } finally { setBusy(false) } }
  function replaceChart(oldId: number) { const newId = Number(replacementId); if (!Number.isInteger(newId) || newId < 0 || newId === oldId) return; void action(async () => { await api.addChart(pool?.id ?? Number(poolId), newId); await api.removeChart(pool?.id ?? Number(poolId), oldId) }).then(() => { setEditingId(null); setReplacementId("") }) }
  function addById() {
    const id = Number(addId)
    if (!Number.isInteger(id) || id < 0) return
    void action(() => api.addChart(pool!.id, id)).then(() => { setAddId(""); setIdPreview({ loading: false, data: null, notFound: false }); setAddOpen(false) })
  }
  async function previewId() {
    const id = Number(addId)
    if (!Number.isInteger(id) || id < 0) return
    setIdPreview({ loading: true, data: null, notFound: false })
    const data = await phiraApi.chart(id)
    setIdPreview({ loading: false, data, notFound: !data })
  }
  async function doSearch(page = 1) {
    const query = search.query.trim()
    if (!query) return
    setSearch((prev) => ({ ...prev, page, loading: true, error: false }))
    const data = await phiraApi.search(query, page)
    setSearch((prev) => ({ ...prev, loading: false, results: data?.results ?? null, count: data?.count ?? 0, error: !data }))
  }
  function addFromSearch(chart: PhiraChart) {
    void action(() => api.addChart(pool!.id, chart.id)).then(() => setAddOpen(false))
  }
  function openDialog() { setAddOpen(true); setAddId(""); setIdPreview({ loading: false, data: null, notFound: false }); setSearch({ query: "", page: 1, loading: false, results: null, count: 0, error: false }) }
  async function confirmDeleteChart(idToDelete: number) {
    if (pool && pool.chartIds.length <= 1) return
    setDeletingId(idToDelete)
    setError("")
    try {
      await api.removeChart(pool!.id, idToDelete)
      await load()
      setDeleteConfirm(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "移除失败")
    } finally {
      setDeletingId(null)
    }
  }
  if (error && !pool) return <DetailState message={error} />
  if (!pool) return <DetailState message="正在加载谱池..." loading />
  const collectionInfo = collection.data && !collection.notFound

  return (
    <TooltipProvider delayDuration={300}>
      <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回控制台</Link>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">谱池详情</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pool {pool.id}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <Button onClick={openDialog} disabled={busy}><Plus className="size-4" />添加谱面</Button>}
            {pool.default && <Badge>默认谱池</Badge>}
            {pool.favoriteId !== null && <Badge variant="outline">收藏 {pool.favoriteId}</Badge>}
          </div>
        </div>

        {error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>谱面列表</CardTitle>
            <CardDescription>该谱池包含 {pool.chartIds.length} 张谱面，不能移除最后一张谱面。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pool.chartIds.map((id) => {
                const detail = charts[id]
                const chart = detail?.data
                const error = detail?.error
                return (
                  <div key={id} className="group relative overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40">
                    {chart?.illustration ? (
                      <div className="relative aspect-video w-full overflow-hidden">
                        <Image src={chart.illustration} alt={chart.name || String(id)} fill unoptimized className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute inset-x-2 bottom-2">
                          <p className="line-clamp-1 text-sm font-medium text-white text-shadow">{chart.name || `#${id}`}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex aspect-video w-full items-center justify-center bg-muted/40">
                        {error ? (
                          <p className="text-xs text-muted-foreground">无法获取谱面</p>
                        ) : (
                          <Skeleton className="h-16 w-3/5" />
                        )}
                        {chart?.name && (
                          <p className="absolute bottom-2 left-2 right-2 line-clamp-1 text-xs font-medium text-muted-foreground">{chart.name}</p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-medium">#{id}</p>
                              <p className="line-clamp-1 text-xs text-muted-foreground">{chart?.composer || "未知曲师"}</p>
                            </div>
                            {typeof chart?.difficulty === "number" && (
                              <div className="flex shrink-0 items-center gap-1.5">
                                <Badge variant={levelBadgeVariant(chart.level || "")}>{chart.level || `${chart.difficulty.toFixed(1)}`}</Badge>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="line-clamp-1 text-xs text-muted-foreground underline-offset-4 group-hover:underline">
                              {chart?.charter ? `谱师 ${chart.charter}` : " · "}
                            </p>
                            {isAdmin && (
                              <div className="flex shrink-0 gap-1">
                                <Popover open={editingId === id} onOpenChange={(open) => { if (open) setEditingId(id); else { setEditingId(null); setReplacementId("") } }}>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" disabled={busy}><Pencil className="size-4" /></Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 bg-background p-4 text-foreground shadow-md border">
                                    <div className="flex items-start gap-2.5">
                                      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Pencil className="size-4" /></div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium">修改谱面 ID</p>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">将这张谱面替换为新的谱面 ID。</p>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex gap-1">
                                      <Input autoFocus type="number" value={replacementId} onChange={(event) => setReplacementId(event.target.value)} placeholder={String(id)} />
                                      <Button size="sm" title="保存" onClick={() => replaceChart(id)} disabled={busy}><Check className="size-4" /></Button>
                                      <Button variant="ghost" size="sm" title="取消" onClick={() => { setEditingId(null); setReplacementId("") }} disabled={busy}><X className="size-4" /></Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <Popover open={deleteConfirm === id} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(id)} disabled={busy || pool.chartIds.length <= 1} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 bg-background p-4 text-foreground shadow-md border">
                                    <div className="flex items-start gap-2.5">
                                      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"><TriangleAlert className="size-4" /></div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium">删除谱面 #{id}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">确认从谱池移除这张谱面？此操作无法撤销。</p>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex justify-end gap-2">
                                      <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setDeleteConfirm(null)} disabled={deletingId !== null}>取消</Button>
                                      <Button size="sm" variant="destructive" className="h-8 px-3 text-xs" onClick={() => void confirmDeleteChart(id)} disabled={deletingId !== null}>
                                        {deletingId === id && <Loader2 className="size-3.5 animate-spin" />}
                                        确认
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                          </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>谱池设置</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button variant={pool.default ? "secondary" : "default"} className="w-full" onClick={() => void action(() => api.setPoolDefault(pool.id, !pool.default))} disabled={busy}>{pool.default ? "取消默认谱池" : "设为默认谱池"}</Button>
              <div className="flex gap-2">
                <Input type="number" value={favoriteId} onChange={(event) => setFavoriteId(event.target.value)} placeholder="收藏夹 ID" />
                <Button variant="outline" onClick={() => void action(() => api.setPoolFavorite(pool.id, favoriteId ? Number(favoriteId) : null))} disabled={busy}><Star className="size-4" />保存收藏</Button>
              </div>
              <p className="text-xs text-muted-foreground">留空并保存可清除 favoriteId。</p>
            </CardContent>
          </Card>
        )}

        {collectionInfo && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>关联收藏夹</CardTitle>
              <CardDescription>该谱池绑定的 Phira 收藏夹，实时反映收藏内容。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                {collection.data!.cover ? (
                  <Image src={collection.data!.cover} alt={collection.data!.name} width={160} height={90} unoptimized className="rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-[90px] w-[160px] items-center justify-center rounded-lg border bg-muted/40">
                    <Star className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight">{collection.data!.name}</h3>
                    <Badge variant="outline">{collection.data!.charts.length} 张谱面</Badge>
                    {collection.data!.public && <Badge variant="secondary">公开</Badge>}
                  </div>
                  {collection.data!.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{collection.data!.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Created {new Date(collection.data!.created).toLocaleDateString()} · {collection.data!.likes} 点赞</p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`https://phira.5wyxi.com/collection/${collection.data!.id}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />在 Phira 打开</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {collection.loaded && collection.notFound && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <X className="size-4" />未找到收藏夹谱池绑定的收藏夹（ID {pool.favoriteId}），请检查 favoriteId。
          </div>
        )}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加谱面</DialogTitle>
              <DialogDescription>输入谱面 ID 先查谱确认，或直接搜索谱面后点击添加。</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* ID 直接添加：先查谱确认 */}
              <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void previewId() }}>
                <Input type="number" value={addId} onChange={(event) => { setAddId(event.target.value); setIdPreview({ loading: false, data: null, notFound: false }) }} placeholder="输入谱面 ID，例如 74673" autoFocus />
                <Button type="submit" variant="outline" disabled={busy || !addId || idPreview.loading}><Search className="size-4" />查谱</Button>
              </form>

              {idPreview.loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在获取谱面...</div>
              )}
              {idPreview.notFound && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">未找到该谱面，请检查 ID。</p>
              )}
              {idPreview.data && (
                <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
                  {idPreview.data.illustration ? (
                    <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md">
                      <Image src={idPreview.data.illustration} alt={idPreview.data.name} fill unoptimized className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-[72px] w-32 shrink-0 items-center justify-center rounded-md bg-muted/40"><Star className="size-5 text-muted-foreground" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="line-clamp-1 font-medium">{idPreview.data.name}</p>
                      <Badge variant={levelBadgeVariant(idPreview.data.level || "")}>{idPreview.data.level || `${idPreview.data.difficulty.toFixed(1)}`}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{idPreview.data.composer} · 谱师 {idPreview.data.charter}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">#{idPreview.data.id} · {fmtRating(idPreview.data.rating)} · {idPreview.data.ratingCount} 人</p>
                  </div>
                  <Button onClick={addById} disabled={busy}><Plus className="size-4" />确认添加</Button>
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />或搜索谱面<div className="h-px flex-1 bg-border" />
              </div>

              {/* 关键词搜索 */}
              <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void doSearch(1) }}>
                <Input value={search.query} onChange={(event) => setSearch((prev) => ({ ...prev, query: event.target.value }))} placeholder="搜索谱面名称 / 曲师 / 谱师" />
                <Button type="submit" variant="outline" disabled={busy || !search.query.trim() || search.loading}><Search className="size-4" />搜索</Button>
              </form>

              {search.loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在搜索...</div>
              )}
              {search.error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">搜索失败，请稍后重试。</p>
              )}
              {search.results && (
                <>
                  <p className="text-xs text-muted-foreground">共 {search.count} 条结果，点击谱面添加。</p>
                  <ScrollArea className="max-h-[300px]">
                    <div className="flex flex-col gap-2 pr-3">
                      {search.results.map((chart) => (
                        <button key={chart.id} type="button" onClick={() => addFromSearch(chart)} disabled={busy} className="flex items-center gap-3 rounded-md border p-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40">
                          {chart.illustration ? (
                            <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded">
                              <Image src={chart.illustration} alt={chart.name} fill unoptimized className="object-cover" />
                            </div>
                          ) : (
                            <div className="flex h-11 w-20 shrink-0 items-center justify-center rounded bg-muted/40"><Star className="size-4 text-muted-foreground" /></div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="line-clamp-1 text-sm font-medium">{chart.name}</p>
                              <Badge variant={levelBadgeVariant(chart.level || "")}>{chart.level || `${chart.difficulty.toFixed(1)}`}</Badge>
                            </div>
                            <p className="line-clamp-1 text-xs text-muted-foreground">{chart.composer} · 谱师 {chart.charter}</p>
                            <p className="text-xs text-muted-foreground">#{chart.id} · {fmtRating(chart.rating)}</p>
                          </div>
                          <Plus className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  {search.count > search.results.length && (
                    <div className="flex justify-center">
                      <Button variant="ghost" size="sm" onClick={() => void doSearch(search.page + 1)} disabled={busy || search.loading}>加载更多</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </main>
    </TooltipProvider>
  )
}

function DetailState({ message, loading = false }: { message: string; loading?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {loading ? <RefreshCw className="mx-auto mt-3 size-4 animate-spin text-muted-foreground" /> : <Button asChild className="mt-4"><Link href="/">返回控制台</Link></Button>}
      </div>
    </main>
  )
}
