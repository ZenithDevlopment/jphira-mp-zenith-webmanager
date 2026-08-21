"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Activity, Boxes, ChevronsUpDown, CircleHelp, Database, DoorOpen, Loader2, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, RefreshCw, ShieldCheck, Square, Trash2, Users, Zap } from "lucide-react"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { api, type Pool, type Room } from "@/lib/api"
import { cn } from "@/lib/utils"
import RoomClient from "@/app/room/[id]/RoomClient"
import PoolClient from "@/app/pool/[id]/PoolClient"

const nav = [
  { label: "总览", icon: Activity },
  { label: "房间管理", icon: DoorOpen },
  { label: "谱池管理", icon: Database },
]
type ConfirmTarget = { type: "room" | "pool"; id: string } | null
type Session = { token: string; isAdmin: boolean; email: string; userId?: number }
type PhiraUser = {
  id: number
  name: string
  avatar: string
  bio?: string
  rks?: number
  follower_count?: number
  following_count?: number
  badges?: string[]
  badgeNames?: Record<string, string>
}

const PHIRA_API_BASE = "https://phira.5wyxi.com"

async function fetchPhiraUser(userId: number): Promise<PhiraUser | null> {
  try {
    const response = await fetch(`${PHIRA_API_BASE}/user/${userId}`)
    if (!response.ok) return null
    return await response.json() as PhiraUser
  } catch { return null }
}

