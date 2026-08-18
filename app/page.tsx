"use client"

import { useEffect, useState } from "react"
import { Activity, Boxes, ChevronDown, CircleHelp, Database, DoorOpen, LogOut, Plus, RefreshCw, Server, ShieldCheck, Square, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { api, type Pool, type Room } from "@/lib/api"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const nav = [{ label: "总览", icon: Activity }, { label: "房间管理", icon: DoorOpen }, { label: "谱池管理", icon: Database }]
type ConfirmTarget = { type: "room" | "pool"; id: string } | null

export default function Dashboard() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [query, setQuery] = useState("")
  const [active, setActive] = useState("总览")
  const [loading, setLoading] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null)
  const [roomId, setRoomId] = useState("")
  const [roomPools, setRoomPools] = useState("0")
  const [poolId, setPoolId] = useState("")
  const [chartIds, setChartIds] = useState("")

  async function load() {
    setLoading(true)
    try {
      const [roomData, poolData] = await Promise.all([api.rooms(), api.pools()])
      setRooms(roomData.rooms)
      setPools(poolData.pools)
    } catch {
      toast.error("无法连接 API", { description: "请确认服务地址或使用 pnpm dev-mock" })
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

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
    void action(() => api.createRoom(roomId.trim(), roomPools.split(",").map(Number).filter(Number.isFinite)), "房间已创建").then(() => setRoomId(""))
  }
  function createPool(event: React.FormEvent) {
    event.preventDefault()
    void action(() => api.createPool(Number(poolId), chartIds.split(",").map(Number).filter(Number.isFinite)), "谱池已创建").then(() => { setPoolId(""); setChartIds("") })
  }

  const filteredRooms = rooms.filter((room) => room.id.toLowerCase().includes(query.toLowerCase()))
  const liveRooms = rooms.filter((room) => room.live).length
  const totalPlayers = rooms.reduce((sum, room) => sum + room.players, 0)
  const showRooms = active === "房间管理"
  const showPools = active === "谱池管理"

  return <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
    <aside className="hidden border-r bg-card lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b px-6"><div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Boxes /></div><div><p className="text-sm font-semibold">Zenith Console</p><p className="text-xs text-muted-foreground">JPhira Multiplayer</p></div></div>
      <div className="flex flex-1 flex-col gap-6 p-4"><div><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">工作区</p><nav className="flex flex-col gap-1">{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActive(label)} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active === label ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-muted"}`}><Icon />{label}</button>)}</nav></div><button onClick={() => setActive("API 文档")} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active === "API 文档" ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-muted"}`}><CircleHelp /> API 文档</button></div>
      <div className="border-t p-4"><div className="flex items-center gap-3 rounded-lg bg-muted p-3"><div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck /></div><div className="min-w-0"><p className="truncate text-sm font-medium">管理员</p><p className="truncate text-xs text-muted-foreground">admin@jphira.org</p></div><ChevronDown className="ml-auto text-muted-foreground" /></div></div>
    </aside>
    <main className="min-w-0">
      <header className="flex h-16 items-center justify-between border-b bg-card px-5 lg:px-8"><p className="text-sm text-muted-foreground">控制台 / <span className="text-foreground">{active}</span></p><div className="flex items-center gap-2"><Badge variant="outline"><span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500" />Mock 环境</Badge><Button variant="ghost" size="sm"><LogOut />退出</Button></div></header>
      <div className="mx-auto max-w-[1440px] p-5 lg:p-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">{active === "总览" ? "运行总览" : active}</h1><p className="mt-1 text-sm text-muted-foreground">{active === "API 文档" ? "接口规则、房间生命周期和管理员权限说明。" : "管理多人房间、玩家和全局谱池状态。"}</p></div>{active !== "API 文档" && <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw />刷新数据</Button>}</div>
        {active === "总览" && <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Stat title="活跃房间" value={`${liveRooms}`} hint={`共 ${rooms.length} 个已注册房间`} icon={DoorOpen} /><Stat title="在线玩家" value={`${totalPlayers}`} hint="当前房间玩家总数" icon={Users} /><Stat title="全局谱池" value={`${pools.length}`} hint="可供房间选择的谱池" icon={Database} /><Stat title="API 服务" value="正常" hint="内存 mock 服务" icon={Server} /></div><OverviewSummary rooms={rooms} pools={pools} setActive={setActive} /></>}
        {showRooms && <RoomCard rooms={filteredRooms} query={query} setQuery={setQuery} roomId={roomId} setRoomId={setRoomId} roomPools={roomPools} setRoomPools={setRoomPools} createRoom={createRoom} action={action} setConfirmTarget={setConfirmTarget} />}
        {showPools && <PoolCard pools={pools} poolId={poolId} setPoolId={setPoolId} chartIds={chartIds} setChartIds={setChartIds} createPool={createPool} action={action} setConfirmTarget={setConfirmTarget} />}
        {active === "API 文档" && <ApiDocs />}
      </div>
    </main>
    <AlertDialog open={confirmTarget !== null} onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认删除{confirmTarget?.type === "room" ? "房间" : "谱池"}？</AlertDialogTitle><AlertDialogDescription>此操作无法撤销。删除后相关数据将从当前 Mock 服务中移除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void confirmDelete()}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}

