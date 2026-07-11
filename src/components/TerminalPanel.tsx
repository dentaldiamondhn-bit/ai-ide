'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, X, AlertTriangle, AlertCircle, Terminal as TerminalIcon, FileText, MessageSquare, RefreshCw, Play } from 'lucide-react'

interface TerminalPanelProps {
  cwd?: string | null
  lintResults?: Record<string, { errors: number; warnings: number }>
}

interface ShellInstance {
  id: string
  label: string
  output: string
  input: string
  connected: boolean
  history: string[]
  historyIdx: number
  userHost: string
  homeDir: string
  currentDir: string
  ws: WebSocket | null
}

interface ConsoleLogItem {
  id: string
  type: 'log' | 'warn' | 'error' | 'input' | 'result'
  text: string
  time: string
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
  if (target.startsWith('/')) return target
  if (target.startsWith('~')) return homeDir + target.slice(1)
  return currentDir + '/' + target
}

let shellCounter = 0

export default function TerminalPanel({ cwd, lintResults }: TerminalPanelProps) {
  const [activeTab, setActiveTab] = useState<'terminal' | 'output' | 'console' | 'problems'>('terminal')
  const [shells, setShells] = useState<ShellInstance[]>([])
  const [activeShellId, setActiveShellId] = useState<string>('')
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogItem[]>([])
  const [consoleInput, setConsoleInput] = useState('')
  const [consoleHistory, setConsoleHistory] = useState<string[]>([])
  const [consoleHistoryIdx, setConsoleHistoryIdx] = useState(-1)

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const outputRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const consoleOutputRef = useRef<HTMLDivElement>(null)
  const consoleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error

    const appendConsoleLog = (type: 'log' | 'warn' | 'error', args: any[]) => {
      const text = args.map(arg => {
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg, null, 2) } catch { return String(arg) }
        }
        return String(arg)
      }).join(' ')
      setConsoleLogs(prev => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, type, text, time: new Date().toLocaleTimeString() }
      ].slice(-250))
    }

    console.log = (...args: any[]) => { originalLog.apply(console, args); appendConsoleLog('log', args) }
    console.warn = (...args: any[]) => { originalWarn.apply(console, args); appendConsoleLog('warn', args) }
    console.error = (...args: any[]) => { originalError.apply(console, args); appendConsoleLog('error', args) }

    const handleRuntimeError = (event: ErrorEvent) => {
      appendConsoleLog('error', [`Runtime Error: ${event.message} at ${event.filename}:${event.lineno}`])
    }
    window.addEventListener('error', handleRuntimeError)

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
      window.removeEventListener('error', handleRuntimeError)
    }
  }, [])

  const createShell = useCallback((cwdPath?: string) => {
    shellCounter++
    const id = `shell-${shellCounter}`
    const newShell: ShellInstance = {
      id, label: `bash ${shellCounter}`, output: '', input: '', connected: false,
      history: [], historyIdx: -1, userHost: '', homeDir: '', currentDir: '', ws: null
    }
    setShells(prev => [...prev, newShell])
    setActiveShellId(id)

    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3002'
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws'
    const cwdParam = cwdPath ? `?cwd=${encodeURIComponent(cwdPath)}` : ''
    let ws: WebSocket
    try {
      ws = new WebSocket(`${wsProtocol}://${hostname}:${wsPort}${cwdParam}`)
    } catch {
      setShells(prev => prev.map(s => s.id === id ? { ...s, output: s.output + 'Terminal server not available (WebSocket connection failed)\n' } : s))
      return
    }

    let initParsed = false
    ws.onopen = () => {
      setShells(prev => prev.map(s => s.id === id ? { ...s, connected: true, ws } : s))
      setTimeout(() => inputRefs.current[id]?.focus(), 50)
    }
    ws.onmessage = (e) => {
      const data: string = typeof e.data === 'string' ? e.data : e.data.toString()
      if (!initParsed && data.startsWith('__TERM_INIT__')) {
        const parts = data.split('__')
        if (parts.length >= 5) {
          setShells(prev => prev.map(s => s.id === id ? { ...s, userHost: parts[2], homeDir: parts[3].trim(), currentDir: parts[4].trim() } : s))
        }
        initParsed = true
        return
      }
      setShells(prev => prev.map(s => s.id === id ? { ...s, output: s.output + stripAnsi(data) } : s))
    }
    ws.onerror = () => {
      setShells(prev => prev.map(s => s.id === id ? { ...s, output: s.output + 'Terminal server not reachable\n' } : s))
    }
    ws.onclose = () => {
      setShells(prev => prev.map(s => s.id === id ? { ...s, connected: false } : s))
    }
    setShells(prev => prev.map(s => s.id === id ? { ...s, ws } : s))
  }, [])

  useEffect(() => {
    if (shells.length === 0) createShell(cwd || undefined)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cwd || shells.length === 0) return
    const active = shells.find(s => s.id === activeShellId)
    if (active?.ws && active.ws.readyState === WebSocket.OPEN) {
      active.ws.send(`cd "${cwd}"\n`)
      setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, currentDir: cwd } : s))
    }
  }, [cwd]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ref = outputRefs.current[activeShellId]
    if (ref) ref.scrollTop = ref.scrollHeight
  }, [shells.find(s => s.id === activeShellId)?.output, activeShellId])

  useEffect(() => {
    if (consoleOutputRef.current) consoleOutputRef.current.scrollTop = consoleOutputRef.current.scrollHeight
  }, [consoleLogs, activeTab])

  const closeShell = (id: string) => {
    const shell = shells.find(s => s.id === id)
    if (shell?.ws) shell.ws.close()
    setShells(prev => prev.filter(s => s.id !== id))
    if (activeShellId === id) {
      setShells(prev => {
        const remaining = prev.filter(s => s.id !== id)
        if (remaining.length > 0) setActiveShellId(remaining[0].id)
        return prev
      })
    }
  }

  const handleConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!consoleInput.trim()) return

    const trimmedInput = consoleInput.trim()
    const timeStr = new Date().toLocaleTimeString()

    setConsoleLogs(prev => [...prev, { id: `${Date.now()}-input`, type: 'input', text: trimmedInput, time: timeStr }])
    setConsoleHistory(prev => [...prev, trimmedInput])
    setConsoleHistoryIdx(-1)
    setConsoleInput('')

    let evaluationResult: any
    try {
      evaluationResult = (window as any).eval(trimmedInput)
      let formattedResult = ""
      if (evaluationResult === undefined) formattedResult = "undefined"
      else if (evaluationResult === null) formattedResult = "null"
      else if (typeof evaluationResult === 'object') formattedResult = JSON.stringify(evaluationResult, null, 2)
      else formattedResult = String(evaluationResult)
      setConsoleLogs(prev => [...prev, { id: `${Date.now()}-result`, type: 'result', text: `‹ ${formattedResult}`, time: timeStr }])
    } catch (evalErr: any) {
      setConsoleLogs(prev => [...prev, { id: `${Date.now()}-error`, type: 'error', text: `Uncaught Exception: ${evalErr.message}`, time: timeStr }])
    }
  }

  const handleConsoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (consoleHistory.length === 0) return
      const newIdx = consoleHistoryIdx === -1 ? consoleHistory.length - 1 : Math.max(0, consoleHistoryIdx - 1)
      setConsoleHistoryIdx(newIdx)
      setConsoleInput(consoleHistory[newIdx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (consoleHistoryIdx === -1) return
      const newIdx = consoleHistoryIdx + 1
      if (newIdx >= consoleHistory.length) {
        setConsoleHistoryIdx(-1)
        setConsoleInput('')
      } else {
        setConsoleHistoryIdx(newIdx)
        setConsoleInput(consoleHistory[newIdx])
      }
    }
  }

  const handleSubmit = useCallback((e: React.FormEvent, shellId: string) => {
    e.preventDefault()
    const shell = shells.find(s => s.id === shellId)
    if (!shell || !shell.input.trim() || !shell.connected) return

    const dir = shell.currentDir || shell.homeDir || '~'
    const prompt = shell.userHost ? formatPrompt(shell.userHost, dir, shell.homeDir) : '$ '
    const newOutput = shell.output + prompt + shell.input + '\n'

    let newDir = shell.currentDir
    if (shell.input.startsWith('cd ')) {
      newDir = resolveCdTarget(shell.input, shell.currentDir || shell.homeDir, shell.homeDir)
    }

    shell.ws?.send(shell.input + '\n')

    setShells(prev => prev.map(s => s.id === shellId ? {
      ...s, output: newOutput, input: '', history: [...s.history, shell.input], historyIdx: -1, currentDir: newDir
    } : s))
  }, [shells])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, shellId: string) => {
    const shell = shells.find(s => s.id === shellId)
    if (!shell) return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (shell.history.length === 0) return
      const newIdx = shell.historyIdx === -1 ? shell.history.length - 1 : Math.max(0, shell.historyIdx - 1)
      setShells(prev => prev.map(s => s.id === shellId ? { ...s, historyIdx: newIdx, input: shell.history[newIdx] } : s))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (shell.historyIdx === -1) return
      const newIdx = shell.historyIdx + 1
      if (newIdx >= shell.history.length) {
        setShells(prev => prev.map(s => s.id === shellId ? { ...s, historyIdx: -1, input: '' } : s))
      } else {
        setShells(prev => prev.map(s => s.id === shellId ? { ...s, historyIdx: newIdx, input: shell.history[newIdx] } : s))
      }
    }
  }, [shells])

  const activeShell = shells.find(s => s.id === activeShellId)
  const totalErrors = lintResults ? Object.values(lintResults).reduce((sum, l) => sum + l.errors, 0) : 0
  const totalWarnings = lintResults ? Object.values(lintResults).reduce((sum, l) => sum + l.warnings, 0) : 0
  const problemFiles = lintResults ? Object.entries(lintResults).filter(([, l]) => l.errors > 0 || l.warnings > 0) : []

  const outputLogs = [
    { time: '14:32:01', level: 'info', message: 'Build started...' },
    { time: '14:32:03', level: 'info', message: 'Compiling src/app/page.tsx' },
    { time: '14:32:04', level: 'warn', message: 'Unused import: useEffect in ChatPanel.tsx:3' },
    { time: '14:32:05', level: 'info', message: 'Build completed in 4.2s' },
  ]

  const [refreshing, setRefreshing] = useState<string | null>(null)

  const refreshTab = async (tab: string) => {
    setRefreshing(tab)
    if (tab === 'terminal') {
      const shell = shells.find(s => s.id === activeShellId)
      if (shell?.ws) shell.ws.close()
      setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, output: '', connected: false, ws: null } : s))
      const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3002'
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
      const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws'
      const cwdParam = cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''
      let ws: WebSocket
      try {
        ws = new WebSocket(`${wsProtocol}://${hostname}:${wsPort}${cwdParam}`)
      } catch {
        setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, output: 'Terminal server not available (WebSocket connection failed)\n' } : s))
        setRefreshing(null)
        return
      }
      let initParsed = false
      ws.onopen = () => {
        setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, connected: true, ws } : s))
        setTimeout(() => inputRefs.current[activeShellId]?.focus(), 50)
      }
      ws.onmessage = (e) => {
        const data: string = typeof e.data === 'string' ? e.data : e.data.toString()
        if (!initParsed && data.startsWith('__TERM_INIT__')) {
          const parts = data.split('__')
          if (parts.length >= 5) {
            setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, userHost: parts[2], homeDir: parts[3].trim(), currentDir: parts[4].trim() } : s))
          }
          initParsed = true
          return
        }
        setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, output: s.output + stripAnsi(data) } : s))
      }
      ws.onerror = () => {
        setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, output: s.output + 'Error: Terminal server not reachable\n' } : s))
      }
      ws.onclose = () => {
        setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, connected: false } : s))
      }
      setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, ws } : s))
    } else if (tab === 'console') {
      setConsoleLogs([])
    }
    setTimeout(() => setRefreshing(null), 500)
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#09090b] text-zinc-300 font-sans text-xs">

      {/* Tab bar */}
      <div className="flex items-center border-b border-zinc-800/60 bg-zinc-900/40 shrink-0">
        <div className="flex items-center h-8">
          {(['terminal', 'output', 'console', 'problems'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 h-full text-[11px] font-medium transition-colors relative group ${
                activeTab === tab ? 'text-zinc-100 bg-zinc-800/40' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab === 'terminal' && <TerminalIcon size={12} />}
                {tab === 'output' && <FileText size={12} />}
                {tab === 'console' && <MessageSquare size={12} />}
                {tab === 'problems' && <AlertTriangle size={12} />}
                {tab === 'problems' ? 'Problems' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'problems' && (totalErrors + totalWarnings > 0) && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded font-bold">
                    {totalErrors + totalWarnings}
                  </span>
                )}
              </span>
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-500" />}
            </button>
          ))}
        </div>

        <button
          onClick={() => refreshTab(activeTab)}
          disabled={refreshing !== null}
          className="p-1.5 ml-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors disabled:opacity-40"
          title={activeTab === 'console' ? 'Clear Console' : `Refresh ${activeTab}`}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>

        {activeTab === 'terminal' && (
          <div className="flex items-center ml-2 gap-0.5 h-8">
            {shells.map(shell => (
              <div
                key={shell.id}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                  activeShellId === shell.id ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
                onClick={() => setActiveShellId(shell.id)}
              >
                <span>{shell.label}</span>
                {shells.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeShell(shell.id) }}
                    className="text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => createShell(cwd || undefined)}
              className="ml-1 p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              title="New Terminal"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {/* Terminal tab */}
        {activeTab === 'terminal' && activeShell && (
          <div className="w-full h-full flex flex-col font-mono">
            <div
              ref={(el) => { outputRefs.current[activeShellId] = el }}
              className="flex-1 overflow-y-auto p-2 text-zinc-300 whitespace-pre-wrap select-text selection:bg-sky-500/30"
            >
              {activeShell.output || (
                <span className="text-zinc-600">
                  {activeShell.userHost ? formatPrompt(activeShell.userHost, activeShell.currentDir || activeShell.homeDir, activeShell.homeDir) : '$ '}
                </span>
              )}
            </div>
            <form onSubmit={(e) => handleSubmit(e, activeShellId)} className="flex items-center gap-0 border-t border-zinc-800 px-2 py-1">
              <span className="text-zinc-400 mr-1 shrink-0 whitespace-nowrap">
                {activeShell.userHost ? formatPrompt(activeShell.userHost, activeShell.currentDir || activeShell.homeDir, activeShell.homeDir) : '$ '}
              </span>
              <input
                ref={(el) => { inputRefs.current[activeShellId] = el }}
                type="text"
                value={activeShell.input}
                onChange={(e) => setShells(prev => prev.map(s => s.id === activeShellId ? { ...s, input: e.target.value } : s))}
                onKeyDown={(e) => handleKeyDown(e, activeShellId)}
                className="flex-1 bg-transparent outline-none text-zinc-200 placeholder-zinc-600"
                placeholder={activeShell.connected ? '' : 'disconnected'}
                autoComplete="off"
                spellCheck={false}
                disabled={!activeShell.connected}
              />
            </form>
          </div>
        )}

        {/* Output tab */}
        {activeTab === 'output' && (
          <div className="w-full h-full overflow-y-auto p-3 font-mono text-[11px] space-y-0.5">
            {outputLogs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-600 shrink-0">{log.time}</span>
                <span className={`shrink-0 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-zinc-500'}`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-zinc-400">{log.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Interactive Console tab */}
        {activeTab === 'console' && (
          <div className="w-full h-full flex flex-col font-mono text-[11px]">
            <div
              ref={consoleOutputRef}
              className="flex-1 overflow-y-auto p-3 space-y-1.5 select-text selection:bg-sky-500/30"
            >
              {consoleLogs.length === 0 ? (
                <div className="text-zinc-600 italic text-center pt-8">
                  No execution logs recorded. Type expressions below to evaluate them in the browser environment.
                </div>
              ) : (
                consoleLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-zinc-600 shrink-0 select-none text-[9px] pt-0.5">{log.time}</span>
                    {log.type === 'input' && (
                      <span className="text-sky-400 font-bold shrink-0 select-none">›</span>
                    )}
                    <span className={`whitespace-pre-wrap ${
                      log.type === 'error' ? 'text-rose-400' :
                      log.type === 'warn' ? 'text-amber-400' :
                      log.type === 'result' ? 'text-zinc-500 italic' :
                      'text-zinc-300'
                    }`}>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleConsoleSubmit} className="flex items-center gap-1.5 border-t border-zinc-800 px-3 py-1.5 bg-black/25">
              <span className="text-sky-400 font-bold shrink-0 select-none">›</span>
              <input
                ref={consoleInputRef}
                type="text"
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                onKeyDown={handleConsoleKeyDown}
                className="flex-1 bg-transparent outline-none text-zinc-100 placeholder-zinc-700"
                placeholder="Evaluate JavaScript code... (e.g., 2 + 2 or alert('hi'))"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className="text-zinc-500 hover:text-sky-400 p-0.5 rounded transition-all"
                title="Run command"
              >
                <Play size={11} />
              </button>
            </form>
          </div>
        )}

        {/* Problems tab */}
        {activeTab === 'problems' && (
          <div className="w-full h-full overflow-y-auto">
            {problemFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-xs">
                <AlertCircle size={20} className="mb-2 text-zinc-700" />
                <span>No problems detected</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/40">
                {problemFiles.map(([filePath, result]) => (
                  <div key={filePath} className="px-3 py-1.5">
                    <div className="text-[10px] font-mono text-zinc-400 truncate mb-1">{filePath}</div>
                    <div className="flex gap-3 text-[10px]">
                      {result.errors > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          {result.errors} error{result.errors !== 1 ? 's' : ''}
                        </span>
                      )}
                      {result.warnings > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {result.warnings} warning{result.warnings !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