export default function Dashboard() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [query, setQuery] = useState("")
  const [active, setActive] = useState("总览")
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<PhiraUser | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null)
  const [createTarget, setCreateTarget] = useState<"room" | "pool" | null>(null)
  const [roomId, setRoomId] = useState("")
  const [roomPools, setRoomPools] = useState("0")
  const [poolId, setPoolId] = useState("")
  const [chartIds, setChartIds] = useState("")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
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
    if (current?.token) {
      void load()
      if (current.userId) void fetchPhiraUser(current.userId).then(setProfile)
    } else setLoading(false)
  }, [])

  const route = pathname.match(/^\/(room|pool)\/([^/]+)\/?$/)
  if (route) return route[1] === "room" ? <RoomClient id={decodeURIComponent(route[2])} /> : <PoolClient id={decodeURIComponent(route[2])} />

  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoggingIn(true)
    try { const result = await api.login(email, password); const nextSession = { token: result.token, isAdmin: result.isAdmin, email, userId: result.userId }; window.localStorage.setItem("zenith-token", result.token); window.localStorage.setItem("zenith-session", JSON.stringify(nextSession)); setSession(nextSession); if (result.userId) void fetchPhiraUser(result.userId).then(setProfile); toast.success("登录成功", { description: result.isAdmin ? "管理员权限已启用" : "当前为只读权限" }); await load() }
    catch (reason) { toast.error("登录失败", { description: reason instanceof Error ? reason.message : "请检查账号和密码" }) }
    finally { setLoggingIn(false) }
  }
  function logout() { window.localStorage.removeItem("zenith-token"); window.localStorage.removeItem("zenith-session"); setSession(null); setProfile(null); toast.success("已退出登录") }

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

  if (session === undefined) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
  if (!session) return <LoginView email={email} password={password} setEmail={setEmail} setPassword={setPassword} login={login} loading={loggingIn} />
  const canWrite = session.isAdmin

  return (
    <div className={cn("min-h-screen lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out", sidebarCollapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[240px_1fr]")}>
      {/* 桌面侧边栏 */}
      <aside className={cn("sticky top-0 z-40 hidden h-screen flex-col border-r bg-card lg:flex lg:transition-[width] lg:duration-300 lg:ease-in-out", sidebarCollapsed ? "lg:w-[64px]" : "lg:w-[240px]")}>
        <Sidebar session={session} profile={profile} active={active} setActive={setActive} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} logout={logout} />
      </aside>

      {/* 移动端侧边栏（Sheet） */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" overlayClassName="mobile-sidebar-overlay" className="mobile-sidebar-content w-[280px] gap-0 p-0">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <Sidebar session={session} profile={profile} active={active} setActive={setActive} collapsed={false} logout={logout} onNavigate={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground lg:hidden" onClick={() => setMobileSidebarOpen(true)} aria-label="打开侧边栏"><Menu className="size-5" /></Button>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink onClick={() => setActive("总览")} className="cursor-pointer text-muted-foreground">控制台</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>{active}</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", isMockApi ? "bg-amber-500" : "bg-emerald-500")} />
              {isMockApi ? "Mock 环境" : "Production"}
            </Badge>
            {active !== "API 文档" && <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={cn("size-3.5", loading && "animate-spin")} />刷新</Button>}
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-5 lg:p-8">
          {active === "总览" && <Overview rooms={rooms} pools={pools} liveRooms={liveRooms} totalPlayers={totalPlayers} setActive={setActive} />}
          {showRooms && <RoomCard canWrite={canWrite} rooms={filteredRooms} query={query} setQuery={setQuery} action={action} setConfirmTarget={setConfirmTarget} setCreateTarget={setCreateTarget} />}
          {showPools && <PoolCard canWrite={canWrite} pools={pools} action={action} setConfirmTarget={setConfirmTarget} setCreateTarget={setCreateTarget} />}
          {active === "API 文档" && <ApiDocs />}
        </div>
      </main>

      {/* 删除确认 */}
      <AlertDialog open={confirmTarget !== null} onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除{confirmTarget?.type === "room" ? "房间" : "谱池"}？</AlertDialogTitle>
            <AlertDialogDescription>此操作无法撤销。删除后相关数据将从当前 Mock 服务中移除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void confirmDelete()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 创建房间/谱池 */}
      <AlertDialog open={createTarget !== null} onOpenChange={(open) => { if (!open) setCreateTarget(null) }}>
        <AlertDialogContent>
          {createTarget === "room" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>创建房间</AlertDialogTitle>
                <AlertDialogDescription>{"创建房间并固化谱池列表，房间 ID 需匹配 ^[A-Za-z0-9_-]{1,20}$。"}</AlertDialogDescription>
              </AlertDialogHeader>
              <form onSubmit={createRoom} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-room-id">房间 ID</Label>
                  <Input id="create-room-id" autoFocus required pattern="[A-Za-z0-9_-]{1,20}" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="例如 tournament-01" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-room-pools">固化谱池 ID（逗号分隔）</Label>
                  <Input id="create-room-pools" required value={roomPools} onChange={(event) => setRoomPools(event.target.value)} placeholder="0,1" />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <Button type="submit"><Plus className="size-4" />创建房间</Button>
                </AlertDialogFooter>
              </form>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>新增谱池</AlertDialogTitle>
                <AlertDialogDescription>新增全局谱池并设置包含的谱面 ID。</AlertDialogDescription>
              </AlertDialogHeader>
              <form onSubmit={createPool} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-pool-id">池 ID</Label>
                  <Input id="create-pool-id" autoFocus required type="number" value={poolId} onChange={(event) => setPoolId(event.target.value)} placeholder="3" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-pool-charts">谱面 ID（逗号分隔）</Label>
                  <Input id="create-pool-charts" required value={chartIds} onChange={(event) => setChartIds(event.target.value)} placeholder="4001,4002" />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <Button type="submit"><Plus className="size-4" />新增谱池</Button>
                </AlertDialogFooter>
              </form>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function UserMenu({ session, profile, logout, collapsed = false }: { session: Session; profile: PhiraUser | null; logout: () => void; collapsed?: boolean }) {
  const displayName = profile?.name || (session.isAdmin ? "管理员" : "只读用户")
  const avatarUrl = profile?.avatar
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground hover:text-foreground" aria-label="用户菜单">
          <Avatar className="size-7 shrink-0">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} className="size-7" /> : null}
            <AvatarFallback className="size-7 text-[11px]">
              {session.isAdmin ? <ShieldCheck className="size-4" /> : <Users className="size-4" />}
            </AvatarFallback>
          </Avatar>
          <span className={cn("flex min-w-0 flex-col items-start overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-in-out", collapsed ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[10rem] opacity-100 translate-x-0")}>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium">{displayName}</span>
              {session.isAdmin && <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px] font-medium text-primary">管理</Badge>}
            </span>
            <span className="truncate text-xs text-muted-foreground">{session.email}</span>
          </span>
          <ChevronsUpDown className={cn("ml-auto size-4 shrink-0 transition-opacity duration-300", collapsed ? "opacity-0" : "opacity-100")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "start" : "end"} className="w-56">
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="size-4" />退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Sidebar({ session, profile, active, setActive, collapsed, onToggle, logout, onNavigate }: { session: Session; profile: PhiraUser | null; active: string; setActive: (value: string) => void; collapsed: boolean; onToggle?: () => void; logout: () => void; onNavigate?: () => void }) {
  const handleNav = (label: string) => { setActive(label); onNavigate?.() }
  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Boxes className="size-4" /></div>
        <div className={cn("min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-in-out", collapsed ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[10rem] opacity-100 translate-x-0")}>
          <p className="truncate text-sm font-semibold">Zenith</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">JPhira Console</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <nav className="flex flex-col gap-0.5">
          {nav.map(({ label, icon: Icon }) => <NavButton key={label} label={label} Icon={Icon} active={active} collapsed={collapsed} onClick={() => handleNav(label)} />)}
          <NavButton label="API 文档" Icon={CircleHelp} active={active} collapsed={collapsed} onClick={() => handleNav("API 文档")} />
        </nav>
      </div>

      <div className="flex flex-col gap-1 p-2">
        {onToggle ? (
          <Button variant="ghost" size="sm" className="justify-start gap-2.5 px-2.5 text-muted-foreground hover:text-foreground" onClick={onToggle} aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}>
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
            <span className={cn("overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-in-out", collapsed ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[10rem] opacity-100 translate-x-0")}>收起侧边栏</span>
          </Button>
        ) : null}
      </div>
      <div className="border-t p-2">
        <UserMenu session={session} profile={profile} logout={logout} collapsed={collapsed} />
      </div>
    </div>
  )
}

function NavButton({ label, Icon, active, collapsed, onClick }: { label: string; Icon: React.ElementType; active: string; collapsed: boolean; onClick: () => void }) {
  const isActive = active === label
  return (
    <button onClick={onClick} title={collapsed ? label : undefined} className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors", isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
      <Icon className={cn("size-4 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} />
      <span className={cn("overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-in-out", collapsed ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[10rem] opacity-100 translate-x-0")}>{label}</span>
    </button>
  )
}

function LoginView({ email, password, setEmail, setPassword, login, loading }: { email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; login: (event: React.FormEvent) => void; loading: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground"><Boxes className="size-5" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Zenith 控制台</h1>
          <p className="mt-1 text-sm text-muted-foreground">JPhira 多人房间与谱池管理后台</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">登录账号</CardTitle>
            <CardDescription>使用 Phira 账号登录管理后台</CardDescription>
          </CardHeader>
          <CardContent>
            <form autoComplete="off" onSubmit={login} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-email">邮箱</Label>
                <Input id="login-email" required autoComplete="off" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="请输入邮箱" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-password">密码</Label>
                <Input id="login-password" required autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "登录中..." : "登录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Overview({ rooms, pools, liveRooms, totalPlayers, setActive }: { rooms: Room[]; pools: Pool[]; liveRooms: number; totalPlayers: number; setActive: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="总览" description="管理 Phira 多人房间与全局谱池" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="活跃房间" value={`${liveRooms}`} hint={`共 ${rooms.length} 个房间`} icon={Zap} />
        <StatCard title="在线玩家" value={`${totalPlayers}`} hint="实时在线人数" icon={Users} />
        <StatCard title="全局谱池" value={`${pools.length}`} hint="已固化的谱面池" icon={Database} />
      </div>
      <OverviewSummary rooms={rooms} pools={pools} setActive={setActive} />
    </div>
  )
}

const StatCard = ({ title, value, hint, icon: Icon }: { title: string; value: string; hint?: string; icon: React.ElementType }) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-4">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </CardContent>
    {/* 右下角背景图标：露一半出来 + 透明效果 */}
    <Icon className="pointer-events-none absolute -bottom-6 -right-6 size-24 text-primary/15" strokeWidth={1.5} />
  </Card>
)

function OverviewSummary({ rooms, pools, setActive }: { rooms: Room[]; pools: Pool[]; setActive: (value: string) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>房间列表</CardTitle>
            <CardDescription>最近更新的玩家房间</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setActive("房间管理")}>查看全部</Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {rooms.slice(0, 4).map((room) => (
              <a href={`/room/${encodeURIComponent(room.roomId)}`} key={room.roomId} className="flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{room.roomId}</p>
                  <p className="text-xs text-muted-foreground">谱池 {room.pool.currentPool.id} · {room.players.length} 位玩家</p>
                </div>
                <StateBadge state={room.state} />
              </a>
            ))}
            {rooms.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">暂无房间</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>谱池概况</CardTitle>
            <CardDescription>全局固化的谱面池</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setActive("谱池管理")}>查看全部</Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {pools.map((pool) => (
              <a href={`/pool/${pool.id}`} key={pool.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Pool {pool.id}</p>
                  <p className="text-xs text-muted-foreground">{pool.chartIds.length} 张谱面{pool.favoriteId === null ? "" : ` · 收藏 ${pool.favoriteId}`}</p>
                </div>
                {pool.default && <Badge>默认</Badge>}
              </a>
            ))}
            {pools.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">暂无谱池</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StateBadge({ state }: { state: Room["state"] }) {
  return (
    <Badge variant={state === "Playing" ? "default" : "secondary"} className="gap-1.5">
      <span className={cn("size-1.5 rounded-full", state === "Playing" ? "bg-primary-foreground" : "bg-muted-foreground")} />
      {state}
    </Badge>
  )
}

function RoomCard({ canWrite, rooms, query, setQuery, action, setConfirmTarget, setCreateTarget }: { canWrite: boolean; rooms: Room[]; query: string; setQuery: (value: string) => void; action: (work: () => Promise<unknown>, success: string) => Promise<void>; setConfirmTarget: (target: ConfirmTarget) => void; setCreateTarget: (target: "room" | "pool" | null) => void }) {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <PageHeader title="房间管理" description={canWrite ? "创建、结束、删除房间并调整运行配置。" : "当前账号为只读权限，仅可查看房间状态。"}>
          <div className="flex items-center gap-2">
            <Input placeholder="搜索房间 ID..." value={query} onChange={(event) => setQuery(event.target.value)} className="w-56" />
            <Button onClick={() => setCreateTarget("room")} disabled={!canWrite}><Plus className="size-4" />创建房间</Button>
          </div>
        </PageHeader>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>房间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>玩家</TableHead>
                  <TableHead>当前谱池</TableHead>
                  {canWrite && <TableHead className="text-right">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.roomId}>
                    <TableCell>
                      <a href={`/room/${encodeURIComponent(room.roomId)}`} className="font-medium hover:underline">{room.roomId}</a>
                      <div className="text-xs text-muted-foreground">{room.type} · 上限 {room.config.maxPlayer}</div>
                    </TableCell>
                    <TableCell><StateBadge state={room.state} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="size-4" />
                        {room.players.length}
                        <span className="text-muted-foreground/60">/ {room.config.maxPlayer}</span>
                      </div>
                    </TableCell>
                    <TableCell><a href={`/pool/${room.pool.currentPool.id}`} className="font-mono text-xs hover:underline">pool-{room.pool.currentPool.id}</a></TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => void action(() => api.endRoom(room.roomId), "房间已结束")} disabled={room.state !== "Playing"}><Square className="size-4" /></Button>
                            </TooltipTrigger>
                            <TooltipContent>结束对局</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setConfirmTarget({ type: "room", id: room.roomId })}><Trash2 className="size-4" /></Button>
                            </TooltipTrigger>
                            <TooltipContent>删除房间</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {rooms.length === 0 && (
                  <TableRow><TableCell colSpan={canWrite ? 5 : 4} className="py-10 text-center text-muted-foreground">没有匹配的房间</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

function PoolCard({ canWrite, pools, action, setConfirmTarget, setCreateTarget }: { canWrite: boolean; pools: Pool[]; action: (work: () => Promise<unknown>, success: string) => Promise<void>; setConfirmTarget: (target: ConfirmTarget) => void; setCreateTarget: (target: "room" | "pool" | null) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="谱池管理" description={canWrite ? "维护全局谱池、谱面和默认池标志。" : "当前账号为只读权限，仅可查看谱池配置。"}>
        <Button onClick={() => setCreateTarget("pool")} disabled={!canWrite}><Plus className="size-4" />新增谱池</Button>
      </PageHeader>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>池 ID</TableHead>
                <TableHead>谱面</TableHead>
                <TableHead>状态</TableHead>
                {canWrite && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((pool) => (
                <TableRow key={pool.id}>
                  <TableCell>
                    <a href={`/pool/${pool.id}`} className="font-mono text-sm font-medium hover:underline">Pool {pool.id}</a>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-md flex-wrap gap-1">
                      {pool.chartIds.slice(0, 8).map((chartId) => (
                        <span key={chartId} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{chartId}</span>
                      ))}
                      {pool.chartIds.length > 8 && <span className="text-[11px] text-muted-foreground">+{pool.chartIds.length - 8}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {pool.default && <Badge>默认</Badge>}
                      {pool.favoriteId !== null && <Badge variant="outline">收藏 {pool.favoriteId}</Badge>}
                    </div>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => void action(() => api.setPoolDefault(pool.id, !pool.default), pool.default ? "已取消默认谱池" : "已设为默认谱池")}>{pool.default ? "取消默认" : "设为默认"}</Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setConfirmTarget({ type: "pool", id: String(pool.id) })} disabled={pool.default}><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function ApiDocs() {
  const roomRules = ["创建后，房间固化的谱池列表不可修改；需要变更时重新创建房间。", "没有解散房间接口；房间无人时由服务端自动销毁。", "房间状态快照包含 state、players[]、config 和 pool 状态。", "房间 ID 必须匹配 ^[A-Za-z0-9_-]{1,20}$，当前房间类型仅支持 local。", "当前池会按 interval 在固化池列表内循环；切换目标必须属于该列表。"]
  const endpoints = [{ method: "GET", path: "/api/v1/room/list", desc: "查询房间列表" }, { method: "POST", path: "/api/v1/room/{id}/create", desc: "创建房间并固化谱池" }, { method: "PUT", path: "/api/v1/room/{id}/update", desc: "更新房间配置" }, { method: "POST", path: "/api/v1/room/{id}/end", desc: "强制结束当前对局" }, { method: "GET", path: "/api/v1/pool/list", desc: "查询全局谱池" }, { method: "POST", path: "/api/v1/pool", desc: "新增全局谱池" }]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="API 文档" description="管理后台使用的接口与权限说明" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>房间定义</CardTitle>
            <CardDescription>来自 API 文档中的房间生命周期和配置约束。</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {roomRules.map((rule) => (
                <li key={rule} className="flex gap-3 text-sm leading-6">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  {rule}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>权限与管理员</CardTitle>
            <CardDescription>服务端签发有效期 24 小时的 JWT Bearer Token。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-medium">登录</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">POST /api/v1/login</p>
              <p className="mt-2 text-sm text-muted-foreground">服务端验证 Phira 账号后返回 JWT token 和 isAdmin，后续接口不使用 Phira Token。</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <StatusCode code="401" label="JWT 无效或过期" />
              <StatusCode code="403" label="无管理员权限" />
              <StatusCode code="200" label="请求成功" />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">创建、删除、配置、强制结束和谱池管理等写操作仅管理员可用。</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>接口速查</CardTitle>
          <CardDescription>当前管理后台使用的核心接口。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {endpoints.map((item) => (
              <div key={`${item.method}-${item.path}`} className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-3">
                <Badge variant={item.method === "GET" ? "secondary" : "default"}>{item.method}</Badge>
                <code className="text-xs">{item.path}</code>
                <span className="text-sm text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusCode({ code, label }: { code: string; label: string }) {
  return <div className="rounded-md border p-3"><p className="font-mono text-sm font-semibold">{code}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
}
