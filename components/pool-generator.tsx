"use client"

import { useState } from "react"
import { Loader2, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, POOL_CATEGORIES, type ChartSearchResult, type PoolCategory } from "@/lib/api"

/**
 * Screens the catalogue by category rule and cuts the matches into pools.
 *
 * Durations are only known after probing, so TB needs a probe budget: every probed
 * chart costs two range requests against Phira.
 */
export function PoolGenerator({ onGenerated }: { onGenerated?: () => void }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<PoolCategory>("REGULAR")
  const [sizeLimit, setSizeLimit] = useState("15")
  const [roundsPerStay, setRoundsPerStay] = useState("3")
  const [probeBudget, setProbeBudget] = useState("200")
  const [preview, setPreview] = useState<ChartSearchResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [generating, setGenerating] = useState(false)

  const needsDuration = category === "TB"

  const loadPreview = async () => {
    setPreviewing(true)
    try {
      // TB 的候选要先探测时长才会匹配，所以预览时也带上预算
      const data = await api.searchCharts({
        category,
        limit: 5,
        probeDuration: needsDuration && probeBudget.trim() !== "" ? Number(probeBudget) : undefined,
      })
      setPreview(data.result)
      if (!data.result.indexed) toast.warning("索引为空，先在生成时刷新一次目录")
      else if (data.result.pendingDuration) toast.info("还有候选未探测时长，调大预算可以看到更多")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "筛选失败")
    } finally {
      setPreviewing(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const data = await api.generatePools({
        category,
        sizeLimit: sizeLimit.trim() === "" ? undefined : Number(sizeLimit),
        roundsPerStay: roundsPerStay.trim() === "" ? undefined : Number(roundsPerStay),
        probeDuration: needsDuration && probeBudget.trim() !== "" ? Number(probeBudget) : undefined,
      })
      toast.success(`已生成 ${data.poolIds.length} 个池`)
      setPreview(null)
      setOpen(false)
      onGenerated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败")
    } finally {
      setGenerating(false)
    }
  }

  const refreshIndex = async () => {
    setPreviewing(true)
    try {
      const data = await api.searchCharts({ category, limit: 5, refresh: true })
      setPreview(data.result)
      toast.info("已在后台增量拉取谱面目录，稍后刷新查看")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新失败")
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Wand2 className="size-4" />按规则生成谱池</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>按规则生成谱池</DialogTitle>
          <DialogDescription>
            按类别规则筛选全站谱面，然后每 N 首切分为一个池。已有同类别的池不会被改动。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gen-category">类别</Label>
            <select
              id="gen-category"
              value={category}
              onChange={(event) => { setCategory(event.target.value as PoolCategory); setPreview(null) }}
              disabled={generating}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {POOL_CATEGORIES.filter((item) => item.value !== "MANUAL").map((item) => (
                <option key={item.value} value={item.value}>{item.label} — {item.hint}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="gen-size">每池谱面数</Label>
              <Input id="gen-size" inputMode="numeric" value={sizeLimit} onChange={(event) => setSizeLimit(event.target.value)} disabled={generating} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gen-rounds">停留轮数</Label>
              <Input id="gen-rounds" inputMode="numeric" value={roundsPerStay} onChange={(event) => setRoundsPerStay(event.target.value)} disabled={generating} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gen-probe">时长探测预算</Label>
              <Input id="gen-probe" inputMode="numeric" value={probeBudget} onChange={(event) => setProbeBudget(event.target.value)} disabled={generating || !needsDuration} />
            </div>
          </div>

          {needsDuration && (
            <p className="text-xs text-muted-foreground">
              TB 需要时长，而时长只能从谱面归档里解析。预算决定最多探测多少首，
              每首两次请求；超出预算的候选不会进池。
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadPreview()} disabled={previewing || generating}>
              {previewing ? <Loader2 className="size-4 animate-spin" /> : null}
              预览匹配数
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refreshIndex()} disabled={previewing || generating}>
              刷新谱面目录
            </Button>
            <Button size="sm" className="ml-auto" onClick={() => void generate()} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              生成
            </Button>
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">索引 {preview.indexed}</Badge>
                <Badge variant="secondary">匹配 {preview.matched}</Badge>
                <Badge variant={preview.refreshing ? "outline" : "secondary"}>
                  {preview.refreshing ? "正在拉取目录" : `远端 ${preview.remoteTotal ?? "?"}`}
                </Badge>
                {Number(sizeLimit) > 0 && (
                  <Badge variant="outline">约 {Math.floor(preview.matched / Number(sizeLimit))} 个池</Badge>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                {preview.charts.map((chart) => (
                  <div key={chart.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{chart.name}</span>
                    <span className="shrink-0">
                      {chart.level} · 评分 {Math.round(chart.rating * 100)}% · {chart.ratingCount} 人
                      {chart.durationSeconds != null ? ` · ${Math.floor(chart.durationSeconds / 60)}分${chart.durationSeconds % 60}秒` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
