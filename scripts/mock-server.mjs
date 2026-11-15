import { createServer } from "node:http"
import { request as proxyRequest } from "node:http"
import { connect } from "node:net"
import { readFile, stat } from "node:fs/promises"
import { extname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const output = join(root, "out")
const port = Number(process.env.PORT || 8080)
const nextPort = Number(process.env.DEV_NEXT_PORT || 0)
const tokens = new Map()
// 从 https://phira.5wyxi.com/staff 提取的成员 id（硬编码部分，用于 lobby-main 房间的在线玩家）
const staff = [712, 2, 69, 62495, 134153, 2368, 471275, 1727, 383, 349, 2164, 29050, 32162, 1178, 7134, 2596, 1725410, 5942, 407, 1785150, 1558, 81, 420417, 19781, 54664, 407551, 702870, 638889, 288403, 3339, 18164, 407560, 51815, 10351, 731, 47650, 12663, 9863, 1047456, 30532, 13369, 508559]
const pools = [
  { id: 0, chartIds: [74673, 74615, 74166, 74086, 74665], favoriteId: 1024, default: true, category: "MANUAL", sizeLimit: null, roundsPerStay: null, order: 10 },
  { id: 1, chartIds: [2048, 2050, 2077], favoriteId: null, default: false, category: "REGULAR", sizeLimit: 15, roundsPerStay: 3, order: 20 },
  { id: 2, chartIds: [3001, 3018, 3090, 3112], favoriteId: 3018, default: false, category: "CONFIGURED", sizeLimit: 15, roundsPerStay: 3, order: 30 },
]
// 管理员名单，与真实服务端的 data/admins.json 对应
const admins = [2]
const MAX_POOLS = 200
let nextPoolId = 3
let nextAdminId = 100
// 假的谱面索引，够把筛选与生成流程跑通
const makeChart = (index) => {
  const id = 5000 + index
  const configured = index % 3 === 0
  return {
    id,
    name: `Mock Chart ${id}`,
    level: `AT Lv.${15 + (index % 6)}`,
    difficulty: 15 + (index % 6),
    rating: 0.86 + (index % 10) / 100,
    ratingCount: 8 + (index % 40),
    // 只有每 10 首超过 6 分钟，方便观察 TB 过滤
    durationSeconds: index % 10 === 0 ? 380 + index : 90 + index,
    tags: configured ? ["plain"] : ["regular"],
  }
}
const indexedCharts = Array.from({ length: 120 }, (_, index) => makeChart(index))
const missedCharts = Array.from({ length: 24 }, (_, index) => makeChart(120 + index))
let refreshUntil = 0
let fullSweepPending = false
const rooms = [room("lobby-main", true, 42, 1000, 0, [0, 1, 2], "Playing", staff), room("night-owl", false, 8, 32, 1, [1, 2], "WaitForReady", null, 2), room("zenith-test", true, 16, 64, 2, [2], "SelectChart", null, null, [2])]

// 玩家在游戏里创建的房间：最后一个成员离开（或被清空）时由服务端销毁；面板 / 控制台创建的房间会保留为空房
const gameCreatedRooms = new WeakSet([findRoom("night-owl")])

function room(id, live, players, maxPlayer, currentPoolId, poolIds, state = "WaitForReady", playerIds = null, host = null, adminIds = []) { return { roomId: id, state, live, locked: false, cycle: true, host, players: playerIds ? playerIds.map((pid) => ({ id: pid })) : Array.from({ length: players }, (_, index) => ({ id: index + 1 })), monitors: [], chart: null, type: "local", config: { minPlayer: 1, maxPlayer, selectCountdown: 30, readyCountdown: 10, forceFinish: 60, interval: 1, adminIds, chatEnable: true, cancelReadyInVote: true, startWhenAllReady: true, allReadyDelay: 5 }, pool: { currentPool: pool(currentPoolId), pools: poolIds.map(pool).filter(Boolean), pendingPoolId: null, favoriteId: null, finishedRoundsSinceRefresh: 0, refreshIntervalRounds: 1 } } }
function pool(id) { return pools.find((item) => item.id === id) }

const RULES = {
  REGULAR: { tags: ["regular"], minRating: 0.84, minRatingCount: 5, minDifficulty: 17, minDuration: null },
  CONFIGURED: { tags: ["plain"], minRating: 0.8, minRatingCount: 5, minDifficulty: null, minDuration: null },
  TB: { tags: ["regular", "plain"], minRating: 0.84, minRatingCount: 5, minDifficulty: null, minDuration: 360 },
}
function screen(category) {
  const rule = RULES[category]
  if (!rule) return []
  return indexedCharts
    .filter((chart) => chart.tags.some((tag) => rule.tags.includes(tag)))
    .filter((chart) => chart.rating > rule.minRating && chart.ratingCount >= rule.minRatingCount)
    .filter((chart) => rule.minDifficulty == null || chart.difficulty >= rule.minDifficulty)
    .filter((chart) => rule.minDuration == null || (chart.durationSeconds ?? 0) >= rule.minDuration)
    .sort((a, b) => b.rating - a.rating)
}
function findRoom(id) { return rooms.find((item) => item.roomId === id) }
function json(response, body, status = 200) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)) }
// 服务端错误体用 reason，mock 保持一致，前端才能用同一套解析
function fail(response, reason, status = 400) { json(response, { ok: false, reason }, status) }
function authorized(request, response, write = false) { const token = request.headers.authorization?.replace(/^Bearer\s+/, ""); const session = token && tokens.get(token); if (!session) { fail(response, "未登录", 401); return false } if (write && !session.isAdmin) { fail(response, "需要管理员权限", 403); return false } return true }
function sessionOf(request) { return tokens.get(request.headers.authorization?.replace(/^Bearer\s+/, "")) }
async function body(request) { let value = ""; for await (const chunk of request) value += chunk; try { return JSON.parse(value || "{}") } catch { return {} } }

