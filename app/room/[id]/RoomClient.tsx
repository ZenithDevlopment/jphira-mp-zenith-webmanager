"use client"

import Link from "next/link"
import { ArrowLeft, Eraser, ExternalLink, HelpCircle, Layers, RefreshCw, Save, Settings, Square, Users } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { api, ApiError, type Room, phiraApi, type PhiraUser } from "@/lib/api"
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
import { toast } from "sonner"

type RoomForm = { minPlayer: string; maxPlayer: string; selectCountdown: string; readyCountdown: string; forceFinish: string; interval: string; chatEnable: boolean; locked: boolean; cancelReadyInVote: boolean; startWhenAllReady: boolean; allReadyDelay: string; adminIds: string }

export default function RoomClient({ id }: { id: string }) {
  const pathname = usePathname()
  const roomId = id || decodeURIComponent(pathname.match(/^\/room\/([^/]+)/)?.[1] || "")
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [poolOpen, setPoolOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [form, setForm] = useState<RoomForm>({ minPlayer: "", maxPlayer: "", selectCountdown: "", readyCountdown: "", forceFinish: "", interval: "", chatEnable: true, locked: false, cancelReadyInVote: true, startWhenAllReady: true, allReadyDelay: "5", adminIds: "" })
  const [profiles, setProfiles] = useState<Record<number, PhiraUser | null>>({})
  const [selected, setSelected] = useState<PhiraUser | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  /** Refreshes the view. Resolves true when the server says the room no longer exists. */
  async function load(): Promise<boolean> {
    try {
      const result = await api.room(roomId)
      setRoom(result.info)
      setForm({ minPlayer: String(result.info.config.minPlayer), maxPlayer: String(result.info.config.maxPlayer), selectCountdown: String(result.info.config.selectCountdown), readyCountdown: String(result.info.config.readyCountdown), forceFinish: String(result.info.config.forceFinish), interval: String(result.info.config.interval), chatEnable: result.info.config.chatEnable ?? true, locked: result.info.locked, cancelReadyInVote: result.info.config.cancelReadyInVote ?? true, startWhenAllReady: result.info.config.startWhenAllReady ?? true, allReadyDelay: String(result.info.config.allReadyDelay ?? 5), adminIds: (result.info.config.adminIds ?? []).join(", ") })
      return false
    } catch (reason) { setError(reason instanceof Error ? reason.message : "无法加载房间"); return reason instanceof ApiError && reason.status === 404 }
  }
  useEffect(() => { void load(); try { const session = JSON.parse(window.localStorage.getItem("zenith-session") || "null") as { isAdmin?: boolean; userId?: number } | null; setIsAdmin(Boolean(session?.isAdmin)); setUserId(typeof session?.userId === "number" ? session.userId : null) } catch { setIsAdmin(false); setUserId(null) } }, [roomId])

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

  async function action(work: () => Promise<unknown>, afterLoad?: (roomGone: boolean) => void): Promise<boolean> {
    setBusy(true)
    setError("")
    try {
      await work()
      const roomGone = await load()
      afterLoad?.(roomGone)
      return true
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "操作失败"
      setError(message)
      // Also toast: the dialogs render above the page level error, so a failed save
      // inside one would otherwise look like the button simply did nothing.
      toast.error(message)
      return false
    } finally {
      setBusy(false)
    }
  }
  function number(name: keyof Omit<RoomForm, "chatEnable" | "locked" | "cancelReadyInVote" | "startWhenAllReady" | "adminIds">) { return Number(form[name]) }
  /** Accepts "1, 2 3" and ignores empties; the server rejects non positive ids. */
  function parseAdminIds(raw: string) {
    return raw.split(/[^0-9]+/).filter(Boolean).map(Number)
  }
  if (error && !room) return <DetailState message={error} />
  if (!room) return <DetailState message="正在加载房间..." loading />

  // Clearing is open to global admins and to whoever controls the room: its host or a room admin.
  const controlsRoom = userId !== null && (room.host === userId || (room.config.adminIds ?? []).includes(userId))
  const canClear = isAdmin || controlsRoom
  const roomEmpty = room.players.length === 0 && room.monitors.length === 0
  function clearRoom(target: string) {
    let removed = 0
    void action(async () => { removed = (await api.clearRoom(target)).removed }, (roomGone) => {
      // Rooms players created in game are destroyed by the server once empty, so the refresh finding
      // no room is the expected outcome: say so and fall through to the page's not-found state.
      toast.success(roomGone ? `房间已清空（已移除 ${removed} 人），房间已无人，已自动关闭` : `房间已清空（已移除 ${removed} 人）`)
      if (roomGone) setRoom(null)
    })
  }

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
                      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void action(() => api.updateRoom(room.roomId, { minPlayer: number("minPlayer"), maxPlayer: number("maxPlayer"), live: room.live, lock: form.locked, chatEnable: form.chatEnable, cancelReadyInVote: form.cancelReadyInVote, startWhenAllReady: form.startWhenAllReady, allReadyDelay: number("allReadyDelay"), selectCountdown: number("selectCountdown"), readyCountdown: number("readyCountdown"), forceFinish: number("forceFinish"), interval: number("interval"), adminIds: parseAdminIds(form.adminIds) })).then((ok) => { if (ok) setConfigOpen(false) }) }}>
                        <Field label="最低玩家数" value={form.minPlayer} onChange={(value) => setForm({ ...form, minPlayer: value })} min="1" tip="房间自动开始所需最少玩家数" />
                        <Field label="最大玩家数" value={form.maxPlayer} onChange={(value) => setForm({ ...form, maxPlayer: value })} min="1" tip="房间能容纳的玩家数" />
                        <Field label="选谱倒计时（秒）" value={form.selectCountdown} onChange={(value) => setForm({ ...form, selectCountdown: value })} min="10" tip="玩家进行投票所需要的时间" />
                        <Field label="准备倒计时（秒）" value={form.readyCountdown} onChange={(value) => setForm({ ...form, readyCountdown: value })} min="1" tip="给玩家准备（下载谱面）的时间" />
                        <Field label="强制结束倒计时（秒）" value={form.forceFinish} onChange={(value) => setForm({ ...form, forceFinish: value })} min="1" tip="强制切换房间状态的时间，从 Playing 到 SelectChart" />
                        <Field label="谱池刷新间隔（轮）" value={form.interval} onChange={(value) => setForm({ ...form, interval: value })} min="1" tip="经过填写的轮数之后，将进行谱池的轮换" />
                        <div className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
                          <Label htmlFor="room-admins">房间管理员 ID</Label>
                          <Input id="room-admins" value={form.adminIds} onChange={(event) => setForm({ ...form, adminIds: event.target.value })} placeholder="例如 1802, 1903" />
                          <p className="text-xs font-normal text-muted-foreground">
                            逗号分隔的用户 ID。这些人除了房主的操作外还可以开始本轮游戏；其余玩家按房主身份在客户端投票选谱。留空表示只有房主可以控制。
                          </p>
                        </div>
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2.5 sm:col-span-2">
                          <Switch id="chat-enable" checked={form.chatEnable} onCheckedChange={(checked) => setForm({ ...form, chatEnable: checked })} />
                          <label htmlFor="chat-enable" className="flex flex-col text-sm">
                            <span className="font-medium">启用聊天</span>
                            <span className="text-xs font-normal text-muted-foreground">允许玩家在房间内发送消息</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2.5 sm:col-span-2">
                          <Switch id="room-lock" checked={form.locked} onCheckedChange={(checked) => setForm({ ...form, locked: checked })} />
                          <label htmlFor="room-lock" className="flex flex-col text-sm">
                            <span className="font-medium">锁定房间</span>
                            <span className="text-xs font-normal text-muted-foreground">房间内有玩家时，拒绝新玩家加入</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2.5 sm:col-span-2">
                          <Switch id="cancel-ready-in-vote" checked={form.cancelReadyInVote} onCheckedChange={(checked) => setForm({ ...form, cancelReadyInVote: checked })} />
                          <label htmlFor="cancel-ready-in-vote" className="flex flex-col text-sm">
                            <span className="font-medium">投票时可取消准备</span>
                            <span className="text-xs font-normal text-muted-foreground">选谱投票阶段已准备的玩家可以取消准备</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2.5 sm:col-span-2">
                          <Switch id="start-when-all-ready" checked={form.startWhenAllReady} onCheckedChange={(checked) => setForm({ ...form, startWhenAllReady: checked })} />
                          <label htmlFor="start-when-all-ready" className="flex flex-col text-sm">
                            <span className="font-medium">全员准备后提前开始</span>
                            <span className="text-xs font-normal text-muted-foreground">在线玩家全部准备后提前开局（观战者不计），关闭则等满准备倒计时</span>
                          </label>
                        </div>
                        <Field label="全员准备后延迟（秒）" value={form.allReadyDelay} onChange={(value) => setForm({ ...form, allReadyDelay: value })} min="0" max="300" disabled={!form.startWhenAllReady} tip="全员准备后等待这么久再开始，0 表示立即开始，范围 0 到 300" />
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
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button variant="destructive" size="sm" onClick={() => void action(() => api.endRoom(room.roomId))} disabled={busy || room.state !== "Playing"}><Square className="size-4" />强制结束</Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {room.state !== "Playing" ? "仅在对局进行中可用，当前为 " + room.state : "立即结束本轮并回到选谱"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            {canClear && (
              <>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button variant="destructive" size="sm" onClick={() => setClearOpen(true)} disabled={busy || roomEmpty}><Eraser className="size-4" />清空房间</Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {roomEmpty ? "房间内没有玩家" : "移除并断开房间内的所有成员"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认清空房间？</AlertDialogTitle>
                      <AlertDialogDescription>房间内的所有玩家和观战者都会被移出并断开连接，正在进行的一轮游戏会随之结束。被移出的人需要自行重新加入房间。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => clearRoom(room.roomId)}>确认清空</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
              <Row label="投票时取消准备" value={(room.config.cancelReadyInVote ?? true) ? "是" : "否"} />
              <Row label="全员准备后开始" value={(room.config.startWhenAllReady ?? true) ? "是" : "否"} />
              <Row label="全员准备后延迟" value={`${room.config.allReadyDelay ?? 5} 秒`} />
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
function Field({ label, value, onChange, min, max, disabled, tip }: { label: string; value: string; onChange: (value: string) => void; min: string; max?: string; disabled?: boolean; tip?: string }) {
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
      <Input required type="number" min={min} max={max} disabled={disabled} className="disabled:cursor-not-allowed disabled:opacity-50" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
