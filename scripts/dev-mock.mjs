import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("./mock-server.mjs", import.meta.url))
const env = { ...process.env, PORT: "3000", DEV_NEXT_PORT: "3001" }
const mock = spawn(process.execPath, [script], { env, stdio: "inherit" })
const nextEnv = { ...process.env, MOCK_API: "true", NEXT_PUBLIC_MOCK_API: "true" }
const next = process.platform === "win32"
  ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "pnpm exec next dev -p 3001"], { env: { ...nextEnv, MOCK_API: "false", DEV_MOCK: "true" }, stdio: "inherit" })
  : spawn("pnpm", ["exec", "next", "dev", "-p", "3001"], { env: { ...nextEnv, MOCK_API: "false", DEV_MOCK: "true" }, stdio: "inherit" })

function stop() { mock.kill(); next.kill() }
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
next.on("exit", (code) => { mock.kill(); process.exit(code ?? 0) })