async function api(request, response, path) {
  path = path.length > 1 ? path.replace(/\/+$/, "") : path
  const data = request.method === "GET" || request.method === "DELETE" ? {} : await body(request)
  // 不下发 phira_token：Mock 环境由前端用测试账号临时换取（见 lib/api.ts 的 phiraToken）
  if (request.method === "POST" && path === "/login") { const token = `mock-${Date.now()}-${Math.random()}`; const isAdmin = String(data.email || "").toLowerCase().includes("admin"); const userId = 2; tokens.set(token, { isAdmin, userId }); return json(response, { ok: true, token, isAdmin, userId }) }
  // 清空房间对房主和房间管理员也开放（在路由里判断），其余写接口仍然只对管理员开放
  const clear = request.method === "POST" ? path.match(/^\/room\/([^/]+)\/clear$/) : null
  if (!authorized(request, response, request.method !== "GET" && !clear)) return
  if (request.method === "GET") {
    if (path === "/room/list") return json(response, { ok: true, rooms })
    if (path === "/pool/list") return json(response, { ok: true, pools })
    if (path === "/admin") return json(response, { ok: true, admins })
    if (path.startsWith("/chart/search")) {
      const query = new URL(request.url || "", "http://localhost").searchParams
      const category = (query.get("category") || "REGULAR").toUpperCase()
      const limit = Number(query.get("limit") || 50)
      if (fullSweepPending && Date.now() >= refreshUntil) { indexedCharts.push(...missedCharts.splice(0)); fullSweepPending = false }
      const refresh = query.get("refresh")
      if (refresh !== null) {
        const full = refresh === "full"
        refreshUntil = Math.max(refreshUntil, Date.now() + (full ? 6000 : 2000))
        if (full) fullSweepPending = true
      }
      const matched = screen(category)
      return json(response, {
        ok: true,
        result: {
          indexed: indexedCharts.length,
          remoteTotal: indexedCharts.length + missedCharts.length,
          refreshing: Date.now() < refreshUntil,
          matched: matched.length,
          charts: matched.slice(0, limit),
        },
      })
    }
    const roomMatch = path.match(/^\/room\/([^/]+)\/?$/); if (roomMatch) { const item = findRoom(decodeURIComponent(roomMatch[1])); return item ? json(response, { ok: true, info: item }) : fail(response, "房间不存在", 404) }
  }
  if (request.method === "POST") {
    const createRoom = path.match(/^\/room\/([^/]+)\/create$/); if (createRoom) { const id = decodeURIComponent(createRoom[1]); const ids = Array.isArray(data.pools) ? data.pools.map(Number) : []; if (findRoom(id) || !ids.length || ids.some((poolId) => !pool(poolId))) return fail(response, "房间 ID 或谱池无效"); rooms.push(room(id, false, 0, 1000, ids[0], ids)); return json(response, { ok: true }) }
    if (clear) {
      const item = findRoom(decodeURIComponent(clear[1]))
      if (!item) return fail(response, "房间不存在", 404)
      const session = sessionOf(request)
      // 全局管理员，或该房间的房主 / 房间管理员
      if (!session.isAdmin && item.host !== session.userId && !item.config.adminIds.includes(session.userId)) return fail(response, "需要权限", 403)
      const removed = item.players.length + item.monitors.length
      item.players = []; item.monitors = []; item.host = null; item.state = "WaitForReady"
      if (gameCreatedRooms.has(item)) rooms.splice(rooms.indexOf(item), 1)
      return json(response, { ok: true, removed })
    }
    const end = path.match(/^\/room\/([^/]+)\/end$/); if (end) { const item = findRoom(decodeURIComponent(end[1])); if (!item) return fail(response, "房间不存在", 404); item.live = false; item.state = "WaitForReady"; item.players = []; return json(response, { ok: true }) }
    if (path === "/pool") { const id = Number(data.id); const chartIds = Array.isArray(data.chartIds) ? data.chartIds.map(Number).filter(Number.isInteger) : []; const favoriteId = data.favoriteId == null ? null : Number(data.favoriteId); if (!Number.isInteger(id) || pool(id) || (favoriteId == null && !chartIds.length)) return fail(response, "谱池参数无效"); pools.push({ id, chartIds, favoriteId, default: false, category: data.category || "MANUAL", sizeLimit: data.sizeLimit ?? null, roundsPerStay: data.roundsPerStay ?? null, order: id * 10 }); return json(response, { ok: true }) }
    if (path === "/pool/batch") {
      const count = Number(data.count)
      if (!Number.isInteger(count) || count < 1 || count > 50) return fail(response, "数量需为 1 到 50")
      const created = []
      for (let i = 0; i < count; i++) {
        pools.push({ id: nextPoolId, chartIds: [], favoriteId: null, default: false, category: data.category || "MANUAL", sizeLimit: data.sizeLimit ?? null, roundsPerStay: data.roundsPerStay ?? null, order: nextPoolId * 10 })
        created.push(nextPoolId++)
      }
      return json(response, { ok: true, poolIds: created })
    }
    const add = path.match(/^\/pool\/(\d+)\/chart$/); if (add) { const item = pool(Number(add[1])); if (!item) return fail(response, "谱池不存在", 404); const id = Number(data.chartId); if (!Number.isInteger(id)) return fail(response, "谱面 ID 无效"); if (!item.chartIds.includes(id)) item.chartIds.push(id); return json(response, { ok: true }) }
    const addBatch = path.match(/^\/pool\/(\d+)\/charts$/); if (addBatch) { const item = pool(Number(addBatch[1])); if (!item) return fail(response, "谱池不存在", 404); const ids = Array.isArray(data.chartIds) ? data.chartIds.map(Number).filter(Number.isInteger) : []; if (!ids.length) return fail(response, "谱面 ID 无效"); let added = 0; for (const id of ids) if (!item.chartIds.includes(id)) { item.chartIds.push(id); added++ } return json(response, { ok: true, added }) }
    if (path === "/admin") { const userId = Number(data.userId); if (!Number.isInteger(userId) || userId <= 0) return fail(response, "用户 ID 无效"); const added = !admins.includes(userId); if (added) admins.push(userId); return json(response, { ok: true, added, admins }) }
    if (path === "/pool/generate") {
      const category = String(data.category || "").toUpperCase()
      if (!RULES[category]) return fail(response, "该类别不支持规则生成")
      const sizeLimit = Number(data.sizeLimit || 15)
      if (!(sizeLimit > 0)) return fail(response, "每池谱面数必须为正")
      const roundsPerStay = data.roundsPerStay == null ? null : Number(data.roundsPerStay)
      const matched = screen(category)
      if (!matched.length) return fail(response, "没有匹配的谱面，先刷新谱面目录")
      const created = []
      // 服务端最多 200 个池，放不下的匹配谱面计入 leftover
      let placed = 0
      for (let start = 0; start < matched.length && pools.length < MAX_POOLS; start += sizeLimit) {
        const slice = matched.slice(start, start + sizeLimit)
        pools.push({ id: nextPoolId, chartIds: slice.map((chart) => chart.id), favoriteId: null, default: false, category, sizeLimit, roundsPerStay, order: nextPoolId * 10 })
        created.push(nextPoolId++)
        placed += slice.length
      }
      return json(response, { ok: true, poolIds: created, leftover: matched.length - placed })
    }
    if (path === "/chart/duration") {
      const ids = Array.isArray(data.chartIds) ? data.chartIds.map(Number) : []
      const charts = indexedCharts.filter((chart) => ids.includes(chart.id))
      return json(response, { ok: true, probed: charts.length, charts })
    }
  }
  if (request.method === "PUT") {
    const update = path.match(/^\/room\/([^/]+)\/update$/); if (update) { const item = findRoom(decodeURIComponent(update[1])); if (!item) return fail(response, "房间不存在", 404); if (data.allReadyDelay !== undefined && !(Number.isInteger(data.allReadyDelay) && data.allReadyDelay >= 0 && data.allReadyDelay <= 300)) return fail(response, "allReadyDelay 必须在 0 到 300 之间"); item.live = Boolean(data.live); item.state = "WaitForReady"; item.locked = Boolean(data.lock); Object.assign(item.config, { minPlayer: Number(data.minPlayer), maxPlayer: Number(data.maxPlayer), selectCountdown: Number(data.selectCountdown), readyCountdown: Number(data.readyCountdown), forceFinish: Number(data.forceFinish), interval: Number(data.interval) }); if (typeof data.chatEnable === "boolean") item.config.chatEnable = data.chatEnable; if (typeof data.cancelReadyInVote === "boolean") item.config.cancelReadyInVote = data.cancelReadyInVote; if (typeof data.startWhenAllReady === "boolean") item.config.startWhenAllReady = data.startWhenAllReady; if (data.allReadyDelay !== undefined) item.config.allReadyDelay = data.allReadyDelay; if (Array.isArray(data.adminIds)) item.config.adminIds = data.adminIds.map(Number).filter((id) => Number.isInteger(id) && id > 0); return json(response, { ok: true }) }
    const switchPool = path.match(/^\/room\/([^/]+)\/pool\/switch$/); if (switchPool) { const item = findRoom(decodeURIComponent(switchPool[1])); const target = pool(Number(data.poolId)); if (!item || !target || !item.pool.pools.some((candidate) => candidate.id === target.id)) return fail(response, "目标谱池无效"); item.pool.pendingPoolId = target.id; item.pool.currentPool = target; return json(response, { ok: true }) }
    const roomFavorite = path.match(/^\/room\/([^/]+)\/pool\/favorite$/); if (roomFavorite) { const item = findRoom(decodeURIComponent(roomFavorite[1])); if (!item) return fail(response, "房间不存在", 404); item.pool.favoriteId = data.favoriteId == null ? null : Number(data.favoriteId); return json(response, { ok: true }) }
    const favorite = path.match(/^\/pool\/(\d+)\/favorite$/); if (favorite) { const item = pool(Number(favorite[1])); if (!item) return fail(response, "谱池不存在", 404); item.favoriteId = data.favoriteId == null ? null : Number(data.favoriteId); return json(response, { ok: true }) }
    const defaultPool = path.match(/^\/pool\/(\d+)\/default$/); if (defaultPool) { const item = pool(Number(defaultPool[1])); if (!item) return fail(response, "谱池不存在", 404); pools.forEach((candidate) => { candidate.default = false }); item.default = Boolean(data.enabled); return json(response, { ok: true }) }
    const updatePool = path.match(/^\/pool\/(\d+)$/); if (updatePool) {
      const item = pool(Number(updatePool[1]))
      if (!item) return fail(response, "谱池不存在", 404)
      if (data.category != null) item.category = String(data.category).toUpperCase()
      // 负数表示清空该字段，与服务端一致
      if (data.sizeLimit != null) item.sizeLimit = Number(data.sizeLimit) < 0 ? null : Number(data.sizeLimit)
      if (data.roundsPerStay != null) item.roundsPerStay = Number(data.roundsPerStay) < 0 ? null : Number(data.roundsPerStay)
      if (data.order != null) item.order = Math.max(0, Number(data.order))
      return json(response, { ok: true })
    }
  }
  if (request.method === "DELETE") {
    const chart = path.match(/^\/pool\/(\d+)\/chart\/(\d+)$/); if (chart) { await new Promise((r) => setTimeout(r, 1500)); const item = pool(Number(chart[1])); if (!item) return fail(response, "谱池不存在", 404); if (item.chartIds.length <= 1) return fail(response, "不能删除最后一张谱面"); item.chartIds = item.chartIds.filter((id) => id !== Number(chart[2])); return json(response, { ok: true }) }
    const poolMatch = path.match(/^\/pool\/(\d+)$/); if (poolMatch) { const index = pools.findIndex((item) => item.id === Number(poolMatch[1])); if (index < 0) return fail(response, "谱池不存在", 404); pools.splice(index, 1); return json(response, { ok: true }) }
    const roomMatch = path.match(/^\/room\/([^/]+)$/); if (roomMatch) { const index = rooms.findIndex((item) => item.roomId === decodeURIComponent(roomMatch[1])); if (index < 0) return fail(response, "房间不存在", 404); rooms.splice(index, 1); return json(response, { ok: true }) }
    const adminMatch = path.match(/^\/admin\/(\d+)$/); if (adminMatch) { const userId = Number(adminMatch[1]); if (admins.length <= 1) return fail(response, "至少保留一名管理员"); const index = admins.indexOf(userId); const removed = index >= 0; if (removed) admins.splice(index, 1); return json(response, { ok: true, removed, admins }) }
  }
  fail(response, "接口不存在", 404)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`)
  if (url.pathname.startsWith("/api/v1/")) return api(request, response, url.pathname.slice("/api/v1".length))
  if (nextPort) return proxyToNext(request, response)
  const requested = normalize(join(output, url.pathname === "/" ? "index.html" : url.pathname))
  const file = requested.startsWith(output) ? requested : join(output, "index.html")
  try { await stat(file); const content = await readFile(file); const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" }[extname(file)] || "application/octet-stream"; response.writeHead(200, { "Content-Type": type }); response.end(content) } catch { const content = await readFile(join(output, "index.html")); response.writeHead(200, { "Content-Type": "text/html" }); response.end(content) }
})
function proxyToNext(request, response) {
  const upstream = proxyRequest({ hostname: "127.0.0.1", port: nextPort, method: request.method, path: request.url, headers: request.headers }, (nextResponse) => { response.writeHead(nextResponse.statusCode || 502, nextResponse.headers); nextResponse.pipe(response) })
  upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end("Next dev is starting") })
  request.pipe(upstream)
}
if (nextPort) server.on("upgrade", (request, socket, head) => { const upstream = connect(nextPort, "127.0.0.1", () => { const headers = Object.entries(request.headers).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\r\n"); upstream.write(`${request.method} ${request.url} HTTP/1.1\r\n${headers}\r\n\r\n`); if (head.length) upstream.write(head); socket.pipe(upstream).pipe(socket) }); upstream.on("error", () => socket.destroy()); socket.on("error", () => upstream.destroy()) })
server.listen(port, () => console.log(`Mock static server: http://127.0.0.1:${port}`))
