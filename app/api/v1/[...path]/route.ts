import { NextResponse } from "next/server"

type Room = { id: string; type: string; live: boolean; locked: boolean; players: number; minPlayer: number; maxPlayer: number; currentPoolId: number; favoriteId: number | null }
type Pool = { id: number; chartIds: number[]; favoriteId: number | null; default: boolean }

// This state intentionally lives in the dev server process. Restarting `dev-mock` resets the fixture.
const rooms: Room[] = [
  { id: "lobby-main", type: "local", live: true, locked: false, players: 42, minPlayer: 1, maxPlayer: 1000, currentPoolId: 0, favoriteId: 1024 },
  { id: "night-owl", type: "local", live: false, locked: true, players: 8, minPlayer: 2, maxPlayer: 32, currentPoolId: 1, favoriteId: null },
  { id: "zenith-test", type: "local", live: true, locked: false, players: 16, minPlayer: 1, maxPlayer: 64, currentPoolId: 2, favoriteId: 2048 },
]
const pools: Pool[] = [
  { id: 0, chartIds: [1024, 1028, 1104, 1200, 1215], favoriteId: 1024, default: true },
  { id: 1, chartIds: [2048, 2050, 2077], favoriteId: null, default: false },
  { id: 2, chartIds: [3001, 3018, 3090, 3112], favoriteId: 3018, default: false },
]

type Context = { params: Promise<{ path: string[] }> }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status })
const fail = (message: string, status = 400) => json({ ok: false, message }, status)
const enabled = () => process.env.MOCK_API === "true"

async function endpoint(context: Context) { return `/${(await context.params).path.join("/")}` }
async function body(request: Request) { try { return await request.json() as Record<string, unknown> } catch { return {} } }
function room(id: string) { return rooms.find((item) => item.id === id) }
function pool(id: number) { return pools.find((item) => item.id === id) }

export async function GET(request: Request, context: Context) {
  if (!enabled()) return fail("Production API is served by the deployment origin.", 404)
  const path = await endpoint(context)
  if (path === "/room/list") return json({ ok: true, rooms })
  if (path === "/pool/list") return json({ ok: true, pools })
  const roomMatch = path.match(/^\/room\/([^/]+)\/?$/)
  const roomPoolMatch = path.match(/^\/room\/([^/]+)\/pool$/)
  if (roomPoolMatch) { const item = room(roomPoolMatch[1]); if (!item) return fail("房间不存在", 404); return json({ ok: true, pool: pool(item.currentPoolId) }) }
  if (roomMatch) { const item = room(roomMatch[1]); if (!item) return fail("房间不存在", 404); return json({ ok: true, info: item }) }
  return fail("接口不存在", 404)
}

export async function POST(request: Request, context: Context) {
  if (!enabled()) return fail("Production API is served by the deployment origin.", 404)
  const path = await endpoint(context); const data = await body(request)
  if (path === "/login") return json({ ok: true, token: "mock-token", isAdmin: true })
  const createRoom = path.match(/^\/room\/([^/]+)\/create$/)
  if (createRoom) {
    if (room(createRoom[1])) return fail("房间 ID 已存在")
    const selectedPools = Array.isArray(data.pools) ? data.pools.map(Number) : []
    if (!selectedPools.length || selectedPools.some((id) => !pool(id))) return fail("至少选择一个有效谱池")
    rooms.push({ id: createRoom[1], type: typeof data.type === "string" ? data.type : "local", live: false, locked: false, players: 0, minPlayer: 1, maxPlayer: 1000, currentPoolId: selectedPools[0], favoriteId: null })
    return json({ ok: true })
  }
  if (path === "/pool") {
    const id = Number(data.id); const chartIds = Array.isArray(data.chartIds) ? data.chartIds.map(Number).filter(Number.isFinite) : []
    if (!Number.isInteger(id) || pool(id)) return fail("池 ID 无效或已存在")
    if (!chartIds.length) return fail("谱池至少需要一张谱面")
    pools.push({ id, chartIds, favoriteId: null, default: false }); return json({ ok: true })
  }
  const end = path.match(/^\/room\/([^/]+)\/end$/)
  if (end) { const item = room(end[1]); if (!item) return fail("房间不存在", 404); item.live = false; item.players = 0; return json({ ok: true }) }
  const addChart = path.match(/^\/pool\/(\d+)\/chart$/)
  if (addChart) { const item = pool(Number(addChart[1])); const chartId = Number(data.chartId); if (!item) return fail("谱池不存在", 404); if (!Number.isInteger(chartId)) return fail("谱面 ID 无效"); if (!item.chartIds.includes(chartId)) item.chartIds.push(chartId); return json({ ok: true }) }
  return fail("接口不存在", 404)
}

