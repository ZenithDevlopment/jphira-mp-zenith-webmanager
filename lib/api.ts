export type RoomPlayer = { id: number; name?: string; avatar?: string | null }
export type RoomPool = {
  currentPool: Pool
  pools: Pool[]
  pendingPoolId?: number | null
  favoriteId?: number | null
  finishedRoundsSinceRefresh: number
  refreshIntervalRounds: number
  /** Rounds the current pool actually stays for: its own quota, else the room interval. */
  effectiveRoundsPerStay?: number
}
/** 一轮结算中单个玩家的成绩 */
export type RoundPlayerResult = {
  playerId: number
  playerName: string
  rank: number
  score: number
  accuracy: number
  std: number
  /** 本轮获得的积分 */
  gainedPoints: number
  /** 结算后的累计积分 */
  totalPoints: number
}
/** 一轮比赛（正常游玩结束后落库，不可修改） */
export type RoundRecord = {
  id: string
  roomId: string
  chartId: number
  chartName: string
  startedAt: number
  finishedAt: number
  results: RoundPlayerResult[]
}
/** 玩家视角下的一轮记录 */
export type PlayerRound = {
  recordId: string
  roomId: string
  chartId: number
  chartName: string
  finishedAt: number
  result: RoundPlayerResult
}
export type RankEntry = { playerId: number; name: string; points: number; rank: number }

/** 可导入导出的数据类型，对应服务端 data/ 下的文件 */
export const DATA_KINDS = [
  { value: "pools", label: "谱池", hint: "池定义、类别、配额、轮换顺序" },
  { value: "records", label: "比赛记录", hint: "每轮成绩、积分与排名" },
  { value: "points", label: "玩家积分", hint: "累计积分（积分榜数据来源）" },
  { value: "submissions", label: "投稿", hint: "玩家投稿与审核状态" },
  { value: "admins", label: "管理员", hint: "后台管理员白名单" },
] as const
export type DataKind = (typeof DATA_KINDS)[number]["value"]

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
/** REGULAR 常规, CONFIGURED 纯配置, TB 长曲, MANUAL 手动维护. */
export type PoolCategory = "REGULAR" | "CONFIGURED" | "TB" | "MANUAL"

export const POOL_CATEGORIES: { value: PoolCategory; label: string; hint: string }[] = [
  { value: "MANUAL", label: "手动", hint: "没有筛谱规则，人工维护" },
  { value: "REGULAR", label: "常规", hint: "regular，评分 > 4.2 且难度 ≥ AT17" },
  { value: "CONFIGURED", label: "纯配置", hint: "plain，评分 > 4.0" },
  { value: "TB", label: "TB", hint: "常规或纯配置，评分 > 4.2 且时长 > 6 分钟" },
]

export type Pool = {
  id: number
  chartIds: number[]
  favoriteId: number | null
  default: boolean
  category?: PoolCategory | null
  /** 目标容量，批量生成时按此切分 */
  sizeLimit?: number | null
  /** 停留轮数，留空则跟随房间的 interval */
  roundsPerStay?: number | null
  order?: number | null
  /** 是否允许玩家向该池投稿 */
  submissionOpen?: boolean
}

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED"

export type SubmissionSubmitter = {
  userId: number
  name: string
  at: string | null
}

/** 按「池 + 谱面」聚合：同一张谱面被多人投稿时合并到同一条里 */
export type Submission = {
  poolId: number
  chartId: number
  status: SubmissionStatus
  chart: PhiraChart | null
  submitterCount: number
  submitters: SubmissionSubmitter[]
  createdAt: string | null
  reviewedAt: string | null
  reviewerId: number | null
  reason: string | null
}

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  PENDING: "待审",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
}

