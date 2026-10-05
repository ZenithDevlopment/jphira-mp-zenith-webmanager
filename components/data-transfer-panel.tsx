"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Database, Download, History, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { api, DATA_KINDS, type DataKind } from "@/lib/api"

/** Move every data set between servers, and undo a bad import. */
export function DataTransferPanel({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">数据导入导出</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          导出为 JSON 文件，可在另一台服务器导入或在本地留存备份。每次导入前会自动备份旧数据。
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {DATA_KINDS.map((kind) => (
          <DataCard key={kind.value} kind={kind} canWrite={canWrite} />
        ))}
      </div>
    </div>
  )
}

function DataCard({ kind, canWrite }: { kind: (typeof DATA_KINDS)[number]; canWrite: boolean }) {
  const [merge, setMerge] = useState(true)
  const [busy, setBusy] = useState<"" | "export" | "import">("")
  const [backups, setBackups] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const loadBackups = useCallback(async () => {
    try {
      setBackups((await api.listBackups(kind.value)).backups)
    } catch {
      // Backups are a convenience; a failure here must not block the panel.
    }
  }, [kind.value])

  useEffect(() => { void loadBackups() }, [loadBackups])

  async function exportJson() {
    setBusy("export")
    try {
      const data = await api.exportData(kind.value)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${kind.value}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`${kind.label} 已导出`)
    } catch (reason) {
      toast.error("导出失败", { description: reason instanceof Error ? reason.message : undefined })
    } finally {
      setBusy("")
    }
  }

  async function importFile(file: File) {
    setBusy("import")
    try {
      const content = await file.text()
      const result = await api.importData(kind.value, content, merge)
      toast.success(`${kind.label} 已导入`, {
        description: `共 ${result.total} 条${result.backup ? "，旧数据已备份" : ""}`,
      })
      void loadBackups()
    } catch (reason) {
      toast.error("导入失败", { description: reason instanceof Error ? reason.message : undefined })
    } finally {
      setBusy("")
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function restore(name: string) {
    setBusy("import")
    try {
      await api.restoreBackup(kind.value, name)
      toast.success(`${kind.label} 已恢复到 ${name}`)
    } catch (reason) {
      toast.error("恢复失败", { description: reason instanceof Error ? reason.message : undefined })
    } finally {
      setBusy("")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="size-4" />{kind.label}
        </CardTitle>
        <CardDescription>{kind.hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void exportJson()} disabled={busy !== ""}>
            {busy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}导出
          </Button>

          {canWrite && (
            <>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy !== ""}>
                {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}导入
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importFile(file)
                }}
              />
              <div className="flex items-center gap-2">
                <Switch id={`merge-${kind.value}`} checked={merge} onCheckedChange={setMerge} />
                <Label htmlFor={`merge-${kind.value}`} className="text-xs text-muted-foreground">
                  合并（关闭则整体覆盖）
                </Label>
              </div>
            </>
          )}
        </div>

        {backups.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <History className="size-3.5" />最近备份
            </p>
            <div className="flex flex-wrap gap-1.5">
              {backups.slice(0, 5).map((name) => (
                <button
                  key={name}
                  type="button"
                  disabled={!canWrite || busy !== ""}
                  onClick={() => void restore(name)}
                  className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!canWrite && <Badge variant="secondary">只读账号无法导入</Badge>}
      </CardContent>
    </Card>
  )
}
