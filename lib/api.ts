export type Room = { id: string; type: string; live: boolean; locked: boolean; players: number; minPlayer: number; maxPlayer: number; currentPoolId: number; favoriteId: number | null }
export type Pool = { id: number; chartIds: number[]; favoriteId: number | null; default: boolean }

const API_BASE = "/api/v1"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("zenith-token") : null
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
  if (!response.ok) throw new Error(`API ${response.status}`)
  return response.json()
}

export const api = {
  rooms: () => request<{ ok: boolean; rooms: Room[] }>("/room/list"),
  pools: () => request<{ ok: boolean; pools: Pool[] }>("/pool/list"),
  endRoom: (id: string) => request<{ ok: boolean }>(`/room/${id}/end`, { method: "POST" }),
  deleteRoom: (id: string) => request<{ ok: boolean }>(`/room/${id}`, { method: "DELETE" }),
  deletePool: (id: number) => request<{ ok: boolean }>(`/pool/${id}`, { method: "DELETE" }),
  createRoom: (id: string, pools: number[]) => request<{ ok: boolean }>(`/room/${encodeURIComponent(id)}/create`, { method: "POST", body: JSON.stringify({ type: "local", pools }) }),
  updateRoom: (id: string, data: Partial<Room>) => request<{ ok: boolean }>(`/room/${encodeURIComponent(id)}/update`, { method: "PUT", body: JSON.stringify(data) }),
  createPool: (id: number, chartIds: number[]) => request<{ ok: boolean }>("/pool", { method: "POST", body: JSON.stringify({ id, chartIds }) }),
  addChart: (id: number, chartId: number) => request<{ ok: boolean }>(`/pool/${id}/chart`, { method: "POST", body: JSON.stringify({ chartId }) }),
  removeChart: (id: number, chartId: number) => request<{ ok: boolean }>(`/pool/${id}/chart/${chartId}`, { method: "DELETE" }),
  setPoolDefault: (id: number, enabled: boolean) => request<{ ok: boolean }>(`/pool/${id}/default`, { method: "PUT", body: JSON.stringify({ enabled }) }),
  setPoolFavorite: (id: number, favoriteId: number | null) => request<{ ok: boolean }>(`/pool/${id}/favorite`, { method: "PUT", body: JSON.stringify({ favoriteId }) }),
}
