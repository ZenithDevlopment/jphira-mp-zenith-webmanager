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
const pools = [
  { id: 0, chartIds: [1024, 1028, 1104, 1200, 1215], favoriteId: 1024, default: true },
  { id: 1, chartIds: [2048, 2050, 2077], favoriteId: null, default: false },
  { id: 2, chartIds: [3001, 3018, 3090, 3112], favoriteId: 3018, default: false },
]
const rooms = [room("lobby-main", true, 42, 1000, 0, [0, 1, 2], "Playing"), room("night-owl", false, 8, 32, 1, [1, 2], "WaitForReady"), room("zenith-test", true, 16, 64, 2, [2], "SelectChart")]

function room(id, live, players, maxPlayer, currentPoolId, poolIds, state = "WaitForReady") { return { roomId: id, state, live, locked: false, cycle: true, host: null, players: Array.from({ length: players }, (_, index) => ({ id: index + 1 })), monitors: [], chart: null, type: "local", config: { minPlayer: 1, maxPlayer, selectCountdown: 30, readyCountdown: 10, forceFinish: 60, interval: 1 }, pool: { currentPool: pool(currentPoolId), pools: poolIds.map(pool).filter(Boolean), pendingPoolId: null, favoriteId: null, finishedRoundsSinceRefresh: 0, refreshIntervalRounds: 1 } } }
function pool(id) { return pools.find((item) => item.id === id) }
function findRoom(id) { return rooms.find((item) => item.roomId === id) }
function json(response, body, status = 200) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)) }
function fail(response, message, status = 400) { json(response, { ok: false, message }, status) }
function authorized(request, response, write = false) { const token = request.headers.authorization?.replace(/^Bearer\s+/, ""); const session = token && tokens.get(token); if (!session) { fail(response, "未登录", 401); return false } if (write && !session.isAdmin) { fail(response, "需要管理员权限", 403); return false } return true }
async function body(request) { let value = ""; for await (const chunk of request) value += chunk; try { return JSON.parse(value || "{}") } catch { return {} } }

