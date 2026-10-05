"use client"

import { useState } from "react"
import { Loader2, Megaphone, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

/**
 * Sends an operator message either to one room or to everyone online.
 *
 * Clients render it as a system message (sender id -1), the same channel used by
 * countdown notices, so no protocol change is involved.
 */
export function SayDialog({ roomId, trigger }: { roomId?: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const scope = roomId ? `房间 ${roomId}` : "全服"

  const send = async () => {
    const text = message.trim()
    if (!text) {
      toast.error("消息不能为空")
      return
    }
    setBusy(true)
    try {
      const result = roomId ? await api.sayToRoom(roomId, text) : await api.broadcast(text)
      toast.success(`已发送到${scope}（${result.delivered} 人）`)
      setMessage("")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Megaphone className="size-4" />全服广播
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>发送到{scope}</DialogTitle>
          <DialogDescription>
            会以系统消息（发送者显示为「管理员」）出现在客户端聊天框，最多 200 字。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="say-message">消息内容</Label>
            <Input
              id="say-message"
              value={message}
              maxLength={200}
              placeholder="例如：本轮比赛将在 5 分钟后开始"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void send() }}
            />
            <p className="text-xs text-muted-foreground">{message.length}/200</p>
          </div>
          <Button onClick={() => void send()} disabled={busy || !message.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
            发送
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
