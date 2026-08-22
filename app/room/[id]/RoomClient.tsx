"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink, HelpCircle, Layers, RefreshCw, Save, Settings, Square, Users } from "lucide-react"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { api, type Room, phiraApi, type PhiraUser } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AnimatedTabs } from "@/components/ui/animated-tabs"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type RoomForm = { minPlayer: string; maxPlayer: string; selectCountdown: string; readyCountdown: string; forceFinish: string; interval: string; chatEnable: boolean }

export default function RoomClient({ id }: { id: string }) {
  const pathname = usePathname()
  const roomId = id || decodeURIComponent(pathname.match(/^\/room\/([^/]+)/)?.[1] || "")
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [poolOpen, setPoolOpen] = useState(false)
  const [form, setForm] = useState<RoomForm>({ minPlayer: "", maxPlayer: "", selectCountdown: "", readyCountdown: "", forceFinish: "", interval: "", chatEnable: true })
  const [profiles, setProfiles] = useState<Record<number, PhiraUser | null>>({})
  const [selected, setSelected] = useState<PhiraUser | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  async function load() {
    try {
      const result = await api.room(roomId)
      setRoom(result.info)
      setForm({ minPlayer: String(result.info.config.minPlayer), maxPlayer: String(result.info.config.maxPlayer), selectCountdown: String(result.info.config.selectCountdown), readyCountdown: String(result.info.config.readyCountdown), forceFinish: String(result.info.config.forceFinish), interval: String(result.info.config.interval), chatEnable: true })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "无法加载房间") }
  }
  useEffect(() => { void load(); try { setIsAdmin(Boolean((JSON.parse(window.localStorage.getItem("zenith-session") || "null") as { isAdmin?: boolean } | null)?.isAdmin)) } catch { setIsAdmin(false) } }, [roomId])

  // 动态拉取在线玩家的头像/昵称等资料（phira.5wyxi.com/user/{id}）
  useEffect(() => {
    if (!room) return
    const ids = room.players.map((player) => player.id).filter((pid) => !profiles[pid])
    if (!ids.length) return
    let cancelled = false
    for (const pid of ids) {
      phiraApi.user(pid).then((user) => {
        if (!cancelled && user) setProfiles((prev) => ({ ...prev, [pid]: user }))
      })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  async function action(work: () => Promise<unknown>): Promise<boolean> { setBusy(true); setError(""); try { await work(); await load(); return true } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败"); return false } finally { setBusy(false) } }
  function number(name: keyof Omit<RoomForm, "chatEnable">) { return Number(form[name]) }
  if (error && !room) return <DetailState message={error} />
  if (!room) return <DetailState message="正在加载房间..." loading />

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回控制台</Link>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">房间详情</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{room.roomId}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={room.state === "Playing" ? "default" : "secondary"}>{room.state}</Badge>
            {isAdmin && (
              <>
                <AlertDialog open={configOpen} onOpenChange={setConfigOpen}>
                  <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Settings className="size-4" />修改配置</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>修改房间配置</AlertDialogTitle>
                      <AlertDialogDescription>调整房间运行参数，保存后将立即生效。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <TooltipProvider delayDuration={200}>
                      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void action(() => api.updateRoom(room.roomId, { minPlayer: number("minPlayer"), maxPlayer: number("maxPlayer"), live: room.live, lock: room.locked, chatEnable: form.chatEnable, selectCountdown: number("selectCountdown"), readyCountdown: number("readyCountdown"), forceFinish: number("forceFinish"), interval: number("interval") })).then((ok) => { if (ok) setConfigOpen(false) }) }}>
                        <Field label="最低玩家数" value={form.minPlayer} onChange={(value) => setForm({ ...form, minPlayer: value })} min="1" tip="房间自动开始所需最少玩家数" />
                        <Field label="最大玩家数" value={form.maxPlayer} onChange={(value) => setForm({ ...form, maxPlayer: value })} min="1" tip="房间能容纳的玩家数" />
                        <Field label="选谱倒计时（秒）" value={form.selectCountdown} onChange={(value) => setForm({ ...form, selectCountdown: value })} min="10" tip="玩家进行投票所需要的时间" />
                        <Field label="准备倒计时（秒）" value={form.readyCountdown} onChange={(value) => setForm({ ...form, readyCountdown: value })} min="1" tip="给玩家准备（下载谱面）的时间" />
                        <Field label="强制结束倒计时（秒）" value={form.forceFinish} onChange={(value) => setForm({ ...form, forceFinish: value })} min="1" tip="强制切换房间状态的时间，从 Playing 到 SelectChart" />
                        <Field label="谱池刷新间隔（轮）" value={form.interval} onChange={(value) => setForm({ ...form, interval: value })} min="1" tip="经过填写的轮数之后，将进行谱池的轮换" />
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2.5 sm:col-span-2">
                          <Switch id="chat-enable" checked={form.chatEnable} onCheckedChange={(checked) => setForm({ ...form, chatEnable: checked })} />
                          <label htmlFor="chat-enable" className="flex flex-col text-sm">
                            <span className="font-medium">启用聊天</span>
                            <span className="text-xs font-normal text-muted-foreground">允许玩家在房间内发送消息</span>
                          </label>
                        </div>
                        <AlertDialogFooter className="sm:col-span-2">
                          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
                          <Button type="submit" disabled={busy}><Save className="size-4" />保存配置</Button>
                        </AlertDialogFooter>
                      </form>
                    </TooltipProvider>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog open={poolOpen} onOpenChange={setPoolOpen}>
                  <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Layers className="size-4" />谱池操作</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>房间谱池操作</AlertDialogTitle>
                      <AlertDialogDescription>目标池必须属于房间创建时固化的池列表。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5 text-sm font-medium">
                        <Label htmlFor="switch-pool">切换 pending pool</Label>
                        {room.pool.pools.length < 5 ? (
                          <AnimatedTabs
                            value={String(room.pool.pendingPoolId ?? room.pool.currentPool.id)}
                            onValueChange={(value) => void action(() => api.switchRoomPool(room.roomId, Number(value)))}
                            options={room.pool.pools.map((pool) => ({ value: String(pool.id), label: `Pool ${pool.id}` }))}
                            disabled={busy}
                            className="w-full"
                          />
                        ) : (
                          <select id="switch-pool" className="h-9 rounded-md border bg-background px-3 text-sm" value={room.pool.pendingPoolId ?? room.pool.currentPool.id} onChange={(event) => void action(() => api.switchRoomPool(room.roomId, Number(event.target.value)))} disabled={busy}>
                            {room.pool.pools.map((pool) => <option key={pool.id} value={pool.id}>Pool {pool.id}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 text-sm font-medium">
                        <Label htmlFor="favorite-id">当前池收藏夹 ID</Label>
                        <Input id="favorite-id" type="number" placeholder="留空表示清除" defaultValue={room.pool.favoriteId ?? ""} onBlur={(event) => void action(() => api.setRoomFavorite(room.roomId, event.target.value ? Number(event.target.value) : null))} disabled={busy} />
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={busy}>关闭</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="destructive" size="sm" onClick={() => void action(() => api.endRoom(room.roomId))} disabled={busy || room.state !== "Playing"}><Square className="size-4" />强制结束</Button>
              </>
            )}
          </div>
        </div>

        {error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>运行状态</CardTitle>
              <CardDescription>房间当前状态快照</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <Metric label="玩家" value={`${room.players.length} / ${room.config.maxPlayer}`} />
              <Metric label="当前谱池" value={`Pool ${room.pool.currentPool.id}`} />
              <Metric label="最低开局人数" value={`${room.config.minPlayer}`} />
              <Metric label="谱池刷新间隔" value={`${room.config.interval} 轮`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>房间配置</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="类型" value={room.type} />
              <Row label="锁定" value={room.locked ? "是" : "否"} />
              <Row label="循环模式" value={room.cycle ? "是" : "否"} />
              <Row label="选谱倒计时" value={`${room.config.selectCountdown} 秒`} />
              <Row label="准备倒计时" value={`${room.config.readyCountdown} 秒`} />
              <Row label="强制结束" value={`${room.config.forceFinish} 秒`} />
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="size-4" />玩家列表</CardTitle>
            <CardDescription>{room.players.length} 位玩家在线</CardDescription>
          </CardHeader>
          <CardContent>
            {room.players.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {room.players.map((player) => {
                  const profile = profiles[player.id]
                  const loading = !profile && !profiles[player.id]
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => { if (profile) { setSelected(profile); setProfileOpen(true) } }}
                      className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <Avatar className="size-7 shrink-0">
                        {profile?.avatar && <AvatarImage src={profile.avatar} alt={profile.name} />}
                        <AvatarFallback className="size-7 text-[11px]">{profile?.name?.slice(0, 1) ?? <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-left">{profile?.name ?? (loading ? "加载中..." : `玩家 ${player.id}`)}</span>
                      {profile && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/60" />}
                    </button>
                  )
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">暂无玩家</p>}
          </CardContent>
        </Card>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="sm:max-w-md">
            {selected && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    <Avatar className="size-16">
                      {selected.avatar && <AvatarImage src={selected.avatar} alt={selected.name} />}
                      <AvatarFallback className="size-16 text-xl">{selected.name?.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle>{selected.name}</DialogTitle>
                      <DialogDescription>Phira 用户 #{selected.id}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DetailRow label="RKS" value={Number(selected.rks.toFixed(2))} />
                  <DetailRow label="粉丝" value={selected.follower_count} />
                  <DetailRow label="关注" value={selected.following_count} />
                  <DetailRow label="语言" value={selected.language} />
                </div>
                {selected.bio && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <p className="mb-1 text-xs text-muted-foreground">简介</p>
                    <p className="whitespace-pre-wrap">{selected.bio}</p>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`https://phira.moe/user/${selected.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />打开官方主页
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
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
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-semibold">{value}</p></div>
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b pb-2"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>
}
function Field({ label, value, onChange, min, tip }: { label: string; value: string; onChange: (value: string) => void; min: string; tip?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span className="inline-flex items-center gap-1">
        {label}
        {tip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex items-center text-muted-foreground/70 transition-colors hover:text-foreground">
                <HelpCircle className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{tip}</TooltipContent>
          </Tooltip>
        )}
      </span>
      <Input required type="number" min={min} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
