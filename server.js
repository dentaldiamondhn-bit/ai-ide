const WebSocket = require('ws')
const { spawn } = require('child_process')
const url = require('url')
const os = require('os')

const WS_PORT = process.env.NEXT_PUBLIC_WS_PORT || 3002
const wss = new WebSocket.Server({ port: Number(WS_PORT) })

wss.on('connection', (ws, req) => {
  const params = url.parse(req.url, true).query
  const initialCwd = params.cwd || process.env.WORKSPACE_DIR || os.homedir()
  const userInfo = `${os.userInfo().username}@${os.hostname()}`
  const homeDir = os.homedir()

  ws.send(`__TERM_INIT__${userInfo}__${homeDir}__${initialCwd}__\n`)

  const isWindows = process.platform === 'win32'
  const shell = isWindows ? 'bash.exe' : '/bin/bash'

  const proc = spawn(shell, ['--login'], {
    cwd: initialCwd,
    env: { ...process.env, TERM: 'xterm-256color' },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  proc.stdout.on('data', (data) => {
    ws.send(data.toString())
  })

  proc.stderr.on('data', (data) => {
    ws.send(data.toString())
  })

  ws.on('message', (message) => {
    if (proc.stdin.writable) {
      proc.stdin.write(message.toString())
    }
  })

  ws.on('close', () => {
    if (!proc.killed) {
      proc.kill()
    }
  })
})
