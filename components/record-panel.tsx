"use client"

import { useCallback, useEffect, useState } from "react"
import { Crown, Loader2, RefreshCw, Search, Trophy } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, type PlayerRound, type RankEntry, type RoundRecord } from "@/lib/api"

const PAGE_SIZE = 50

/** Rounds are written once when a game ends; this view is read-only by design. */
export function RecordPanel() {
  const [tab, setTab] = useState("rounds")
  const [records, setRecords] = useState<RoundRecord[]>([])
  const [total, setTotal] = useState(0)
  const [roomFilter, setRoomFilter] = useState("")
  const [detail, setDetail] = useState<RoundRecord | null>(null)
  const [loading, setLoading] = useState(false)

  const loadRecords = useCallback(async (roomId?: string) => {
    setLoading(true)
    try {
      const result = await api.records({ limit: PAGE_SIZE, roomId: roomId || undefined })
      setRecords(result.result.records)
      setTotal(result.result.total)
    } catch (reason) {
      toast.error("无法加载比赛记录", { description: reason instanceof Error ? reason.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "rounds") void loadRecords(roomFilter.trim())
  }, [tab, loadRecords, roomFilter])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">比赛记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">每轮游玩结束自动归档，包含全员成绩、积分与排名。</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="rounds">按轮次</TabsTrigger>
              <TabsTrigger value="player">按玩家</TabsTrigger>
              <TabsTrigger value="ranking">积分榜</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "rounds" && (
            <Button variant="outline" size="sm" onClick={() => void loadRecords(roomFilter.trim())} disabled={loading}>
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />刷新
            </Button>
          )}
        </div>
      </div>

      {tab === "rounds" && (
        <>
          <div className="flex items-center gap-2">
            <Input
              placeholder="按房间 ID 过滤..."
              value={roomFilter}
              onChange={(event) => setRoomFilter(event.target.value)}
              className="w-full sm:w-64"
            />
            <Badge variant="secondary">共 {total} 轮</Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">结束时间</TableHead>
                    <TableHead>房间</TableHead>
                    <TableHead>曲目</TableHead>
                    <TableHead className="whitespace-nowrap">人数</TableHead>
                    <TableHead>冠军</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                        {loading ? "加载中..." : "还没有已归档的比赛记录"}
                      </TableCell>
                    </TableRow>
                  )}
                  {records.map((record) => {
                    const winner = record.results.find((result) => result.rank === 1)
                    return (
                      <TableRow key={record.id} className="cursor-pointer" onClick={() => setDetail(record)}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatTime(record.finishedAt)}</TableCell>
                        <TableCell className="font-mono text-xs">{record.roomId}</TableCell>
                        <TableCell className="max-w-[14rem] truncate text-sm" title={record.chartName}>{record.chartName}</TableCell>
                        <TableCell>
                          {record.results.length > 0 ? (
                            record.results.length
                          ) : (
                            <span className="text-xs text-muted-foreground">无人完成</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {winner ? (
                            <span className="flex items-center gap-1.5">
                              <Crown className="size-3.5 text-amber-500" />
                              {winner.playerName}
                              <span className="text-muted-foreground">({winner.score.toLocaleString()})</span>
                            </span>
                          ) : "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "player" && <PlayerHistory />}
      {tab === "ranking" && <PointRanking />}

      <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>本轮成绩</DialogTitle>
            <DialogDescription>
              {detail?.chartName} · 房间 {detail?.roomId} · {detail ? formatTime(detail.finishedAt) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>排名</TableHead>
                  <TableHead>玩家</TableHead>
                  <TableHead>分数</TableHead>
                  <TableHead>准度</TableHead>
                  <TableHead>误差</TableHead>
                  <TableHead>本轮积分</TableHead>
                  <TableHead>总积分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail?.results.map((result) => (
                  <TableRow key={result.playerId}>
                    <TableCell><RankBadge rank={result.rank} /></TableCell>
                    <TableCell className="font-medium">{result.playerName}</TableCell>
                    <TableCell>{result.score.toLocaleString()}</TableCell>
                    <TableCell>{(result.accuracy * 100).toFixed(2)}%</TableCell>
                    <TableCell>±{(result.std * 1000).toFixed(1)}ms</TableCell>
                    <TableCell className="text-emerald-600 dark:text-emerald-400">+{result.gainedPoints}</TableCell>
                    <TableCell>{result.totalPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Looks up one player's rounds by their Phira user id. */
function PlayerHistory() {
  const [input, setInput] = useState("")
  const [rounds, setRounds] = useState<PlayerRound[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  const search = async () => {
    const playerId = Number(input.trim())
    if (!Number.isInteger(playerId) || playerId <= 0) {
      toast.error("请输入有效的玩家 ID")
      return
    }
    setLoading(true)
    try {
      const result = await api.playerRecords(playerId, 100)
      setRounds(result.result.rounds)
      setSearched(true)
      if (result.result.rounds.length === 0) toast.info("该玩家暂无比赛记录")
    } catch (reason) {
      toast.error("查询失败", { description: reason instanceof Error ? reason.message : undefined })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Input
          placeholder="输入玩家 ID（数字）..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void search() }}
          className="w-full sm:w-64"
        />
        <Button onClick={() => void search()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          查询
        </Button>
      </div>
      {searched && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">时间</TableHead>
                  <TableHead>房间</TableHead>
                  <TableHead>曲目</TableHead>
                  <TableHead>排名</TableHead>
                  <TableHead>分数</TableHead>
                  <TableHead>准度</TableHead>
                  <TableHead>本轮积分</TableHead>
                  <TableHead>总积分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">暂无记录</TableCell>
                  </TableRow>
                )}
                {rounds.map((round) => (
                  <TableRow key={round.recordId}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatTime(round.finishedAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{round.roomId}</TableCell>
                    <TableCell className="max-w-[12rem] truncate text-sm" title={round.chartName}>{round.chartName}</TableCell>
                    <TableCell><RankBadge rank={round.result.rank} /></TableCell>
                    <TableCell>{round.result.score.toLocaleString()}</TableCell>
                    <TableCell>{(round.result.accuracy * 100).toFixed(2)}%</TableCell>
                    <TableCell className="text-emerald-600 dark:text-emerald-400">+{round.result.gainedPoints}</TableCell>
                    <TableCell>{round.result.totalPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

/** Cumulative score board across every archived round. */
function PointRanking() {
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const result = await api.pointRanking(100)
        setRanking(result.ranking)
      } catch (reason) {
        toast.error("无法加载积分榜", { description: reason instanceof Error ? reason.message : undefined })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">排名</TableHead>
              <TableHead>玩家</TableHead>
              <TableHead>累计积分</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center"><Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" /></TableCell>
              </TableRow>
            )}
            {!loading && ranking.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground">还没有积分记录</TableCell>
              </TableRow>
            )}
            {ranking.map((entry) => (
              <TableRow key={entry.playerId}>
                <TableCell><RankBadge rank={entry.rank} /></TableCell>
                <TableCell className="font-medium">{entry.name || `#${entry.playerId}`}</TableCell>
                <TableCell>{entry.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500"><Trophy className="size-3" />1</Badge>
  if (rank === 2) return <Badge variant="secondary">2</Badge>
  if (rank === 3) return <Badge variant="secondary">3</Badge>
  return <span className="text-sm text-muted-foreground">{rank}</span>
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false })
}
