"use client"

import { useState } from "react"
import { Layers, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, POOL_CATEGORIES, type PoolCategory } from "@/lib/api"

/**
 * Creates empty pools in bulk so an operator can stage a batch and then fill each one.
 * Ids come from the server, which avoids two clients picking the same one.
 */
export function BatchCreatePools({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState("5")
  const [category, setCategory] = useState<PoolCategory>("MANUAL")
  const [sizeLimit, setSizeLimit] = useState("")
  const [roundsPerStay, setRoundsPerStay] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const amount = Number(count)
    if (!Number.isInteger(amount) || amount < 1 || amount > 50) {
      toast.error("数量需为 1 到 50")
      return
    }
    setBusy(true)
    try {
      const data = await api.createPoolsBatch({
        count: amount,
        category,
        sizeLimit: sizeLimit.trim() === "" ? undefined : Number(sizeLimit),
        roundsPerStay: roundsPerStay.trim() === "" ? undefined : Number(roundsPerStay),
      })
      toast.success(`已创建 ${data.poolIds.length} 个空池：${data.poolIds.join(", ")}`)
      setOpen(false)
      onCreated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量创建失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Layers className="size-4" />批量新建空池</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量新建空池</DialogTitle>
          <DialogDescription>
            一次创建多个空池，ID 由服务端分配。建完可以在列表里勾选它们批量改类别或逐个挑谱。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-count">数量</Label>
            <Input id="batch-count" inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} disabled={busy} />
            <p className="text-xs text-muted-foreground">上限 50 个。</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-category">类别</Label>
            <select
              id="batch-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as PoolCategory)}
              disabled={busy}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {POOL_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label} — {item.hint}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="batch-size">每池谱面数</Label>
              <Input id="batch-size" inputMode="numeric" value={sizeLimit} onChange={(event) => setSizeLimit(event.target.value)} placeholder="留空=不限" disabled={busy} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="batch-rounds">停留轮数</Label>
              <Input id="batch-rounds" inputMode="numeric" value={roundsPerStay} onChange={(event) => setRoundsPerStay(event.target.value)} placeholder="留空=跟随房间" disabled={busy} />
            </div>
          </div>

          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
            创建
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
