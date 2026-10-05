"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, RefreshCw, Trash2, UserCog } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, phiraApi, type PhiraUser } from "@/lib/api"

/** Admin roster, backed by data/admins.json on the server. Adding / removing needs admin rights. */
export function AdminPanel() {
  const [ids, setIds] = useState<number[]>([])
  const [profiles, setProfiles] = useState<Record<number, PhiraUser | null>>({})
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.admins()
      setIds(data.admins)
      // Phira has no batch endpoint, so resolve names lazily and tolerate failures
      const resolved = await Promise.all(data.admins.map(async (id) => [id, await phiraApi.user(id)] as const))
      setProfiles(Object.fromEntries(resolved))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载管理员失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async () => {
    const userId = Number(input.trim())
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error("请输入有效的 Phira 用户 ID")
      return
    }
    setBusy(true)
    try {
      const data = await api.addAdmin(userId)
      setIds(data.admins)
      setInput("")
      toast.success(data.added ? `已添加 ${userId}` : `${userId} 已经在名单里`)
      const profile = await phiraApi.user(userId)
      setProfiles((prev) => ({ ...prev, [userId]: profile }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (userId: number) => {
    setBusy(true)
    try {
      const data = await api.removeAdmin(userId)
      setIds(data.admins)
      toast.success(`已移除 ${userId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">管理员</h1>
        <p className="text-sm text-muted-foreground">
          名单存在服务端的 <code className="rounded bg-muted px-1">data/admins.json</code>，改动立即生效。
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>添加管理员</CardTitle>
            <CardDescription>填入对方的 Phira 用户 ID。ID 可在其个人主页地址里看到。</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-user-id">用户 ID</Label>
              <Input
                id="admin-user-id"
                inputMode="numeric"
                placeholder="例如 1802"
                className="w-48"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void add() }}
              />
            </div>
            <Button onClick={() => void add()} disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              添加
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前管理员（{ids.length}）</CardTitle>
          <CardDescription>至少保留一名管理员，服务端会拒绝移除最后一个。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 加载中
            </div>
          ) : ids.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <UserCog className="size-4" /> 名单为空
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ids.map((id) => {
                  const profile = profiles[id]
                  return (
                    <TableRow key={id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            {profile?.avatar ? <AvatarImage src={profile.avatar} alt="" /> : null}
                            <AvatarFallback>{profile?.name?.slice(0, 1) ?? "?"}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{profile?.name ?? `用户 ${id}`}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{id}</TableCell>
                      <TableCell>
                        {profile?.banned
                          ? <Badge variant="outline" className="border-destructive text-destructive">已封禁</Badge>
                          : <Badge variant="secondary">正常</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={busy || ids.length <= 1}
                          onClick={() => void remove(id)}
                        >
                          <Trash2 className="size-4" />
                          移除
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
