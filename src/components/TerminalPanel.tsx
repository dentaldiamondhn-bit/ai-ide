'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import path from 'path'

interface TerminalPanelProps {
  cwd?: string | null
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
}

function formatPrompt(userHost: string, dir: string, homeDir: string): string {
  let displayPath = dir
  if (homeDir && dir.startsWith(homeDir)) {
    displayPath = '~' + dir.slice(homeDir.length)
  }
  return `${userHost}:${displayPath}$ `
}

function resolveCdTarget(input: string, currentDir: string, homeDir: string): string {
  const target = input.replace(/^cd\s+/, '').trim()
  if (!target) return homeDir
  if (target.startsWith('/')) return path.normalize(target)
  if (target.startsWith('~')) return path.join(homeDir, target.slice(1))
  return path.resolve(currentDir, target)
}

export default function TerminalPanel({ cwd }: TerminalPanelProps) {
  const [output, setOutput] = useState('')
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [userHost, setUserHost] = useState('')
  const [homeDir, setHomeDir] = useState('')
  const [currentDir, setCurrentDir] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const lastCwdRef = useRef<string | null | undefined>(null)

  useEffect(() => {
    const cwdParam = cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3002'
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    const ws = new WebSocket(`ws://${hostname}:${wsPort}${cwdParam}`)
    wsRef.current = ws
    let initParsed = false

    ws.onopen = () => {
      setConnected(true)
      inputRef.current?.focus()
    }

    ws.onmessage = (e) => {
      const data: string = typeof e.data === 'string' ? e.data : e.data.toString()

      if (!initParsed && data.startsWith('__TERM_INIT__')) {
        const parts = data.split('__')
        if (parts.length >= 5) {
          setUserHost(parts[2])
          setHomeDir(parts[3].trim())
          setCurrentDir(parts[4].trim())
        }
        initParsed = true
        return
      }

      setOutput(prev => prev + stripAnsi(data))
    }

    ws.onerror = () => {
      setOutput(prev => prev + 'Error: Terminal server not reachable (run npm run dev:terminal)\n')
    }

    ws.onclose = () => {
      setConnected(false)
    }

    return () => {
      ws.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  useEffect(() => {
    if (!cwd || cwd === lastCwdRef.current) return
    lastCwdRef.current = cwd
    setCurrentDir(cwd)
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(`cd "${cwd}"\n`)
    }
  }, [cwd])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !connected) return

    const dir = currentDir || homeDir || '~'
    const prompt = userHost ? formatPrompt(userHost, dir, homeDir) : '$ '

    setOutput(prev => prev + prompt + input + '\n')

    if (input.startsWith('cd ')) {
      setCurrentDir(resolveCdTarget(input, currentDir || homeDir, homeDir))
    }

    setHistory(prev => [...prev, input])
    setHistoryIdx(-1)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(input + '\n')
    }
    setInput('')
  }, [input, connected, userHost, currentDir, homeDir])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1)
      setHistoryIdx(newIdx)
      setInput(history[newIdx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx === -1) return
      const newIdx = historyIdx + 1
      if (newIdx >= history.length) {
        setHistoryIdx(-1)
        setInput('')
      } else {
        setHistoryIdx(newIdx)
        setInput(history[newIdx])
      }
    }
  }, [history, historyIdx])

  const dir = currentDir || homeDir || '~'
  const currentPrompt = userHost ? formatPrompt(userHost, dir, homeDir) : '$ '

  return (
    <div className="w-full h-full flex flex-col bg-[#09090b] font-mono text-sm">
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-2 text-zinc-300 whitespace-pre-wrap select-text selection:bg-sky-500/30"
      >
        {output || <span className="text-zinc-600">{currentPrompt}</span>}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-0 border-t border-zinc-800 px-2 py-1">
        <span className="text-zinc-400 mr-1 shrink-0 whitespace-nowrap">{currentPrompt}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-zinc-200 placeholder-zinc-600"
          placeholder={connected ? '' : 'disconnected'}
          autoComplete="off"
          spellCheck="false"
          disabled={!connected}
        />
      </form>
    </div>
  )
}
