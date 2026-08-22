export type RoomPlayer = { id: number; name?: string; avatar?: string | null }
export type RoomPool = {
  currentPool: Pool
  pools: Pool[]
  pendingPoolId?: number | null
  favoriteId?: number | null
  finishedRoundsSinceRefresh: number
  refreshIntervalRounds: number
}
export type Room = {
  roomId: string
  state: "Playing" | "WaitForReady" | "SelectChart"
  live: boolean
  locked: boolean
  cycle: boolean
  host?: number | null
  players: RoomPlayer[]
  monitors: RoomPlayer[]
  chart?: unknown
  type: "local"
  config: {
    minPlayer: number
    maxPlayer: number
    selectCountdown: number
    readyCountdown: number
    forceFinish: number
    interval: number
  }
  pool: RoomPool
}
export type Pool = { id: number; chartIds: number[]; favoriteId: number | null; default: boolean }

export type PhiraChart = {
  id: number
  name: string
  level: string | null
  difficulty: number
  charter: string | null
  composer: string | null
  illustrator: string | null
  description: string | null
  ranked: boolean
  reviewed: boolean
  stable: boolean
  illustration: string | null
  preview: string | null
  file: string | null
  uploader: number
  tags: string[]
  rating: number
  ratingCount: number
  created: string
  updated: string
  chartUpdated: string
}
export type PhiraCollection = {
  id: number
  owner: number
  name: string
  description: string | null
  created: string
  updated: string
  cover: string | null
  public: boolean
  likes: number
  charts: PhiraChart[]
}
export type PhiraSearchResult = { count: number; results: PhiraChart[] }
export type PhiraUser = {
  id: number
  name: string
  avatar: string | null
  bio: string | null
  rks: number
  language: string
  roles: number
  badges: string[]
  badgeNames?: Record<string, string>
  follower_count: number
  following_count: number
  joined?: string
  last_login?: string
  banned?: boolean
}

const API_BASE = "/api/v1"
const PHIRA_API_BASE = "https://phira.5wyxi.com"

// 仅 Mock 环境用测试账号换取 token；生产环境由后端下发 phira_token 存入 localStorage
const IS_MOCK_API = process.env.NEXT_PUBLIC_MOCK_API === "true"
const PHIRA_TEST_EMAIL = "i@07210700.xyz"
const PHIRA_TEST_PASSWORD = "asd123456"

async function phira<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${PHIRA_API_BASE}${path}`, init)
    if (!response.ok) return null
    return await response.json() as T
  } catch { return null }
}
async function phiraToken(): Promise<string | null> {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem("phira-token") : null
  if (stored) return stored
  // 仅 Mock 环境：本地没有真实 token 时，临时用测试账号换取
  if (!IS_MOCK_API) return null
  const login = await fetch(`${PHIRA_API_BASE}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: PHIRA_TEST_EMAIL, password: PHIRA_TEST_PASSWORD }) })
  if (!login.ok) return null
  const data = await login.json() as { token?: string }
  if (!data.token) return null
  if (typeof window !== "undefined") window.localStorage.setItem("phira-token", data.token)
  return data.token
}
export const phiraApi = {
  chart: (id: number) => phira<PhiraChart>(`/chart/${id}`),
  collection: (id: number) => phira<PhiraCollection>(`/collection/${id}`),
  user: (id: number) => phira<PhiraUser>(`/user/${id}`),
  search: async (query: string, page = 1, pageNum = 20, order = "-updated") => {
    const token = await phiraToken()
    if (!token) return null
    return phira<PhiraSearchResult>(`/chart?pageNum=${pageNum}&page=${page}&order=${order}&search=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } })
  },
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("zenith-token") : null
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
  if (!response.ok) {
    let message = `API ${response.status}`
    try { const error = await response.json() as { message?: string }; if (error.message) message = error.message } catch { /* keep status fallback */ }
    throw new Error(message)
  }
  return response.json()
}

export const api = {
  login: (email: string, password: string) => request<{ ok: boolean; token: string; isAdmin: boolean; userId: number }>("/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  rooms: () => request<{ ok: boolean; rooms: Room[] }>("/room/list"),
  room: (id: string) => request<{ ok: boolean; info: Room }>(`/room/${encodeURIComponent(id)}/`),
  switchRoomPool: (id: string, poolId: number) => request<{ ok: boolean }>(`/room/${encodeURIComponent(id)}/pool/switch`, { method: "PUT", body: JSON.stringify({ poolId }) }),
  setRoomFavorite: (id: string, favoriteId: number | null) => request<{ ok: boolean }>(`/room/${encodeURIComponent(id)}/pool/favorite`, { method: "PUT", body: JSON.stringify({ favoriteId }) }),
  pools: () => request<{ ok: boolean; pools: Pool[] }>("/pool/list"),
  endRoom: (id: string) => request<{ ok: boolean }>(`/room/${id}/end`, { method: "POST" }),
  deleteRoom: (id: string) => request<{ ok: boolean }>(`/room/${id}`, { method: "DELETE" }),
  deletePool: (id: number) => request<{ ok: boolean }>(`/pool/${id}`, { method: "DELETE" }),
  createRoom: (id: string, pools: number[]) => request<{ ok: boolean }>(`/room/${encodeURIComponent(id)}/create`, { method: "POST", body: JSON.stringify({ type: "local", pools }) }),
  updateRoom: (id: string, data: { live: boolean; lock: boolean; minPlayer: number; maxPlayer: number; chatEnable: boolean; selectCountdown?: number; readyCountdown?: number; forceFinish?: number; interval?: number }) => request<{ ok: boolean }>(`/room/${encodeURIComponent(id)}/update`, { method: "PUT", body: JSON.stringify(data) }),
  createPool: (id: number, chartIds: number[], favoriteId?: number | null) => request<{ ok: boolean }>("/pool", { method: "POST", body: JSON.stringify({ id, chartIds, favoriteId: favoriteId ?? null }) }),
  addChart: (id: number, chartId: number) => request<{ ok: boolean }>(`/pool/${id}/chart`, { method: "POST", body: JSON.stringify({ chartId }) }),
  addCharts: (id: number, chartIds: number[]) => request<{ ok: boolean }>(`/pool/${id}/charts`, { method: "POST", body: JSON.stringify({ chartIds }) }),
  removeChart: (id: number, chartId: number) => request<{ ok: boolean }>(`/pool/${id}/chart/${chartId}`, { method: "DELETE" }),
  setPoolDefault: (id: number, enabled: boolean) => request<{ ok: boolean }>(`/pool/${id}/default`, { method: "PUT", body: JSON.stringify({ enabled }) }),
  setPoolFavorite: (id: number, favoriteId: number | null) => request<{ ok: boolean }>(`/pool/${id}/favorite`, { method: "PUT", body: JSON.stringify({ favoriteId }) }),
}
