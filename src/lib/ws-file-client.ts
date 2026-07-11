'use client'

let ws: WebSocket | null = null
let wsReady = false
let requestId = 0
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()

function getWsPort(): string {
  if (typeof window !== 'undefined') {
    return (window as any).__WS_PORT || process.env.NEXT_PUBLIC_WS_PORT || '3002'
  }
  return '3002'
}

function ensureConnection(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
      resolve()
      return
    }

    const hostname = window.location.hostname
    const wsPort = getWsPort()
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'

    try {
      const socket = new WebSocket(`${protocol}://${hostname}:${wsPort}`)

      socket.onopen = () => {
        ws = socket
        wsReady = true
        resolve()
      }

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(typeof e.data === 'string' ? e.data : e.data.toString())
          if (data.id && pending.has(data.id)) {
            const p = pending.get(data.id)!
            clearTimeout(p.timer)
            pending.delete(data.id)
            p.resolve(data)
          }
        } catch {}
      }

      socket.onclose = () => {
        wsReady = false
        ws = null
        for (const [, p] of pending) {
          clearTimeout(p.timer)
          p.reject(new Error('WebSocket closed'))
        }
        pending.clear()
      }

      socket.onerror = () => {
        wsReady = false
        ws = null
        reject(new Error('WebSocket connection failed'))
      }
    } catch {
      reject(new Error('WebSocket creation failed'))
    }
  })
}

function send(msg: any, timeoutMs = 10000): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureConnection()
    } catch {
      reject(new Error('Cannot connect to local WebSocket server'))
      return
    }

    const id = `ws_${++requestId}_${Date.now()}`
    msg.id = id

    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('WebSocket request timed out'))
    }, timeoutMs)

    pending.set(id, { resolve, reject, timer })
    ws!.send(JSON.stringify(msg))
  })
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export async function wsListFiles(dirPath?: string): Promise<{ tree: FileNode[]; rootPath: string; parentPath: string | null } | null> {
  try {
    const res = await send({ type: 'file:list', path: dirPath })
    return { tree: res.tree || [], rootPath: res.rootPath, parentPath: res.parentPath }
  } catch {
    return null
  }
}

export async function wsReadFile(filePath: string): Promise<string | null> {
  try {
    const res = await send({ type: 'file:read', path: filePath })
    return res.content ?? null
  } catch {
    return null
  }
}

export async function wsFileAction(action: string, targetPath: string, content?: string, newName?: string): Promise<any> {
  try {
    return await send({ type: 'file:action', action, targetPath, content, newName })
  } catch {
    return null
  }
}

export async function wsIsAvailable(): Promise<boolean> {
  try {
    await ensureConnection()
    return true
  } catch {
    return false
  }
}
