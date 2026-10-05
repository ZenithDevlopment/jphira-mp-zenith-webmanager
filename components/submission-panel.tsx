"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, RefreshCw, Search, Send, Trash2, Users, X } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, SUBMISSION_STATUS_LABEL, type Pool, type Submission, type SubmissionStatus } from "@/lib/api"
import { cn } from "@/lib/utils"

const statusVariant = (status: SubmissionStatus) =>
  status === "APPROVED" ? "default" : status === "REJECTED" ? "outline" : "secondary"

function fmtTime(value: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("zh-CN", { hour12: false })
}

/**
 * 玩家的投稿入口 + 我的投稿；管理员额外看到跨池审核队列。
 *
 * 投稿按「池 + 谱面」聚合，因此审核一行就是一张谱面，点开能看到所有投过它的人。
 */
export function SubmissionPanel({ canWrite }: { canWrite: boolean }) {
  const [openPools, setOpenPools] = useState<Pool[]>([])
  const [mine, setMine] = useState<Submission[]>([])
  const [pending, setPending] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<number | null>(null)
  const [detail, setDetail] = useState<Submission | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [poolsResult, mineResult] = await Promise.all([api.openPools(), api.mySubmissions()])
      setOpenPools(poolsResult.pools)
      setMine(mineResult.submissions)
      // 非管理员调这个接口会 403，忽略即可
      if (canWrite) {
        const pendingResult = await api.pendingSubmissions()
        setPending(pendingResult.submissions)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载投稿失败")
    } finally {
      setLoading(false)
    }
  }, [canWrite])

  useEffect(() => { void load() }, [load])

  const withdraw = async (submission: Submission) => {
    setBusy(true)
    try {
      await api.withdrawSubmission(submission.poolId, submission.chartId)
      toast.success("已撤回投稿")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "撤回失败")
    } finally {
      setBusy(false)
    }
  }

  const review = async (submission: Submission, approve: boolean) => {
    setBusy(true)
    try {
      if (approve) {
        await api.approveSubmission(submission.poolId, submission.chartId)
        toast.success(`已通过并加入谱池：${submission.chart?.name ?? submission.chartId}`)
      } else {
        await api.rejectSubmission(submission.poolId, submission.chartId)
        toast.success("已拒绝")
      }
      setDetail(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">谱面投稿</h1>
        <p className="text-sm text-muted-foreground">
          只有开启投稿的谱池可以投。同一张谱面多人投稿会合并成一条，审核时能看到全部投稿人。
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>可投稿的谱池</CardTitle>
            <CardDescription>
              {openPools.length ? `共 ${openPools.length} 个池开放投稿` : "当前没有开放投稿的谱池"}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />刷新
          </Button>
        </CardHeader>
        <CardContent>
          {openPools.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">等管理员开启投稿后再来吧。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {openPools.map((pool) => (
                <div key={pool.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-medium">Pool {pool.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {pool.chartIds.length} 张 · 已有 {mine.filter((item) => item.poolId === pool.id).length} 条我的投稿
                    </span>
                  </div>
                  <Button size="sm" onClick={() => setTarget(pool.id)}>
                    <Send className="size-4" />投稿
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>我的投稿（{mine.length}）</CardTitle>
          <CardDescription>待审的可以撤回；已通过审核的会直接进入对应谱池。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />加载中
            </div>
          ) : mine.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">还没有投过稿。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>谱面</TableHead>
                  <TableHead>目标池</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>投稿人数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mine.map((item) => (
                  <TableRow key={`${item.poolId}-${item.chartId}`}>
                    <TableCell className="font-medium">{item.chart?.name ?? `谱面 ${item.chartId}`}</TableCell>
                    <TableCell className="font-mono text-sm">Pool {item.poolId}</TableCell>
                    <TableCell><Badge variant={statusVariant(item.status)}>{SUBMISSION_STATUS_LABEL[item.status]}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.submitterCount}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(item)}>详情</Button>
                      {item.status === "PENDING" && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                disabled={busy} onClick={() => void withdraw(item)}>
                          <Trash2 className="size-4" />撤回
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>待审队列（{pending.length}）</CardTitle>
            <CardDescription>通过后谱面会直接加入对应谱池；同一张谱面被多人投过时只需审核一次。</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">没有待审的投稿。</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>谱面</TableHead>
                    <TableHead>目标池</TableHead>
                    <TableHead>投稿人</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">审核</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((item) => (
                    <TableRow key={`${item.poolId}-${item.chartId}`}>
                      <TableCell className="font-medium">{item.chart?.name ?? `谱面 ${item.chartId}`}</TableCell>
                      <TableCell className="font-mono text-sm">Pool {item.poolId}</TableCell>
                      <TableCell>
                        <button className="flex items-center gap-1.5 text-sm hover:underline" onClick={() => setDetail(item)}>
                          <Users className="size-3.5" />
                          {item.submitterCount} 人
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtTime(item.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-600"
                                disabled={busy} onClick={() => void review(item, true)}>
                          <Check className="size-4" />通过
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                disabled={busy} onClick={() => void review(item, false)}>
                          <X className="size-4" />拒绝
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <SubmitDialog poolId={target} onClose={() => setTarget(null)} onDone={() => void load()} />

      <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.chart?.name ?? `谱面 ${detail?.chartId}`}</DialogTitle>
            <DialogDescription>
              Pool {detail?.poolId} · {detail ? SUBMISSION_STATUS_LABEL[detail.status] : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {detail?.chart?.illustration ? (
              <Image src={detail.chart.illustration} alt="" width={400} height={225} unoptimized
                     className="w-full rounded-lg border object-cover" />
            ) : null}
            <div className="text-sm text-muted-foreground">
              {detail?.chart?.level} · 评分 {detail?.chart ? Math.round(detail.chart.rating * 100) : "-"}%
              · {detail?.chart?.ratingCount ?? 0} 人评分
            </div>
            <div className="flex flex-col gap-2">
              <Label>投稿人（{detail?.submitterCount ?? 0}）</Label>
              <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
                {detail?.submitters.map((submitter) => (
                  <div key={submitter.userId} className="flex items-center gap-3 rounded-md border p-2">
                    <Avatar className="size-8">
                      <AvatarImage src={`https://phira.5wyxi.com/files/avatar/${submitter.userId}`} alt="" />
                      <AvatarFallback>{submitter.name?.slice(0, 1) ?? "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{submitter.name || `用户 ${submitter.userId}`}</span>
                      <span className="text-xs text-muted-foreground">ID {submitter.userId} · {fmtTime(submitter.at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 勾选式批量投稿：先搜谱面，再一次性提交。 */
function SubmitDialog({ poolId, onClose, onDone }: { poolId: number | null; onClose: () => void; onDone: () => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ id: number; name: string; level?: string | null; rating?: number }[]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (poolId === null) { setQuery(""); setResults([]); setPicked([]) }
  }, [poolId])

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      // 复用管理员筛谱接口会 403，这里走 Phira 公共搜索
      const data = await fetch(`https://phira.5wyxi.com/chart?pageNum=20&page=1&order=-updated&search=${encodeURIComponent(query)}`)
      if (!data.ok) throw new Error("搜索失败")
      const body = await data.json() as { results?: { id: number; name: string; level?: string; rating?: number }[] }
      setResults(body.results ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "搜索失败")
    } finally {
      setSearching(false)
    }
  }

  const toggle = (id: number) =>
    setPicked((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])

  const submit = async () => {
    if (poolId === null || picked.length === 0) return
    setSending(true)
    try {
      const result = await api.submitCharts(poolId, picked)
      const rejected = result.results.filter((item) => !item.accepted)
      if (rejected.length === 0) {
        toast.success(`已投稿 ${result.accepted} 张谱面`)
      } else {
        toast.warning(`成功 ${result.accepted} 张，${rejected.length} 张未接受（${rejected[0].reason ?? ""}）`)
      }
      onClose()
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "投稿失败")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={poolId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>投稿到 Pool {poolId}</DialogTitle>
          <DialogDescription>搜索并勾选谱面，一次最多 20 张。同一张谱面只能投一次。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input placeholder="搜索谱面名称" value={query} onChange={(event) => setQuery(event.target.value)}
                   onKeyDown={(event) => { if (event.key === "Enter") void search() }} />
            <Button variant="outline" onClick={() => void search()} disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              搜索
            </Button>
          </div>

          {results.length > 0 && (
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border p-2">
              {results.map((chart) => (
                <label key={chart.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" className="size-4 accent-primary"
                         checked={picked.includes(chart.id)} onChange={() => toggle(chart.id)} />
                  <span className="min-w-0 flex-1 truncate">{chart.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {chart.level ?? ""} {chart.rating != null ? `· ${Math.round(chart.rating * 100)}%` : ""}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">已选 {picked.length} 张</span>
            <Button className="ml-auto" onClick={() => void submit()} disabled={sending || picked.length === 0}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              提交投稿
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
