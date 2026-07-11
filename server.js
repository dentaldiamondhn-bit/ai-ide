const WebSocket = require('ws')
const { spawn } = require('child_process')
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const url = require('url')
const os = require('os')

const WS_PORT = process.env.NEXT_PUBLIC_WS_PORT || 3002
const wss = new WebSocket.Server({ port: Number(WS_PORT) })

const SKIP_DIRS = ['node_modules', '.git', '.next', 'dist', 'out', '.idea', '.vscode']

async function buildFileTree(dirPath) {
  const result = []
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children: await buildFileTree(fullPath)
        })
      } else {
        result.push({ name: entry.name, path: fullPath, isDirectory: false })
      }
    }
  } catch {}
  return result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

async function handleFileMessage(msg) {
  switch (msg.type) {
    case 'file:list': {
      const tree = await buildFileTree(msg.path || os.homedir())
      return { type: 'file:list', id: msg.id, tree, rootPath: msg.path || os.homedir(), parentPath: path.dirname(msg.path || os.homedir()) }
    }
    case 'file:read': {
      const content = await fsp.readFile(msg.path, 'utf-8')
      return { type: 'file:read', id: msg.id, content }
    }
    case 'file:action': {
      const { action, targetPath, content, newName } = msg
      switch (action) {
        case 'SAVE_FILE':
          await fsp.writeFile(targetPath, content, 'utf-8')
          return { type: 'file:action', id: msg.id, success: true }
        case 'CREATE_FILE':
          await fsp.writeFile(targetPath, '', 'utf-8')
          return { type: 'file:action', id: msg.id, success: true }
        case 'CREATE_FOLDER':
          await fsp.mkdir(targetPath, { recursive: true })
          return { type: 'file:action', id: msg.id, success: true }
        case 'RENAME': {
          const dest = path.join(path.dirname(targetPath), newName)
          await fsp.rename(targetPath, dest)
          return { type: 'file:action', id: msg.id, success: true }
        }
        case 'DELETE':
          await fsp.rm(targetPath, { recursive: true, force: true })
          return { type: 'file:action', id: msg.id, success: true }
        case 'DUPLICATE': {
          const stat = await fsp.stat(targetPath)
          const dir = path.dirname(targetPath)
          const ext = path.extname(targetPath)
          const base = path.basename(targetPath, ext)
          let dupPath = path.join(dir, `${base}-copy${ext}`)
          let counter = 1
          while (await fsp.stat(dupPath).then(() => true).catch(() => false)) {
            counter++
            dupPath = path.join(dir, `${base}-copy${counter}${ext}`)
          }
          if (stat.isDirectory()) await fsp.cp(targetPath, dupPath, { recursive: true })
          else await fsp.copyFile(targetPath, dupPath)
          return { type: 'file:action', id: msg.id, success: true, newPath: dupPath }
        }
        default:
          return { type: 'file:action', id: msg.id, success: false, error: 'Invalid action' }
      }
    }
    default:
      return { type: 'error', id: msg.id, error: 'Unknown message type' }
  }
}

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

  proc.stdout.on('data', (data) => { ws.send(data.toString()) })
  proc.stderr.on('data', (data) => { ws.send(data.toString()) })

  ws.on('message', async (message) => {
    const raw = message.toString()
    // JSON messages = file operations; plain text = terminal input
    if (raw.startsWith('{')) {
      try {
        const msg = JSON.parse(raw)
        if (msg.type && msg.type.startsWith('file:')) {
          const result = await handleFileMessage(msg)
          ws.send(JSON.stringify(result))
          return
        }
      } catch {}
    }
    // Terminal input
    if (proc.stdin.writable) {
      proc.stdin.write(raw)
    }
  })

  ws.on('close', () => {
    if (!proc.killed) proc.kill()
  })
})

console.log(`[ai-ide] WebSocket server running on port ${WS_PORT}`)