export async function PUT(request: Request, context: Context) {
  if (!enabled()) return fail("Production API is served by the deployment origin.", 404)
  const path = await endpoint(context); const data = await body(request)
  const updateRoom = path.match(/^\/room\/([^/]+)\/update$/)
  if (updateRoom) {
    const item = room(updateRoom[1]); if (!item) return fail("房间不存在", 404)
    if (typeof data.live === "boolean") item.live = data.live
    if (typeof data.locked === "boolean") item.locked = data.locked
    if (Number.isInteger(data.minPlayer)) item.minPlayer = Number(data.minPlayer)
    if (Number.isInteger(data.maxPlayer)) item.maxPlayer = Number(data.maxPlayer)
    return json({ ok: true })
  }
  const switchPool = path.match(/^\/room\/([^/]+)\/pool\/switch$/)
  if (switchPool) { const item = room(switchPool[1]); const target = Number(data.poolId); if (!item || !pool(target)) return fail("房间或谱池不存在", 404); item.currentPoolId = target; return json({ ok: true }) }
  const roomFavorite = path.match(/^\/room\/([^/]+)\/pool\/favorite$/)
  if (roomFavorite) { const item = room(roomFavorite[1]); if (!item) return fail("房间不存在", 404); item.favoriteId = data.favoriteId == null ? null : Number(data.favoriteId); return json({ ok: true }) }
  const favorite = path.match(/^\/pool\/(\d+)\/favorite$/)
  if (favorite) { const item = pool(Number(favorite[1])); if (!item) return fail("谱池不存在", 404); item.favoriteId = data.favoriteId == null ? null : Number(data.favoriteId); return json({ ok: true }) }
  const defaultPool = path.match(/^\/pool\/(\d+)\/default$/)
  if (defaultPool) { const item = pool(Number(defaultPool[1])); if (!item) return fail("谱池不存在", 404); pools.forEach((candidate) => { candidate.default = false }); item.default = Boolean(data.enabled); return json({ ok: true }) }
  return fail("接口不存在", 404)
}

export async function DELETE(request: Request, context: Context) {
  if (!enabled()) return fail("Production API is served by the deployment origin.", 404)
  const path = await endpoint(context)
  const chart = path.match(/^\/pool\/(\d+)\/chart\/(\d+)$/)
  if (chart) { const item = pool(Number(chart[1])); if (!item) return fail("谱池不存在", 404); if (item.chartIds.length <= 1) return fail("不能删除谱池中的最后一张谱面"); item.chartIds = item.chartIds.filter((id) => id !== Number(chart[2])); return json({ ok: true }) }
  const roomMatch = path.match(/^\/room\/([^/]+)$/)
  if (roomMatch) { const index = rooms.findIndex((item) => item.id === roomMatch[1]); if (index < 0) return fail("房间不存在", 404); rooms.splice(index, 1); return json({ ok: true }) }
  const poolMatch = path.match(/^\/pool\/(\d+)$/)
  if (poolMatch) { const index = pools.findIndex((item) => item.id === Number(poolMatch[1])); if (index < 0) return fail("谱池不存在", 404); if (pools.length <= 1 || pools[index].default) return fail("不能删除唯一或默认谱池"); pools.splice(index, 1); return json({ ok: true }) }
  return fail("接口不存在", 404)
}
