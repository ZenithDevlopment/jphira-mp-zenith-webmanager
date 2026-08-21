"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Activity, Boxes, ChevronDown, CircleHelp, Database, DoorOpen, LockKeyhole, LogIn, LogOut, Mail, Plus, RefreshCw, ShieldCheck, Square, Trash2, Users, Zap } from "lucide-react"
import { toast } from "sonner"
import { api, type Pool, type Room } from "@/lib/api"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import RoomClient from "@/app/room/[id]/RoomClient"
import PoolClient from "@/app/pool/[id]/PoolClient"

const nav = [{ label: "总览", icon: Activity }, { label: "房间管理", icon: DoorOpen }, { label: "谱池管理", icon: Database }]
type ConfirmTarget = { type: "room" | "pool"; id: string } | null
type Session = { token: string; isAdmin: boolean; email: string }

export default function Dashboard() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [query, setQuery] = useState("")
  const [active, setActive] = useState("总览")
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null)
  const [createTarget, setCreateTarget] = useState<"room" | "pool" | null>(null)
  const [roomId, setRoomId] = useState("")
  const [roomPools, setRoomPools] = useState("0")
  const [poolId, setPoolId] = useState("")
  const [chartIds, setChartIds] = useState("")
  const [profileOpen, setProfileOpen] = useState(false)
  const pathname = usePathname()

  async function load() {
    setLoading(true)
    try {
      const [roomData, poolData] = await Promise.all([api.rooms(), api.pools()])
      setRooms(roomData.rooms)
      setPools(poolData.pools)
    } catch (reason) {
      if (reason instanceof Error && reason.message === "未登录") { window.localStorage.removeItem("zenith-token"); window.localStorage.removeItem("zenith-session"); setSession(null); toast.error("登录已失效", { description: "请重新登录" }) }
      else toast.error("无法连接 API", { description: reason instanceof Error ? reason.message : "请确认后端 API 服务" })
    } finally { setLoading(false) }
  }
  useEffect(() => {
    const stored = window.localStorage.getItem("zenith-session")
    let current: Session | null = null
    try { current = stored ? JSON.parse(stored) as Session : null } catch { window.localStorage.removeItem("zenith-session"); window.localStorage.removeItem("zenith-token") }
    setSession(current)
    if (current?.token) void load()
    else setLoading(false)
  }, [])

  const route = pathname.match(/^\/(room|pool)\/([^/]+)\/?$/)
  if (route) return route[1] === "room" ? <RoomClient id={decodeURIComponent(route[2])} /> : <PoolClient id={decodeURIComponent(route[2])} />

  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoggingIn(true)
    try { const result = await api.login(email, password); const nextSession = { token: result.token, isAdmin: result.isAdmin, email }; window.localStorage.setItem("zenith-token", result.token); window.localStorage.setItem("zenith-session", JSON.stringify(nextSession)); setSession(nextSession); toast.success("登录成功", { description: result.isAdmin ? "管理员权限已启用" : "当前为只读权限" }); await load() }
    catch (reason) { toast.error("登录失败", { description: reason instanceof Error ? reason.message : "请检查账号和密码" }) }
    finally { setLoggingIn(false) }
  }
  function logout() { window.localStorage.removeItem("zenith-token"); window.localStorage.removeItem("zenith-session"); setSession(null); toast.success("已退出登录") }

  async function action(work: () => Promise<unknown>, success: string) {
    try { await work(); toast.success(success); await load() }
    catch (reason) { toast.error("操作失败", { description: reason instanceof Error ? reason.message : "请稍后重试" }) }
  }
  async function confirmDelete() {
    if (!confirmTarget) return
    const target = confirmTarget
    setConfirmTarget(null)
    await action(() => target.type === "room" ? api.deleteRoom(target.id) : api.deletePool(Number(target.id)), target.type === "room" ? "房间已删除" : "谱池已删除")
  }
  function createRoom(event: React.FormEvent) {
    event.preventDefault()
    void action(() => api.createRoom(roomId.trim(), roomPools.split(",").map(Number).filter(Number.isFinite)), "房间已创建").then(() => { setRoomId(""); setCreateTarget(null) })
  }
  function createPool(event: React.FormEvent) {
    event.preventDefault()
    void action(() => api.createPool(Number(poolId), chartIds.split(",").map(Number).filter(Number.isFinite)), "谱池已创建").then(() => { setPoolId(""); setChartIds(""); setCreateTarget(null) })
  }

  const filteredRooms = rooms.filter((room) => room.roomId.toLowerCase().includes(query.toLowerCase()))
  const liveRooms = rooms.filter((room) => room.state === "Playing").length
  const totalPlayers = rooms.reduce((sum, room) => sum + room.players.length, 0)
  const showRooms = active === "房间管理"
  const showPools = active === "谱池管理"
  const isMockApi = process.env.NEXT_PUBLIC_MOCK_API === "true"

  if (session === undefined) return <div className="flex min-h-screen items-center justify-center"><RefreshCw className="size-4 animate-spin text-primary" /></div>
  if (!session) return <LoginView email={email} password={password} setEmail={setEmail} setPassword={setPassword} login={login} loading={loggingIn} />
  const canWrite = session.isAdmin
  return <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
    {/* 侧边栏 */}
    <aside className="glass sticky top-0 z-40 hidden h-screen flex-col border-r lg:flex">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30"><Boxes className="size-5" /></div>
        <div><p className="text-sm font-bold tracking-tight text-gradient">Zenith Console</p><p className="text-[11px] text-muted-foreground">JPhira Multiplayer</p></div>
      </div>
      <div className="flex flex-1 flex-col gap-6 p-4">
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">工作区</p>
          <nav className="flex flex-col gap-1">{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActive(label)} className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active === label ? "bg-gradient-to-r from-blue-500/15 to-cyan-500/10 font-medium text-blue-300" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className={`size-4 ${active === label ? "text-blue-400" : "text-muted-foreground group-hover:text-foreground"}`} />{label}</button>)}</nav>
        </div>
        <button onClick={() => setActive("API 文档")} className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active === "API 文档" ? "bg-gradient-to-r from-blue-500/15 to-cyan-500/10 font-medium text-blue-300" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><CircleHelp className={`size-4 ${active === "API 文档" ? "text-blue-400" : "text-muted-foreground group-hover:text-foreground"}`} /> API 文档</button>
      </div>
      <div className="relative border-t p-4">
        <button type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)} className="flex w-full items-center gap-3 rounded-xl border bg-card/60 p-3 text-left transition-colors hover:border-blue-500/30">
          <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-300"><ShieldCheck className="size-4" /></div>
          <div className="min-w-0"><p className="truncate text-sm font-medium">{session.isAdmin ? "管理员" : "只读用户"}</p><p className="truncate text-[11px] text-muted-foreground">{session.email}</p></div>
          <ChevronDown className={`ml-auto size-4 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
        </button>
        <div className={`absolute bottom-full left-4 right-4 origin-bottom rounded-xl border bg-card p-1.5 shadow-2xl transition-all duration-200 ease-out ${profileOpen ? "translate-y-4 scale-100 opacity-100" : "pointer-events-none translate-y-6 scale-95 opacity-0"}`}><Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300" onClick={logout}><LogOut className="size-4" />退出登录</Button></div>
      </div>
    </aside>

    <main className="relative min-w-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px glow-line" />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/70 px-5 backdrop-blur-xl lg:px-8">
        <p className="text-sm text-muted-foreground">控制台 <span className="mx-1 text-muted-foreground/50">/</span> <span className="font-medium text-foreground">{active}</span></p>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><span className="pulse-dot mr-1.5 inline-block size-1.5 rounded-full bg-emerald-400" />{process.env.NEXT_PUBLIC_MOCK_API === "true" ? "Mock 环境" : "Production"}</Badge>
          {active !== "API 文档" && <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />刷新数据</Button>}
        </div>
      </header>

      <div className="bg-grid relative mx-auto max-w-[1440px] p-5 lg:p-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-bold tracking-tight">{active}</h1><p className="mt-1 text-sm text-muted-foreground">管理 Phira 多人房间与全局谱池</p></div>
        </div>

        {active === "总览" && <><div className="grid gap-5 md:grid-cols-3"><Stat title="活跃房间" value={`${liveRooms}`} hint={`共 ${rooms.length} 个房间`} icon={Zap} accent="blue" /><Stat title="在线玩家" value={`${totalPlayers}`} hint="实时在线人数" icon={Users} accent="teal" /><Stat title="全局谱池" value={`${pools.length}`} hint="已固化的谱面池" icon={Database} accent="cyan" /></div><OverviewSummary rooms={rooms} pools={pools} setActive={setActive} /></>}
        {showRooms && <RoomCard canWrite={canWrite} rooms={filteredRooms} query={query} setQuery={setQuery} action={action} setConfirmTarget={setConfirmTarget} setCreateTarget={setCreateTarget} />}
        {showPools && <PoolCard canWrite={canWrite} pools={pools} action={action} setConfirmTarget={setConfirmTarget} setCreateTarget={setCreateTarget} />}
        {active === "API 文档" && <ApiDocs />}
      </div>
    </main>

    <AlertDialog open={confirmTarget !== null} onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}><AlertDialogContent className="border-red-500/30"><AlertDialogHeader><AlertDialogTitle>确认删除{confirmTarget?.type === "room" ? "房间" : "谱池"}？</AlertDialogTitle><AlertDialogDescription>此操作无法撤销。删除后相关数据将从当前 Mock 服务中移除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void confirmDelete()}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={createTarget !== null} onOpenChange={(open) => { if (!open) setCreateTarget(null) }}><AlertDialogContent>{createTarget === "room" ? <><AlertDialogHeader><AlertDialogTitle>创建房间</AlertDialogTitle><AlertDialogDescription>{"创建房间并固化谱池列表，房间 ID 需匹配 ^[A-Za-z0-9_-]{1,20}$。"}</AlertDialogDescription></AlertDialogHeader><form onSubmit={createRoom} className="flex flex-col gap-4"><label className="flex flex-col gap-1 text-xs font-medium">房间 ID<Input autoFocus required pattern="[A-Za-z0-9_-]{1,20}" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="例如 tournament-01" /></label><label className="flex flex-col gap-1 text-xs font-medium">固化谱池 ID（逗号分隔）<Input required value={roomPools} onChange={(event) => setRoomPools(event.target.value)} placeholder="0,1" /></label><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><Button type="submit" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"><Plus className="size-4" />创建房间</Button></AlertDialogFooter></form></> : <><AlertDialogHeader><AlertDialogTitle>新增谱池</AlertDialogTitle><AlertDialogDescription>新增全局谱池并设置包含的谱面 ID。</AlertDialogDescription></AlertDialogHeader><form onSubmit={createPool} className="flex flex-col gap-4"><label className="flex flex-col gap-1 text-xs font-medium">池 ID<Input autoFocus required type="number" value={poolId} onChange={(event) => setPoolId(event.target.value)} placeholder="3" /></label><label className="flex flex-col gap-1 text-xs font-medium">谱面 ID（逗号分隔）<Input required value={chartIds} onChange={(event) => setChartIds(event.target.value)} placeholder="4001,4002" /></label><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><Button type="submit" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"><Plus className="size-4" />新增谱池</Button></AlertDialogFooter></form></>}</AlertDialogContent></AlertDialog>
  </div>
}

function LoginView({ email, password, setEmail, setPassword, login, loading }: { email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; login: (event: React.FormEvent) => void; loading: boolean }) {
  return <main className="bg-grid relative flex min-h-screen items-center justify-center p-5"><div className="absolute inset-x-0 top-0 h-px glow-line" /><div className="rise w-full max-w-md"><div className="mb-6 text-center"><div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-xl shadow-blue-500/30"><Boxes className="size-7" /></div><h1 className="text-2xl font-bold tracking-tight text-gradient">Zenith Console</h1><p className="mt-1 text-sm text-muted-foreground">JPhira 多人房间与谱池管理后台</p></div><Card className="glass border-blue-500/20 shadow-2xl shadow-blue-500/10"><CardHeader><CardTitle className="text-lg">登录账号</CardTitle></CardHeader><CardContent><form autoComplete="off" onSubmit={login} className="flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">邮箱<div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input required autoComplete="off" type="email" className="border-blue-500/20 bg-card/60 pl-11 focus-visible:ring-blue-500/40" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="请输入邮箱" /></div></label><label className="flex flex-col gap-2 text-sm font-medium">密码<div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input required autoComplete="new-password" type="password" className="border-blue-500/20 bg-card/60 pl-11 focus-visible:ring-blue-500/40" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" /></div></label><Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">{loading ? <RefreshCw className="size-4 animate-spin" /> : <LogIn className="size-4" />}{loading ? "登录中..." : "登录"}</Button></form></CardContent></Card><p className="mt-6 text-center text-xs text-muted-foreground">服务端签发 24 小时有效期 JWT Token · 管理员可进行写操作</p></div></main>
}

function ApiDocs() {
  const roomRules = ["创建后，房间固化的谱池列表不可修改；需要变更时重新创建房间。", "没有解散房间接口；房间无人时由服务端自动销毁。", "房间状态快照包含 state、players[]、config 和 pool 状态。", "房间 ID 必须匹配 ^[A-Za-z0-9_-]{1,20}$，当前房间类型仅支持 local。", "当前池会按 interval 在固化池列表内循环；切换目标必须属于该列表。"]
  const endpoints = [{ method: "GET", path: "/api/v1/room/list", desc: "查询房间列表" }, { method: "POST", path: "/api/v1/room/{id}/create", desc: "创建房间并固化谱池" }, { method: "PUT", path: "/api/v1/room/{id}/update", desc: "更新房间配置" }, { method: "POST", path: "/api/v1/room/{id}/end", desc: "强制结束当前对局" }, { method: "GET", path: "/api/v1/pool/list", desc: "查询全局谱池" }, { method: "POST", path: "/api/v1/pool", desc: "新增全局谱池" }]
  return <div className="mt-6 flex flex-col gap-6"><div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>房间定义</CardTitle><CardDescription>来自 API 文档中的房间生命周期和配置约束。</CardDescription></CardHeader><CardContent><ul className="flex flex-col gap-3">{roomRules.map((rule) => <li key={rule} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{rule}</li>)}</ul></CardContent></Card><Card><CardHeader><CardTitle>权限与管理员</CardTitle><CardDescription>服务端签发有效期 24 小时的 JWT Bearer Token。</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><div className="rounded-lg bg-muted p-4"><p className="text-sm font-medium">登录</p><p className="mt-1 font-mono text-xs text-muted-foreground">POST /api/v1/login</p><p className="mt-2 text-sm text-muted-foreground">服务端验证 Phira 账号后返回 JWT token 和 isAdmin，后续接口不使用 Phira Token。</p></div><div className="grid gap-2 sm:grid-cols-3"><StatusCode code="401" label="JWT 无效或过期" /><StatusCode code="403" label="无管理员权限" /><StatusCode code="200" label="请求成功" /></div><p className="text-sm leading-6 text-muted-foreground">创建、删除、配置、强制结束和谱池管理等写操作仅管理员可用。</p></CardContent></Card></div><Card><CardHeader><CardTitle>接口速查</CardTitle><CardDescription>当前管理后台使用的核心接口。</CardDescription></CardHeader><CardContent><div className="grid gap-2">{endpoints.map((item) => <div key={`${item.method}-${item.path}`} className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-3"><Badge variant={item.method === "GET" ? "secondary" : "default"}>{item.method}</Badge><code className="text-xs text-foreground">{item.path}</code><span className="text-sm text-muted-foreground">{item.desc}</span></div>)}</div></CardContent></Card></div>
}

function StatusCode({ code, label }: { code: string; label: string }) { return <div className="rounded-md border p-3"><p className="font-mono text-sm font-semibold">{code}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div> }

function OverviewSummary({ rooms, pools, setActive }: { rooms: Room[]; pools: Pool[]; setActive: (value: string) => void }) {
  return <div className="mt-6 grid gap-6 xl:grid-cols-2">
    <section className="glass rise rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold">房间列表</h2><p className="text-xs text-muted-foreground">最近更新的玩家房间</p></div><Button variant="outline" size="sm" className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10" onClick={() => setActive("房间管理")}>查看全部</Button></div>
      <div className="flex flex-col gap-2.5">{rooms.slice(0, 4).map((room) => <a href={`/room/${encodeURIComponent(room.roomId)}`} key={room.roomId} className="hover-glow flex items-center justify-between rounded-xl border px-4 py-3"><div><p className="text-sm font-medium">{room.roomId}</p><p className="text-xs text-muted-foreground">谱池 {room.pool.currentPool.id} · {room.players.length} 位玩家</p></div><Badge variant={room.state === "Playing" ? "default" : "secondary"} className={room.state === "Playing" ? "bg-blue-500/15 text-blue-300" : ""}>{room.state}</Badge></a>)}{rooms.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">暂无房间</p>}</div>
    </section>
    <section className="glass rise rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold">谱池概况</h2><p className="text-xs text-muted-foreground">全局固化的谱面池</p></div><Button variant="outline" size="sm" className="border-teal-500/30 text-teal-300 hover:bg-teal-500/10" onClick={() => setActive("谱池管理")}>查看全部</Button></div>
      <div className="flex flex-col gap-2.5">{pools.map((pool) => <a href={`/pool/${pool.id}`} key={pool.id} className="hover-glow flex items-center justify-between rounded-xl border px-4 py-3"><div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-lg bg-teal-500/15 font-mono text-xs text-teal-300">{pool.id}</div><div><p className="text-sm font-medium">Pool {pool.id}</p><p className="text-xs text-muted-foreground">{pool.chartIds.length} 张谱面{pool.favoriteId === null ? "" : ` · 收藏 ${pool.favoriteId}`}</p></div></div><div className="flex gap-1">{pool.default && <Badge className="bg-teal-500/15 text-teal-300">默认</Badge>}</div></a>)}</div>
    </section>
  </div>
}

function RoomCard({ canWrite, rooms, query, setQuery, action, setConfirmTarget, setCreateTarget }: { canWrite: boolean; rooms: Room[]; query: string; setQuery: (value: string) => void; action: (work: () => Promise<unknown>, success: string) => Promise<void>; setConfirmTarget: (target: ConfirmTarget) => void; setCreateTarget: (target: "room" | "pool" | null) => void }) {
  return <section className="glass rise rounded-2xl border p-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">房间管理</h2><p className="text-xs text-muted-foreground">{canWrite ? "创建、结束、删除房间并调整运行配置。" : "当前账号为只读权限，仅可查看房间状态。"}</p></div>
      <div className="flex items-center gap-3">
        <Input placeholder="搜索房间 ID..." value={query} onChange={(event) => setQuery(event.target.value)} className="w-56 border-blue-500/20 bg-card/60 focus-visible:ring-blue-500/40" />
        <Badge variant="outline" className="border-blue-500/30 text-blue-300">{rooms.length} 个结果</Badge>
        {canWrite && <Button onClick={() => setCreateTarget("room")} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"><Plus className="size-4" />创建房间</Button>}
      </div>
    </div>
    <Table><TableHeader><TableRow className="border-b border-border/60 hover:bg-transparent"><TableHead className="text-muted-foreground">房间</TableHead><TableHead className="text-muted-foreground">状态</TableHead><TableHead className="text-muted-foreground">玩家</TableHead><TableHead className="text-muted-foreground">当前谱池</TableHead>{canWrite && <TableHead className="text-right text-muted-foreground">操作</TableHead>}</TableRow></TableHeader><TableBody>{rooms.map((room) => <TableRow key={room.roomId} className="border-b border-border/40 transition-colors hover:bg-muted/40"><TableCell><a href={`/room/${encodeURIComponent(room.roomId)}`} className="font-medium text-blue-300 hover:text-blue-200 hover:underline">{room.roomId}</a><div className="text-xs text-muted-foreground">{room.type} · 上限 {room.config.maxPlayer}</div></TableCell><TableCell><Badge variant={room.state === "Playing" ? "default" : "secondary"} className={room.state === "Playing" ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground"}><span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />{room.state}</Badge></TableCell><TableCell><div className="flex items-center gap-2 text-muted-foreground"><Users className="size-4" />{room.players.length}<span className="text-muted-foreground/60">/ {room.config.maxPlayer}</span></div></TableCell><TableCell><a href={`/pool/${room.pool.currentPool.id}`} className="font-mono text-xs text-teal-300 hover:underline">pool-{room.pool.currentPool.id}</a></TableCell>{canWrite && <TableCell><div className="flex justify-end gap-1"><Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" onClick={() => void action(() => api.endRoom(room.roomId), "房间已结束")} disabled={room.state !== "Playing"}><Square className="size-3.5" />结束</Button><Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => setConfirmTarget({ type: "room", id: room.roomId })} title="删除房间"><Trash2 className="size-3.5" /></Button></div></TableCell>}</TableRow>)}</TableBody></Table>
    {rooms.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">没有匹配的房间</p>}
  </section>
}

function PoolCard({ canWrite, pools, action, setConfirmTarget, setCreateTarget }: { canWrite: boolean; pools: Pool[]; action: (work: () => Promise<unknown>, success: string) => Promise<void>; setConfirmTarget: (target: ConfirmTarget) => void; setCreateTarget: (target: "room" | "pool" | null) => void }) {
  return <section className="glass rise rounded-2xl border p-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">谱池管理</h2><p className="text-xs text-muted-foreground">{canWrite ? "维护全局谱池、谱面和默认池标志。" : "当前账号为只读权限，仅可查看谱池配置。"}</p></div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="border-teal-500/30 text-teal-300">{pools.length} 个谱池</Badge>
        {canWrite && <Button onClick={() => setCreateTarget("pool")} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"><Plus className="size-4" />新增谱池</Button>}
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{pools.map((pool) => <div key={pool.id} className="hover-glow relative rounded-xl border bg-card/50 p-4"><a href={`/pool/${pool.id}`} className="absolute inset-0 rounded-xl" aria-label={`查看 Pool ${pool.id} 详情`} /><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-teal-500/20 font-mono text-sm text-blue-300">{pool.id}</div><div><p className="font-medium">Pool {pool.id}</p><p className="text-xs text-muted-foreground">{pool.chartIds.length} 张谱面</p></div></div><div className="flex gap-1">{pool.default && <Badge className="bg-teal-500/15 text-teal-300">默认</Badge>}{pool.favoriteId !== null && <Badge variant="outline" className="border-blue-500/30 text-blue-300">收藏 {pool.favoriteId}</Badge>}</div></div><div className="mt-3 flex flex-wrap gap-1.5">{pool.chartIds.map((chartId) => <span key={chartId} className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{chartId}</span>)}</div>{canWrite && <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3"><Button variant="ghost" size="sm" className="text-blue-300 hover:bg-blue-500/10" onClick={() => void action(() => api.setPoolDefault(pool.id, !pool.default), pool.default ? "已取消默认谱池" : "已设为默认谱池")}>{pool.default ? "取消默认" : "设为默认"}</Button><Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => setConfirmTarget({ type: "pool", id: String(pool.id) })} disabled={pool.default}><Trash2 className="size-4" /></Button></div>}</div>)}</div>
  </section>
}

const accentStyles = { blue: "from-blue-500/25 to-blue-500/5 text-blue-300", teal: "from-teal-500/25 to-teal-500/5 text-teal-300", cyan: "from-cyan-500/25 to-cyan-500/5 text-cyan-300" } as const
function Stat({ title, value, hint, icon: Icon, accent = "blue" }: { title: string; value: string; hint?: string; icon: React.ElementType; accent?: keyof typeof accentStyles }) {
  return <div className="glass rise rounded-2xl border p-5">
    <div className="flex items-start justify-between">
      <div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>
      <div className={`flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${accentStyles[accent]}`}><Icon className="size-5" /></div>
    </div>
  </div>
}