function ApiDocs() {
  const roomRules = ["创建后，房间固化的谱池列表不可修改；需要变更时重新创建房间。", "没有解散房间接口；房间无人时由服务端自动销毁。", "房间 ID 必须匹配 ^[A-Za-z0-9_-]{1,20}$，当前房间类型仅支持 local。", "默认玩家上限为 1000，minPlayer、maxPlayer、倒计时和刷新间隔可按房间调整。", "当前池会按 interval 在固化池列表内循环；切换目标必须属于该列表。"]
  const endpoints = [{ method: "GET", path: "/api/v1/room/list", desc: "查询房间列表" }, { method: "POST", path: "/api/v1/room/{id}/create", desc: "创建房间并固化谱池" }, { method: "PUT", path: "/api/v1/room/{id}/update", desc: "更新房间配置" }, { method: "POST", path: "/api/v1/room/{id}/end", desc: "强制结束当前对局" }, { method: "GET", path: "/api/v1/pool/list", desc: "查询全局谱池" }, { method: "POST", path: "/api/v1/pool", desc: "新增全局谱池" }]
  return <div className="mt-6 flex flex-col gap-6"><div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>房间定义</CardTitle><CardDescription>来自 API 文档中的房间生命周期和配置约束。</CardDescription></CardHeader><CardContent><ul className="flex flex-col gap-3">{roomRules.map((rule) => <li key={rule} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{rule}</li>)}</ul></CardContent></Card><Card><CardHeader><CardTitle>权限与管理员</CardTitle><CardDescription>所有 API 请求都遵循 Bearer Token 权限模型。</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><div className="rounded-lg bg-muted p-4"><p className="text-sm font-medium">登录</p><p className="mt-1 font-mono text-xs text-muted-foreground">POST /api/v1/login</p><p className="mt-2 text-sm text-muted-foreground">玩家与管理员均使用 Phira 账号登录，响应包含 token 和 isAdmin。</p></div><div className="grid gap-2 sm:grid-cols-3"><StatusCode code="401" label="未登录" /><StatusCode code="403" label="无管理员权限" /><StatusCode code="200" label="请求成功" /></div><p className="text-sm leading-6 text-muted-foreground">管理员名单由服务端独立配置。创建、删除、配置、强制结束和谱池管理等写操作仅管理员可用。</p></CardContent></Card></div><Card><CardHeader><CardTitle>接口速查</CardTitle><CardDescription>当前管理后台使用的核心接口。</CardDescription></CardHeader><CardContent><div className="grid gap-2">{endpoints.map((item) => <div key={`${item.method}-${item.path}`} className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-3"><Badge variant={item.method === "GET" ? "secondary" : "default"}>{item.method}</Badge><code className="text-xs text-foreground">{item.path}</code><span className="text-sm text-muted-foreground">{item.desc}</span></div>)}</div></CardContent></Card></div>
}

function StatusCode({ code, label }: { code: string; label: string }) { return <div className="rounded-md border p-3"><p className="font-mono text-sm font-semibold">{code}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div> }

function OverviewSummary({ rooms, pools, setActive }: { rooms: Room[]; pools: Pool[]; setActive: (value: string) => void }) {
  return <div className="mt-6 grid gap-6 xl:grid-cols-2">
    <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>房间活动</CardTitle><CardDescription>当前房间的运行快照。</CardDescription></div><Button variant="outline" size="sm" onClick={() => setActive("房间管理")}>查看房间</Button></CardHeader><CardContent className="flex flex-col gap-3">{rooms.slice(0, 4).map((room) => <div key={room.id} className="flex items-center justify-between rounded-lg border px-4 py-3"><div><p className="text-sm font-medium">{room.id}</p><p className="text-xs text-muted-foreground">pool-{room.currentPoolId} · {room.players} 位玩家</p></div><Badge variant={room.live ? "default" : "secondary"}>{room.live ? "运行中" : "空闲"}</Badge></div>)}{rooms.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">暂无房间</p>}</CardContent></Card>
    <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>谱池概况</CardTitle><CardDescription>全局谱池与默认配置。</CardDescription></div><Button variant="outline" size="sm" onClick={() => setActive("谱池管理")}>查看谱池</Button></CardHeader><CardContent className="flex flex-col gap-3">{pools.map((pool) => <div key={pool.id} className="flex items-center justify-between rounded-lg border px-4 py-3"><div><p className="text-sm font-medium">Pool {pool.id}</p><p className="text-xs text-muted-foreground">{pool.chartIds.length} 张谱面{pool.favoriteId === null ? "" : ` · 收藏 ${pool.favoriteId}`}</p></div><div className="flex gap-1">{pool.default && <Badge>默认</Badge>}{!pool.default && <Badge variant="outline">普通</Badge>}</div></div>)}</CardContent></Card>
  </div>
}

function RoomCard({ rooms, query, setQuery, roomId, setRoomId, roomPools, setRoomPools, createRoom, action, setConfirmTarget }: { rooms: Room[]; query: string; setQuery: (value: string) => void; roomId: string; setRoomId: (value: string) => void; roomPools: string; setRoomPools: (value: string) => void; createRoom: (event: React.FormEvent) => void; action: (work: () => Promise<unknown>, success: string) => Promise<void>; setConfirmTarget: (target: ConfirmTarget) => void }) {
  return <Card className="mt-6"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>房间管理</CardTitle><CardDescription>创建、结束、删除房间并调整运行配置。</CardDescription></div><Badge variant="outline">{rooms.length} 个结果</Badge></CardHeader><CardContent><form onSubmit={createRoom} className="mb-5 flex flex-wrap items-end gap-3 rounded-lg bg-muted/50 p-4"><label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium">房间 ID<Input required pattern="[A-Za-z0-9_-]{1,20}" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="例如 tournament-01" /></label><label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium">固化谱池 ID（逗号分隔）<Input required value={roomPools} onChange={(event) => setRoomPools(event.target.value)} placeholder="0,1" /></label><Button type="submit"><Plus />创建房间</Button></form><Input placeholder="搜索房间 ID..." value={query} onChange={(event) => setQuery(event.target.value)} className="mb-4 max-w-xs" /><Table><TableHeader><TableRow><TableHead>房间</TableHead><TableHead>状态</TableHead><TableHead>玩家</TableHead><TableHead>当前谱池</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{rooms.map((room) => <TableRow key={room.id}><TableCell><div className="font-medium">{room.id}</div><div className="text-xs text-muted-foreground">{room.type} · 上限 {room.maxPlayer}</div></TableCell><TableCell><Badge variant={room.live ? "default" : "secondary"}><span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />{room.live ? "运行中" : "空闲"}</Badge></TableCell><TableCell><div className="flex items-center gap-2"><Users className="text-muted-foreground" />{room.players}<span className="text-muted-foreground">/ {room.maxPlayer}</span></div></TableCell><TableCell><span className="font-mono text-xs">pool-{room.currentPoolId}</span></TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => void action(() => api.endRoom(room.id), "房间已结束")} disabled={!room.live}><Square />结束</Button><Button variant="ghost" size="sm" onClick={() => setConfirmTarget({ type: "room", id: room.id })} title="删除房间"><Trash2 /></Button></div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
}

function PoolCard({ pools, poolId, setPoolId, chartIds, setChartIds, createPool, action, setConfirmTarget }: { pools: Pool[]; poolId: string; setPoolId: (value: string) => void; chartIds: string; setChartIds: (value: string) => void; createPool: (event: React.FormEvent) => void; action: (work: () => Promise<unknown>, success: string) => Promise<void>; setConfirmTarget: (target: ConfirmTarget) => void }) {
  return <Card className="mt-6"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>谱池管理</CardTitle><CardDescription>维护全局谱池、谱面和默认池标志。</CardDescription></div><Badge variant="outline">{pools.length} 个谱池</Badge></CardHeader><CardContent><form onSubmit={createPool} className="mb-5 flex flex-wrap items-end gap-3 rounded-lg bg-muted/50 p-4"><label className="flex w-28 flex-col gap-1 text-xs font-medium">池 ID<Input required type="number" value={poolId} onChange={(event) => setPoolId(event.target.value)} placeholder="3" /></label><label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium">谱面 ID（逗号分隔）<Input required value={chartIds} onChange={(event) => setChartIds(event.target.value)} placeholder="4001,4002" /></label><Button type="submit"><Plus />新增谱池</Button></form><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{pools.map((pool) => <div key={pool.id} className="rounded-lg border p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-md bg-secondary font-mono text-xs">{pool.id}</div><div><p className="font-medium">Pool {pool.id}</p><p className="text-xs text-muted-foreground">{pool.chartIds.length} 张谱面</p></div></div><div className="flex gap-1">{pool.default && <Badge>默认</Badge>}{pool.favoriteId !== null && <Badge variant="outline">收藏 {pool.favoriteId}</Badge>}</div></div><div className="mt-3 flex flex-wrap gap-1">{pool.chartIds.map((chartId) => <Badge key={chartId} variant="outline">{chartId}</Badge>)}</div><div className="mt-4 flex items-center justify-between gap-2 border-t pt-3"><Button variant="ghost" size="sm" onClick={() => void action(() => api.setPoolDefault(pool.id, !pool.default), pool.default ? "已取消默认谱池" : "已设为默认谱池")}>{pool.default ? "取消默认" : "设为默认"}</Button><Button variant="ghost" size="sm" onClick={() => setConfirmTarget({ type: "pool", id: String(pool.id) })} disabled={pool.default}><Trash2 /></Button></div></div>)}</div></CardContent></Card>
}

function Stat({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: React.ElementType }) { return <Card><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div><div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon /></div></CardContent></Card> }