async function api(request, response, path) {
  path = path.length > 1 ? path.replace(/\/+$/, "") : path
  const data = request.method === "GET" || request.method === "DELETE" ? {} : await body(request)
  if (request.method === "POST" && path === "/login") { const token = `mock-${Date.now()}-${Math.random()}`; const isAdmin = String(data.email || "").toLowerCase().includes("admin"); const userId = 2; tokens.set(token, { isAdmin, userId }); return json(response, { ok: true, token, isAdmin, userId }) }
  if (!authorized(request, response, request.method !== "GET")) return
  if (request.method === "GET") {
    if (path === "/room/list") return json(response, { ok: true, rooms })
    if (path === "/pool/list") return json(response, { ok: true, pools })
    const roomMatch = path.match(/^\/room\/([^/]+)\/?$/); if (roomMatch) { const item = findRoom(decodeURIComponent(roomMatch[1])); return item ? json(response, { ok: true, info: item }) : fail(response, "房间不存在", 404) }
  }
  if (request.method === "POST") {
    const createRoom = path.match(/^\/room\/([^/]+)\/create$/); if (createRoom) { const id = decodeURIComponent(createRoom[1]); const ids = Array.isArray(data.pools) ? data.pools.map(Number) : []; if (findRoom(id) || !ids.length || ids.some((poolId) => !pool(poolId))) return fail(response, "房间 ID 或谱池无效"); rooms.push(room(id, false, 0, 1000, ids[0], ids)); return json(response, { ok: true }) }
    const end = path.match(/^\/room\/([^/]+)\/end$/); if (end) { const item = findRoom(decodeURIComponent(end[1])); if (!item) return fail(response, "房间不存在", 404); item.live = false; item.state = "WaitForReady"; item.players = []; return json(response, { ok: true }) }
    if (path === "/pool") { const id = Number(data.id); const chartIds = Array.isArray(data.chartIds) ? data.chartIds.map(Number).filter(Number.isInteger) : []; if (!Number.isInteger(id) || pool(id) || !chartIds.length) return fail(response, "谱池参数无效"); pools.push({ id, chartIds, favoriteId: null, default: false }); return json(response, { ok: true }) }
    const add = path.match(/^\/pool\/(\d+)\/chart$/); if (add) { const item = pool(Number(add[1])); if (!item) return fail(response, "谱池不存在", 404); const id = Number(data.chartId); if (!Number.isInteger(id)) return fail(response, "谱面 ID 无效"); if (!item.chartIds.includes(id)) item.chartIds.push(id); return json(response, { ok: true }) }
  }
  if (request.method === "PUT") {
    const update = path.match(/^\/room\/([^/]+)\/update$/); if (update) { const item = findRoom(decodeURIComponent(update[1])); if (!item) return fail(response, "房间不存在", 404); item.live = Boolean(data.live); item.state = "WaitForReady"; item.locked = Boolean(data.lock); Object.assign(item.config, { minPlayer: Number(data.minPlayer), maxPlayer: Number(data.maxPlayer), selectCountdown: Number(data.selectCountdown), readyCountdown: Number(data.readyCountdown), forceFinish: Number(data.forceFinish), interval: Number(data.interval) }); return json(response, { ok: true }) }
    const switchPool = path.match(/^\/room\/([^/]+)\/pool\/switch$/); if (switchPool) { const item = findRoom(decodeURIComponent(switchPool[1])); const target = pool(Number(data.poolId)); if (!item || !target || !item.pool.pools.some((candidate) => candidate.id === target.id)) return fail(response, "目标谱池无效"); item.pool.pendingPoolId = target.id; item.pool.currentPool = target; return json(response, { ok: true }) }
    const roomFavorite = path.match(/^\/room\/([^/]+)\/pool\/favorite$/); if (roomFavorite) { const item = findRoom(decodeURIComponent(roomFavorite[1])); if (!item) return fail(response, "房间不存在", 404); item.pool.favoriteId = data.favoriteId == null ? null : Number(data.favoriteId); return json(response, { ok: true }) }
    const favorite = path.match(/^\/pool\/(\d+)\/favorite$/); if (favorite) { const item = pool(Number(favorite[1])); if (!item) return fail(response, "谱池不存在", 404); item.favoriteId = data.favoriteId == null ? null : Number(data.favoriteId); return json(response, { ok: true }) }
    const defaultPool = path.match(/^\/pool\/(\d+)\/default$/); if (defaultPool) { const item = pool(Number(defaultPool[1])); if (!item) return fail(response, "谱池不存在", 404); pools.forEach((candidate) => { candidate.default = false }); item.default = Boolean(data.enabled); return json(response, { ok: true }) }
  }
  if (request.method === "DELETE") {
    const chart = path.match(/^\/pool\/(\d+)\/chart\/(\d+)$/); if (chart) { const item = pool(Number(chart[1])); if (!item) return fail(response, "谱池不存在", 404); if (item.chartIds.length <= 1) return fail(response, "不能删除最后一张谱面"); item.chartIds = item.chartIds.filter((id) => id !== Number(chart[2])); return json(response, { ok: true }) }
    const poolMatch = path.match(/^\/pool\/(\d+)$/); if (poolMatch) { const index = pools.findIndex((item) => item.id === Number(poolMatch[1])); if (index < 0) return fail(response, "谱池不存在", 404); pools.splice(index, 1); return json(response, { ok: true }) }
    const roomMatch = path.match(/^\/room\/([^/]+)$/); if (roomMatch) { const index = rooms.findIndex((item) => item.roomId === decodeURIComponent(roomMatch[1])); if (index < 0) return fail(response, "房间不存在", 404); rooms.splice(index, 1); return json(response, { ok: true }) }
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
if (nextPort) server.on("upgrade", (request, socket, head) => { const upstream = connect(nextPort, "127.0.0.1", () => { const headers = Object.entries(request.headers).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\r\n"); upstream.write(`${request.method} ${request.url} HTTP/1.1\r\n${headers}\r\n\r\n`); if (head.length) upstream.write(head); socket.pipe(upstream).pipe(socket) }); upstream.on("error", () => socket.destroy()) })
server.listen(port, () => console.log(`Mock static server: http://127.0.0.1:${port}`))
