"use client"

import Link from "next/link"
import { ArrowLeft, RefreshCw, Save, Square, Users } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { api, type Room } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type RoomForm = { minPlayer: string; maxPlayer: string; selectCountdown: string; readyCountdown: string; forceFinish: string; interval: string; chatEnable: boolean }

export default function RoomClient({ id }: { id: string }) {
  const pathname = usePathname()
  const roomId = id || decodeURIComponent(pathname.match(/^\/room\/([^/]+)/)?.[1] || "")
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [form, setForm] = useState<RoomForm>({ minPlayer: "", maxPlayer: "", selectCountdown: "", readyCountdown: "", forceFinish: "", interval: "", chatEnable: true })

  async function load() {
    try {
      const result = await api.room(roomId)
      setRoom(result.info)
      setForm({ minPlayer: String(result.info.config.minPlayer), maxPlayer: String(result.info.config.maxPlayer), selectCountdown: String(result.info.config.selectCountdown), readyCountdown: String(result.info.config.readyCountdown), forceFinish: String(result.info.config.forceFinish), interval: String(result.info.config.interval), chatEnable: true })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "无法加载房间") }
  }
  useEffect(() => { void load(); try { setIsAdmin(Boolean((JSON.parse(window.localStorage.getItem("zenith-session") || "null") as { isAdmin?: boolean } | null)?.isAdmin)) } catch { setIsAdmin(false) } }, [roomId])

  async function action(work: () => Promise<unknown>) { setBusy(true); setError(""); try { await work(); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败") } finally { setBusy(false) } }
  function number(name: keyof Omit<RoomForm, "chatEnable">) { return Number(form[name]) }
  if (error && !room) return <DetailState message={error} />
  if (!room) return <DetailState message="正在加载房间..." loading />

  return <main className="min-h-screen bg-muted/40 p-5 lg:p-8"><div className="mx-auto max-w-5xl"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回控制台</Link><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">房间详情</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{room.roomId}</h1></div><div className="flex items-center gap-2"><Badge variant={room.state === "Playing" ? "default" : "secondary"}>{room.state}</Badge>{isAdmin && <Button variant="outline" size="sm" onClick={() => void action(() => api.endRoom(room.roomId))} disabled={busy || room.state !== "Playing"}><Square />强制结束</Button>}</div></div>{error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}<div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>运行状态</CardTitle><CardDescription>房间当前状态快照</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Metric label="玩家" value={`${room.players.length} / ${room.config.maxPlayer}`} /><Metric label="当前谱池" value={`Pool ${room.pool.currentPool.id}`} /><Metric label="最低开局人数" value={`${room.config.minPlayer}`} /><Metric label="谱池刷新间隔" value={`${room.config.interval} 轮`} /></CardContent></Card><Card><CardHeader><CardTitle>房间配置</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Row label="类型" value={room.type} /><Row label="锁定" value={room.locked ? "是" : "否"} /><Row label="循环模式" value={room.cycle ? "是" : "否"} /><Row label="选谱倒计时" value={`${room.config.selectCountdown} 秒`} /><Row label="准备倒计时" value={`${room.config.readyCountdown} 秒`} /><Row label="强制结束" value={`${room.config.forceFinish} 秒`} /></CardContent></Card></div>{isAdmin && <div className="mt-6 grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>修改房间配置</CardTitle><CardDescription>按照 API 要求提交完整的必填配置。</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void action(() => api.updateRoom(room.roomId, { minPlayer: number("minPlayer"), maxPlayer: number("maxPlayer"), live: room.live, lock: room.locked, chatEnable: form.chatEnable, selectCountdown: number("selectCountdown"), readyCountdown: number("readyCountdown"), forceFinish: number("forceFinish"), interval: number("interval") })) }}><Field label="最低玩家数" value={form.minPlayer} onChange={(value) => setForm({ ...form, minPlayer: value })} min="1" /><Field label="最大玩家数" value={form.maxPlayer} onChange={(value) => setForm({ ...form, maxPlayer: value })} min="1" /><Field label="选谱倒计时（秒）" value={form.selectCountdown} onChange={(value) => setForm({ ...form, selectCountdown: value })} min="10" /><Field label="准备倒计时（秒）" value={form.readyCountdown} onChange={(value) => setForm({ ...form, readyCountdown: value })} min="1" /><Field label="强制结束倒计时（秒）" value={form.forceFinish} onChange={(value) => setForm({ ...form, forceFinish: value })} min="1" /><Field label="谱池刷新间隔（轮）" value={form.interval} onChange={(value) => setForm({ ...form, interval: value })} min="1" /><label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.chatEnable} onChange={(event) => setForm({ ...form, chatEnable: event.target.checked })} />启用聊天</label><Button type="submit" disabled={busy} className="sm:col-span-2"><Save />保存配置</Button></form></CardContent></Card><Card><CardHeader><CardTitle>房间谱池操作</CardTitle><CardDescription>目标池必须属于房间创建时固化的池列表。</CardDescription></CardHeader><CardContent className="space-y-4"><label className="flex flex-col gap-2 text-sm font-medium">切换 pending pool<select className="h-9 rounded-md border bg-background px-3 text-sm" value={room.pool.pendingPoolId ?? room.pool.currentPool.id} onChange={(event) => void action(() => api.switchRoomPool(room.roomId, Number(event.target.value)))} disabled={busy}>{room.pool.pools.map((pool) => <option key={pool.id} value={pool.id}>Pool {pool.id}</option>)}</select></label><label className="flex flex-col gap-2 text-sm font-medium">当前池收藏夹 ID<input className="h-9 rounded-md border bg-background px-3 text-sm" type="number" placeholder="留空表示清除" defaultValue={room.pool.favoriteId ?? ""} onBlur={(event) => void action(() => api.setRoomFavorite(room.roomId, event.target.value ? Number(event.target.value) : null))} disabled={busy} /></label></CardContent></Card></div>}<Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />玩家列表</CardTitle><CardDescription>{room.players.length} 位玩家在线</CardDescription></CardHeader><CardContent>{room.players.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{room.players.map((player) => <div key={player.id} className="rounded-md border px-3 py-2 text-sm">{player.name || `玩家 ${player.id}`}</div>)}</div> : <p className="text-sm text-muted-foreground">暂无玩家</p>}</CardContent></Card></div></main>
}

function DetailState({ message, loading = false }: { message: string; loading?: boolean }) { return <main className="flex min-h-screen items-center justify-center p-5"><div className="text-center"><p className="text-sm text-muted-foreground">{message}</p>{loading ? <RefreshCw className="mx-auto mt-3 size-5 animate-spin text-primary" /> : <Button asChild className="mt-4"><a href="/">返回控制台</a></Button>}</div></main> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/60 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div> }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div> }
function Field({ label, value, onChange, min }: { label: string; value: string; onChange: (value: string) => void; min: string }) { return <label className="flex flex-col gap-1 text-sm font-medium">{label}<Input required type="number" min={min} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
