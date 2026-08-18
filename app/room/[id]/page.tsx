"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, RefreshCw, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { api, type Room } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RoomPage() {
  const params = useParams<{ id: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    void api.room(params.id).then((result) => setRoom(result.info)).catch((reason) => setError(reason instanceof Error ? reason.message : "无法加载房间"))
  }, [params.id])

  if (error) return <DetailState message={error} />
  if (!room) return <DetailState message="正在加载房间..." loading />

  return <main className="min-h-screen bg-muted/40 p-5 lg:p-8"><div className="mx-auto max-w-5xl"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回控制台</Link><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">房间详情</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{room.roomId}</h1></div><Badge variant={room.live ? "default" : "secondary"}>{room.state}</Badge></div><div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>运行状态</CardTitle><CardDescription>房间当前状态快照</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Metric label="玩家" value={`${room.players.length} / ${room.config.maxPlayer}`} /><Metric label="当前谱池" value={`Pool ${room.pool.currentPool.id}`} /><Metric label="最低开局人数" value={`${room.config.minPlayer}`} /><Metric label="谱池刷新间隔" value={`${room.config.interval} 轮`} /></CardContent></Card><Card><CardHeader><CardTitle>房间配置</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Row label="类型" value={room.type} /><Row label="锁定" value={room.locked ? "是" : "否"} /><Row label="循环模式" value={room.cycle ? "是" : "否"} /><Row label="选谱倒计时" value={`${room.config.selectCountdown} 秒`} /><Row label="准备倒计时" value={`${room.config.readyCountdown} 秒`} /><Row label="强制结束" value={`${room.config.forceFinish} 秒`} /></CardContent></Card></div><Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />玩家列表</CardTitle><CardDescription>{room.players.length} 位玩家在线</CardDescription></CardHeader><CardContent>{room.players.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{room.players.map((player) => <div key={player.id} className="rounded-md border px-3 py-2 text-sm">{player.name || `玩家 ${player.id}`}</div>)}</div> : <p className="text-sm text-muted-foreground">暂无玩家</p>}</CardContent></Card></div></main>
}

function DetailState({ message, loading = false }: { message: string; loading?: boolean }) { return <main className="flex min-h-screen items-center justify-center p-5"><div className="text-center"><p className="text-sm text-muted-foreground">{message}</p>{loading ? <RefreshCw className="mx-auto mt-3 size-5 animate-spin text-primary" /> : <Button asChild className="mt-4"><Link href="/">返回控制台</Link></Button>}</div></main> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/60 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div> }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div> }