export type ChartSearchResult = {
  indexed: number
  remoteTotal: number | null
  refreshing: boolean
  matched: number
  /** TB 专用：为 true 表示条件放宽后仍有候选，只是时长还没探测 */
  pendingDuration?: boolean
  charts: PhiraChart[]
}

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
  /** 秒，未探测过时为 null */
  durationSeconds?: number | null
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
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("zenith-token")
      window.localStorage.removeItem("zenith-session")
      if (window.location.pathname !== "/") window.location.assign("/")
    }
    throw new Error("未登录")
  }
  if (!response.ok) {
    let message = `API ${response.status}`
    try {
      // 服务端错误体是 { ok:false, reason:"..." }，message 只作兜底
      const error = await response.json() as { reason?: string; message?: string }
      if (error.reason) message = error.reason
      else if (error.message) message = error.message
    } catch { /* keep status fallback */ }
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
  /** 以系统消息形式推送到单个房间（客户端按 senderId=-1 渲染） */
  sayToRoom: (id: string, message: string) => request<{ ok: boolean; delivered: number }>(`/room/${encodeURIComponent(id)}/say`, { method: "POST", body: JSON.stringify({ message }) }),
  /** 全服广播 */
  broadcast: (message: string) => request<{ ok: boolean; delivered: number }>("/broadcast", { method: "POST", body: JSON.stringify({ message }) }),
  /** 比赛记录：按轮次倒序，可按房间或玩家过滤 */
  records: (params?: { limit?: number; offset?: number; roomId?: string; playerId?: number }) => {
    const search = new URLSearchParams()
    if (params?.limit) search.set("limit", String(params.limit))
    if (params?.offset) search.set("offset", String(params.offset))
    if (params?.roomId) search.set("roomId", params.roomId)
    if (params?.playerId) search.set("playerId", String(params.playerId))
    const query = search.toString()
    return request<{ ok: boolean; result: { total: number; records: RoundRecord[] } }>(`/record/list${query ? `?${query}` : ""}`)
  },
  /** 某位玩家的历史轮次 */
  playerRecords: (playerId: number, limit = 50) => request<{ ok: boolean; result: { playerId: number; rounds: PlayerRound[] } }>(`/record/player/${playerId}?limit=${limit}`),
  /** 累计积分排行榜 */
  pointRanking: (limit = 50) => request<{ ok: boolean; ranking: RankEntry[] }>(`/point/ranking?limit=${limit}`),
  /** 数据导出：admins | pools | points | records | submissions */
  exportData: (kind: DataKind) => request<unknown>(`/data/${kind}/export`),
  /** 数据导入。merge=true 时按主键合并，否则整体覆盖。 */
  importData: (kind: DataKind, content: string, merge: boolean) =>
    request<{ ok: boolean; imported: number; total: number; backup: string }>(`/data/${kind}/import?mode=${merge ? "merge" : "replace"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: content,
    }),
  listBackups: (kind: DataKind) => request<{ ok: boolean; backups: string[] }>(`/data/${kind}/backups`),
  restoreBackup: (kind: DataKind, backup: string) =>
    request<{ ok: boolean; imported: number }>(`/data/${kind}/restore`, {
      method: "POST", body: JSON.stringify({ backup }),
    }),
  deleteRoom: (id: string) => request<{ ok: boolean }>(`/room/${id}`, { method: "DELETE" }),
  deletePool: (id: number) => request<{ ok: boolean }>(`/pool/${id}`, { method: "DELETE" }),
  createRoom: (id: string, pools: number[]) => request<{ ok: boolean }>(`/room/${encodeURIComponent(id)}/create`, { method: "POST", body: JSON.stringify({ type: "local", pools }) }),
  updateRoom: (id: string, data: { live: boolean; lock: boolean; minPlayer: number; maxPlayer: number; chatEnable: boolean; selectCountdown?: number; readyCountdown?: number; forceFinish?: number; interval?: number }) => request<{ ok: boolean }>(`/room/${encodeURIComponent(id)}/update`, { method: "PUT", body: JSON.stringify(data) }),
  createPool: (id: number, chartIds: number[], favoriteId?: number | null,
               meta?: { category?: PoolCategory; sizeLimit?: number | null; roundsPerStay?: number | null }) =>
    request<{ ok: boolean }>("/pool", {
      method: "POST",
      body: JSON.stringify({ id, chartIds, favoriteId: favoriteId ?? null, ...meta }),
    }),
  /** 批量创建空池，ID 由服务端分配，避免并发冲突 */
  createPoolsBatch: (body: { count: number; category?: PoolCategory; sizeLimit?: number; roundsPerStay?: number }) =>
    request<{ ok: boolean; poolIds: number[] }>("/pool/batch", { method: "POST", body: JSON.stringify(body) }),
  addChart: (id: number, chartId: number) => request<{ ok: boolean }>(`/pool/${id}/chart`, { method: "POST", body: JSON.stringify({ chartId }) }),
  addCharts: (id: number, chartIds: number[]) => request<{ ok: boolean }>(`/pool/${id}/charts`, { method: "POST", body: JSON.stringify({ chartIds }) }),
  removeChart: (id: number, chartId: number) => request<{ ok: boolean }>(`/pool/${id}/chart/${chartId}`, { method: "DELETE" }),
  setPoolDefault: (id: number, enabled: boolean) => request<{ ok: boolean }>(`/pool/${id}/default`, { method: "PUT", body: JSON.stringify({ enabled }) }),
  setPoolFavorite: (id: number, favoriteId: number | null) => request<{ ok: boolean }>(`/pool/${id}/favorite`, { method: "PUT", body: JSON.stringify({ favoriteId }) }),

  // 负数表示清空该字段（恢复为跟随房间默认），省略表示不修改
  updatePool: (id: number, data: { category?: PoolCategory; sizeLimit?: number; roundsPerStay?: number; order?: number; submissionOpen?: boolean }) =>
    request<{ ok: boolean }>(`/pool/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  /** 按规则筛选谱面。refresh 会让服务端在后台增量拉取目录。 */
  searchCharts: (params: {
    category?: PoolCategory
    tag?: string
    minRating?: number
    minRatingCount?: number
    minDifficulty?: number
    minDuration?: number
    limit?: number
    refresh?: boolean
    division?: "plain"
    /** TB 专用：先按预算探测时长再筛选，否则未探测的谱面永远不匹配 6 分钟门槛 */
    probeDuration?: number
  } = {}) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value))
    }
    const suffix = query.toString()
    return request<{ ok: boolean; result: ChartSearchResult }>(`/chart/search${suffix ? `?${suffix}` : ""}`)
  },

  /** 把匹配到的谱面按 sizeLimit 切成多个池。probeDuration 仅 TB 需要。 */
  generatePools: (body: { category: PoolCategory; sizeLimit?: number; roundsPerStay?: number; probeDuration?: number }) =>
    request<{ ok: boolean; poolIds: number[] }>("/pool/generate", { method: "POST", body: JSON.stringify(body) }),

  probeDurations: (chartIds: number[]) =>
    request<{ ok: boolean; probed: number; charts: PhiraChart[] }>("/chart/duration", { method: "POST", body: JSON.stringify({ chartIds }) }),

  // ── 投稿：玩家侧只需登录，审核侧需管理员 ──
  openPools: () => request<{ ok: boolean; pools: Pool[] }>("/submission/open-pools"),
  submitCharts: (poolId: number, chartIds: number[]) =>
    request<{ ok: boolean; accepted: number; results: { chartId: number; accepted: boolean; reason: string | null }[] }>(
      `/pool/${poolId}/submissions`, { method: "POST", body: JSON.stringify({ chartIds }) }),
  withdrawSubmission: (poolId: number, chartId: number) =>
    request<{ ok: boolean }>(`/pool/${poolId}/submissions/${chartId}`, { method: "DELETE" }),
  mySubmissions: () => request<{ ok: boolean; submissions: Submission[] }>("/submission/mine"),
  pendingSubmissions: () => request<{ ok: boolean; submissions: Submission[] }>("/submission/pending"),
  poolSubmissions: (poolId: number, status?: SubmissionStatus) =>
    request<{ ok: boolean; submissions: Submission[] }>(
      `/pool/${poolId}/submissions${status ? `?status=${status}` : ""}`),
  approveSubmission: (poolId: number, chartId: number) =>
    request<{ ok: boolean }>(`/submission/${poolId}/${chartId}/approve`, { method: "POST" }),
  rejectSubmission: (poolId: number, chartId: number, reason?: string) =>
    request<{ ok: boolean }>(`/submission/${poolId}/${chartId}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),

  admins: () => request<{ ok: boolean; admins: number[] }>("/admin"),
  addAdmin: (userId: number) => request<{ ok: boolean; added: boolean; admins: number[] }>("/admin", { method: "POST", body: JSON.stringify({ userId }) }),
  removeAdmin: (userId: number) => request<{ ok: boolean; removed: boolean; admins: number[] }>(`/admin/${userId}`, { method: "DELETE" }),
}
