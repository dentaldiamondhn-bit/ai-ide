'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Send, Bot, ChevronDown, X, Loader2, Square,
  FileText, FileEdit, Terminal, CheckCircle2, AlertCircle, ChevronRight, Search,
  Copy, Check, Sparkles, MoreHorizontal, MessageSquare, Clock,
  User, Code2, Plus, History, PanelRight, Zap, Trash2, Lightbulb, ChevronLeft, Paperclip,
  Layers, FolderOpen, Camera, AlertTriangle, Braces, Wrench
} from 'lucide-react'

interface ExecutionEvent {
  type: 'tool_call' | 'tool_result'
  name: string
  args?: Record<string, unknown>
  output?: string
  filesModified?: string[]
  commandsRun?: string[]
  insertions?: number
  deletions?: number
  reasoning?: string
  reasoningDuration?: number
  runningOutput?: string
}

interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string
  isExecuting?: boolean
  events?: ExecutionEvent[]
  filesModified?: string[]
  commandsRun?: string[]
  interrupted?: boolean
  reasoning?: string
  executionDuration?: number
  model?: string
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[]
  tool_call_id?: string
  name?: string
}

interface HistorySnapshot {
  messages: Message[]
  input: string
}

interface FileModificationEvent {
  path: string
  insertions: number
  deletions: number
}

interface ChatPanelProps {
  onRefreshFileTree?: () => void
  onReloadFile?: (filePath: string) => void
  onFileModified?: (event: FileModificationEvent) => void
  activeFilePath?: string | null
  fileTreePath?: string | null
  selectedModel?: string
  onModelChange?: (model: string) => void
  selectedSkill?: string
  onSkillChange?: (skill: string) => void
  openTabs?: { id: string; name: string; path: string }[]
  lintResults?: Record<string, { errors: number; warnings: number }>
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-800 rounded"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-zinc-500" />}
        </button>
      </div>
      <pre className="text-xs font-mono text-zinc-200 p-3 overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">{code}</pre>
    </div>
  )
}

function StepCard({ event, result }: { event: ExecutionEvent & { result?: ExecutionEvent }; result?: ExecutionEvent }) {
  const [collapsed, setCollapsed] = useState(true)
  const isCommand = event.name === 'run_command'
  const isWrite = event.name === 'write_file'

  const commandStr = event.args?.command as string
  const pathStr = (event.args?.path as string) || ''
  const fileName = pathStr.split('/').pop() || pathStr

  const done = !!result
  const error = result?.output?.startsWith('ERROR') || result?.output?.startsWith('COMMAND FAILED') || result?.output?.startsWith('BLOCKED')

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${error ? 'border-rose-900/40' : done ? 'border-zinc-800/60' : 'border-zinc-800/40'}`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-900/50 transition-colors text-left"
      >
        <span className="shrink-0">
          {done ? (
            error ? <AlertCircle size={13} className="text-rose-400" /> : <CheckCircle2 size={13} className="text-emerald-500" />
          ) : (
            <Loader2 size={13} className="text-sky-400 animate-spin" />
          )}
        </span>
        <span className="text-xs font-mono text-zinc-300 truncate flex-1">
          {isCommand ? `$ ${commandStr || ''}` : isWrite ? `✎ ${fileName}` : fileName}
        </span>
        {isWrite && done && (result?.insertions ?? 0) > 0 && (
          <span className="text-[10px] font-mono shrink-0 mr-1">
            <span className="text-emerald-500/90">+{result.insertions}</span>
            {(result?.deletions ?? 0) > 0 && <span className="text-rose-400/90 ml-0.5">-{result.deletions}</span>}
          </span>
        )}
        <span className={`text-zinc-600 transition-transform ${collapsed ? '' : 'rotate-90'}`}>
          <ChevronRight size={12} />
        </span>
      </button>
      {!collapsed && (
        <div className="border-t border-zinc-800/40 bg-black/20">
          {event.reasoning && (
            <details className="group border-b border-zinc-800/30">
              <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300 bg-zinc-900/30">
                <Lightbulb size={11} />
                <span>Reasoning</span>
                {event.reasoningDuration && (
                  <span className="text-zinc-600 text-[10px] font-mono">{Math.round(event.reasoningDuration / 100) / 10}s</span>
                )}
                <ChevronRight size={10} className="ml-auto group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-3 py-2 text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap select-text">
                {event.reasoning}
              </div>
            </details>
          )}
          {done ? (
            <div className="px-3 py-2 space-y-1">
              {isCommand && result?.output ? (
                <div className="bg-black/40 border border-zinc-800/50 rounded text-[11px] font-mono text-zinc-400 p-2 max-h-32 overflow-y-auto whitespace-pre-wrap select-text">
                  {result.output.slice(0, 2000)}
                </div>
              ) : null}
              {isWrite && ((result?.insertions ?? 0) > 0 || (result?.deletions ?? 0) > 0) ? (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  {(result?.insertions ?? 0) > 0 && <span className="text-emerald-500">+{result.insertions} lines</span>}
                  {(result?.deletions ?? 0) > 0 && <span className="text-rose-400">-{result.deletions} lines</span>}
                </div>
              ) : null}
              {!isCommand && !isWrite && result?.output ? (
                <div className="text-[11px] font-mono text-zinc-500">{result.output.split('\n').length} lines</div>
              ) : null}
            </div>
          ) : (
            <div className="px-3 py-2">
              {isCommand && event.runningOutput ? (
                <div className="bg-black/40 border border-zinc-800/50 rounded text-[11px] font-mono text-zinc-400 p-2 max-h-32 overflow-y-auto whitespace-pre-wrap select-text">
                  {event.runningOutput}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  <span>{isCommand ? 'Running...' : isWrite ? 'Writing...' : 'Processing...'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function useAutoResize(ref: React.RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const resize = () => {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    }
    el.addEventListener('input', resize)
    resize()
    return () => el.removeEventListener('input', resize)
  }, [ref])
}

function getModelDisplay(modelId: string) {
  const id = modelId.toLowerCase()
  if (id.includes('deepseek')) return '/icons/deepseek.svg'
  if (id.includes('llama')) return '/icons/meta.svg'
  if (id.includes('mistral') || id.includes('mixtral')) return '/icons/mistral.svg'
  if (id.includes('nemotron')) return '/icons/nvidia.svg'
  if (id.includes('minimax')) return '/icons/minimax.svg'
  if (id.includes('qwen')) return '/icons/qwen.svg'
  if (id.includes('kimi')) return '/icons/kimi.svg'
  if (id.includes('glm')) return '/icons/zhipu.svg'
  if (id.includes('step')) return '/icons/stepfun.svg'
  return '/icons/deepseek.svg'
}

interface HistorySnapshot {
  messages: Message[]
  input: string
  chatId: string
}

export default function ChatPanel({ onRefreshFileTree, onReloadFile, onFileModified, activeFilePath, fileTreePath, selectedModel: modelProp, onModelChange, selectedSkill: skillProp, onSkillChange, openTabs = [], lintResults = {} }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const latestMessages = useRef<Message[]>([])
  latestMessages.current = messages
  const [input, setInput] = useState('')
  const latestInput = useRef('')
  latestInput.current = input
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const executionStartRef = useRef(0)
  const [chatId, setChatId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [currentStatus, setCurrentStatus] = useState('')
  const [savedChats, setSavedChats] = useState<{id: string; title: string}[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyStack, setHistoryStack] = useState<HistorySnapshot[]>([])
  const historyStackRef = useRef<HistorySnapshot[]>([])
  historyStackRef.current = historyStack
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [undoModalOpen, setUndoModalOpen] = useState(false)
  const [pendingUndoIndex, setPendingUndoIndex] = useState(-1)
  const [attachedFiles, setAttachedFiles] = useState<{name: string; path: string; content: string}[]>([])
  const [showFilePicker, setShowFilePicker] = useState(false)
  const fileBtnRef = useRef<HTMLButtonElement>(null)
  const [fileDropPos, setFileDropPos] = useState<{top: number; left: number}>({top: 0, left: 0})
  const [filePickerSearch, setFilePickerSearch] = useState('')
  const [filePickerFiles, setFilePickerFiles] = useState<{name: string; path: string; type: string}[]>([])
  
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [pickerView, setPickerView] = useState<'main' | 'editors' | 'files' | 'skills' | 'problems' | 'sessions' | 'tools'>('main')

  useEffect(() => {
    if (activeFilePath && !recentFiles.includes(activeFilePath)) {
      setRecentFiles(prev => [activeFilePath, ...prev.filter(x => x !== activeFilePath)].slice(0, 8))
    }
  }, [activeFilePath])

  const pushHistory = useCallback((msgs: Message[], inp: string) => {
    setHistoryStack(prevStack => {
      const newStack = prevStack.slice(0, (prevStack.length > 0 ? prevStack.length - 1 : 0) + 1)
      newStack.push({ messages: msgs, input: inp, chatId })
      return newStack.slice(-50)
    })
    setHistoryIndex(prevStack => prevStack + 1)
  }, [chatId])

  function undo(msgIndex: number) {
    const msgs = latestMessages.current
    let userCount = 0
    for (let j = 0; j <= msgIndex && j < msgs.length; j++) {
      if (msgs[j].role === 'user') userCount++
    }
    if (userCount < 1) return
    setPendingUndoIndex(userCount)
    setUndoModalOpen(true)
  }

  function confirmUndo() {
    if (pendingUndoIndex < 0) return
    const currentStack = historyStackRef.current
    if (pendingUndoIndex > currentStack.length) return
    const snapshot = currentStack[pendingUndoIndex - 1]
    if (!snapshot) return
    setHistoryStack(currentStack.slice(0, pendingUndoIndex))
    setMessages(snapshot.messages.slice())
    setInput(snapshot.input)
    setChatId(snapshot.chatId || chatId)
    setHistoryIndex(pendingUndoIndex - 1)
    setPendingUndoIndex(-1)
    setUndoModalOpen(false)
  }

  function redo() {
    const currentStack = historyStackRef.current
    if (historyIndex >= currentStack.length - 1) return
    const nextSnapshot = currentStack[historyIndex + 1]
    if (!nextSnapshot) return
    setMessages(nextSnapshot.messages)
    setInput(nextSnapshot.input)
    setChatId(nextSnapshot.chatId || chatId)
    setHistoryIndex(prev => prev + 1)
  }

  function redoLast() {
    const currentStack = historyStackRef.current
    if (historyIndex >= currentStack.length - 1) return
    const nextSnapshot = currentStack[currentStack.length - 1]
    if (!nextSnapshot) return
    setMessages(nextSnapshot.messages)
    setInput(nextSnapshot.input)
    setChatId(nextSnapshot.chatId || chatId)
    setHistoryIndex(prev => prev + 1)
  }

  useEffect(() => {
    fetch('/api/db/chats')
      .then(r => r.json())
      .then(data => {
        const chats = data.chats || []
        setSavedChats(chats.map((c: any) => ({ id: c.id, title: c.title })))
        const latest = chats.sort((a: any, b: any) =>
          new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        )[0]
        if (latest?.messages?.length > 1) {
          setChatId(latest.id)
          setMessages(latest.messages.map((m: any) => ({ ...m, role: m.role === 'user' ? 'user' as const : 'assistant' as const })))
        }
      })
      .catch(() => {})
  }, [])

  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (msgs.length < 2) return
    const userMsg = msgs.find(m => m.role === 'user')
    const title = userMsg?.content?.slice(0, 50) || 'Chat'
    const id = chatId || `chat_${Date.now()}`
    if (!chatId) setChatId(id)
    try {
      await fetch('/api/db/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: { id, title, messages: msgs } })
      })
    } catch {}
  }, [chatId])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); return }
    const threshold = 150
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, currentStatus])

  const refreshUI = useCallback((allFiles: string[], activeFile: string | null | undefined) => {
    if (!allFiles.length) return
    let shouldRefresh = false
    let shouldReload = false
    for (const f of allFiles) {
      if (f) { shouldRefresh = true }
      if (activeFile && f.includes(activeFile)) { shouldReload = true }
    }
    if (shouldRefresh) onRefreshFileTree?.()
    if (shouldReload && activeFile) onReloadFile?.(activeFile)
  }, [onRefreshFileTree, onReloadFile])

  const [skills, setSkills] = useState<{name: string; description: string; category: string; tags: string[]}[]>([])
  const [categories, setCategories] = useState<{name: string; count: number}[]>([])
  const selectedSkill = skillProp ?? ''
  const [showSkillDropdown, setShowSkillDropdown] = useState(false)

  const estimateTokens = (text: string) => Math.ceil(text.length / 3.5)
  const MAX_TOKENS = 120000

  const tokenCount = useMemo(() => {
    const systemPromptLen = 2000
    const msgTokens = messages.reduce((sum, m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return sum + estimateTokens(content)
    }, 0)
    const inputTokens = estimateTokens(input)
    return systemPromptLen + msgTokens + inputTokens
  }, [messages, input])

  const tokenPct = Math.min((tokenCount / MAX_TOKENS) * 100, 100)
  const tokenColor = tokenPct > 90 ? 'bg-rose-500' : tokenPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
  const tokenTextColor = tokenPct > 90 ? 'text-rose-400' : tokenPct > 70 ? 'text-amber-400' : 'text-zinc-500'
  const skillBtnRef = useRef<HTMLButtonElement>(null)
  const [skillDropPos, setSkillDropPos] = useState<{top: number; left: number}>({top: 0, left: 0})
  const [skillSearch, setSkillSearch] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [recentSkills, setRecentSkills] = useState<string[]>([])

  const [models, setModels] = useState<{id: string; name: string; provider: string}[]>([])
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const modelBtnRef = useRef<HTMLButtonElement>(null)
  const [modelDropPos, setModelDropPos] = useState<{top: number; left: number}>({top: 0, left: 0})
  const selectedModel = modelProp || 'minimaxai/minimax-m3'
  const setSelectedModel = onModelChange || (() => {})

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentSkills')
      if (stored) setRecentSkills(JSON.parse(stored))
    } catch {}
  }, [])

  const addRecentSkill = useCallback((name: string) => {
    setRecentSkills(prev => {
      const next = [name, ...prev.filter(s => s !== name)].slice(0, 5)
      localStorage.setItem('recentSkills', JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(data => {
        if (data.skills) setSkills(data.skills)
        if (data.categories) setCategories(data.categories)
        if (data.models) setModels(data.models)
      })
      .catch(() => {})
  }, [])

  const skillSearchLower = skillSearch.toLowerCase()
  const filteredSkills = skillSearch
    ? skills.filter(s =>
        s.name.toLowerCase().includes(skillSearchLower) ||
        s.description.toLowerCase().includes(skillSearchLower) ||
        s.category.toLowerCase().includes(skillSearchLower) ||
        s.tags.some(t => t.toLowerCase().includes(skillSearchLower))
      )
    : skills

  const filteredByCategory = filteredSkills.reduce<Record<string, typeof filteredSkills>>((acc, skill) => {
    const cat = skill.category || 'uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(skill)
    return acc
  }, {})

  const sortedCategoryNames = Object.keys(filteredByCategory).sort((a, b) => {
    if (a === 'uncategorized') return 1
    if (b === 'uncategorized') return -1
    return a.localeCompare(b)
  })

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const recentSkillObjects = recentSkills
    .map(name => skills.find(s => s.name === name))
    .filter(Boolean) as typeof skills

  useEffect(() => {
    if (!showFilePicker) return
    const root = fileTreePath || ''
    fetch(`/api/files?path=${encodeURIComponent(root)}`)
      .then(r => r.json())
      .then(data => {
        const flatten = (nodes: any[], prefix = ''): {name: string; path: string; type: string}[] => {
          const result: {name: string; path: string; type: string}[] = []
          for (const n of nodes || []) {
            if (n.name.startsWith('.') || n.name === 'node_modules') continue
            if (n.isDirectory) {
              result.push(...flatten(n.children || [], prefix + n.name + '/'))
            } else {
              result.push({ name: n.name, path: n.path, type: 'file' })
            }
          }
          return result
        }
        setFilePickerFiles(flatten(data.tree || []))
      })
      .catch(() => {})
  }, [showFilePicker, fileTreePath])

  const filteredFilePickerFiles = filePickerSearch
    ? filePickerFiles.filter(f => f.name.toLowerCase().includes(filePickerSearch.toLowerCase()) || f.path.toLowerCase().includes(filePickerSearch.toLowerCase()))
    : filePickerFiles

  const attachFile = useCallback(async (filePath: string, fileName: string) => {
    if (attachedFiles.some(f => f.path === filePath)) return
    try {
      const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
      const data = await res.json()
      setAttachedFiles(prev => [...prev, { name: fileName, path: filePath, content: data.content || '' }])
    } catch {}
    setShowFilePicker(false)
    setFilePickerSearch('')
    setPickerView('main')
  }, [attachedFiles])

  const detachFile = useCallback((filePath: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== filePath))
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setAttachedFiles(prev => [...prev, {
        name: `📸 ${file.name}`,
        path: `img-${Date.now()}-${file.name}`,
        content: `[Image attachment of ${file.name} - encoded as: ${reader.result}]`
      }])
    }
    reader.readAsDataURL(file)
    setShowFilePicker(false)
    setPickerView('main')
  }

  const currentModel = models.find(m => m.id === selectedModel)

  async function handleSubmitWithPrompt(prompt: string) {
    if (loading) return

    pushHistory(messages, input)

    let fullContent = prompt
    if (attachedFiles.length > 0) {
      const fileSections = attachedFiles.map(f => `\n\n--- FILE: ${f.path} ---\n${f.content}\n--- END: ${f.path} ---`)
      fullContent = prompt + fileSections.join('')
    }
    const userMessage: Message = { role: 'user', content: fullContent }
    const execMessage: Message = { role: 'assistant', content: '', isExecuting: true, events: [], model: selectedModel }

    setMessages(prev => [...prev, userMessage, execMessage])
    setLoading(true)
    setAttachedFiles([])
    setCurrentStatus('Thinking...')
    executionStartRef.current = Date.now()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => {
            const msg: Record<string, any> = { role: m.role, content: m.content }
            if (m.tool_calls) msg.tool_calls = m.tool_calls
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
            if (m.name) msg.name = m.name
            return msg
          }),
          skill: selectedSkill || undefined,
          model: selectedModel || undefined,
          fileTreePath: fileTreePath || undefined,
          activeFilePath: activeFilePath || undefined
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalFiles: string[] = []
      let finalCommands: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)

            if (event.type === 'status') {
              setCurrentStatus(event.content as string)
            } else if (event.type === 'reasoning') {
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting) {
                  return [...prev.slice(0, -1), { ...last, reasoning: (last.reasoning || '') + (event.content as string) }]
                }
                return prev
              })
            } else if (event.type === 'tool_call') {
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting) {
                  return [...prev.slice(0, -1), {
                    ...last,
                    events: [...(last.events || []), { type: 'tool_call', name: event.name, args: event.args, reasoning: event.reasoning }]
                  }]
                }
                return prev
              })
            } else if (event.type === 'tool_output') {
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting && last.events) {
                  const events = [...last.events]
                  const lastToolCall = events[events.length - 1]
                  if (lastToolCall && lastToolCall.type === 'tool_call') {
                    lastToolCall.runningOutput = (lastToolCall.runningOutput || '') + (event.content as string)
                  }
                  return [...prev.slice(0, -1), { ...last, events }]
                }
                return prev
              })
            } else if (event.type === 'tool_result') {
              const animData = event.animationData as FileModificationEvent[] | undefined
              if (animData && onFileModified) {
                for (const ev of animData) onFileModified(ev)
              }
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting) {
                  const events = [...(last.events || [])]
                  events.push({ type: 'tool_result', name: event.name, args: event.args, output: event.output, insertions: event.insertions, deletions: event.deletions })
                  return [...prev.slice(0, -1), { ...last, events }]
                }
                return prev
              })
            } else if (event.type === 'done') {
              finalFiles = (event.filesModified as string[]) || []
              finalCommands = (event.commandsRun as string[]) || []
              const totalExecutionTime = executionStartRef.current ? Date.now() - executionStartRef.current : 0
              executionStartRef.current = 0

              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting) {
                  const updated: Message[] = [...prev.slice(0, -1), {
                    role: 'assistant' as const,
                    content: event.content as string,
                    events: last.events,
                    filesModified: finalFiles,
                    commandsRun: finalCommands,
                    interrupted: !!event.interrupted,
                    executionDuration: totalExecutionTime,
                    model: last.model
                  }]
                  setTimeout(() => saveConversation(updated), 100)
                  if (event.interrupted) {
                    setTimeout(() => {
                      handleAutoContinue()
                    }, 800)
                  }
                  return updated
                }
                return prev
              })
              setCurrentStatus('')
            } else if (event.type === 'error') {
              const errMsg = (event.content as string) || 'Unknown error occurred'
              setMessages(prev => {
                const updated: Message[] = [...prev, { role: 'assistant' as const, content: `**Error:** ${errMsg}` }]
                setTimeout(() => saveConversation(updated), 100)
                return updated
              })
              setCurrentStatus('')
              setLoading(false)
              return
            }
          } catch (e: any) {
            if (e.message !== "Unexpected end of JSON input") {
              console.error('Parse error:', e, line)
            }
          }
        }
      }

      refreshUI(finalFiles, activeFilePath)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.isExecuting) {
            const updated: Message[] = [...prev.slice(0, -1), { role: 'assistant' as const, content: 'Stopped by user.', events: last.events, model: last.model }]
            setTimeout(() => saveConversation(updated), 100)
            return updated
          }
          return prev
        })
        setCurrentStatus('')
        setLoading(false)
        abortRef.current = null
        return
      }
      console.error('Chat error:', err)

      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.isExecuting) {
          const updated: Message[] = [...prev.slice(0, -1), { role: 'assistant' as const, content: `Error: ${err.message}`, events: last.events, model: last.model }]
          setTimeout(() => saveConversation(updated), 100)
          return updated
        }
        const updated: Message[] = [...prev, { role: 'assistant' as const, content: `Error: ${err.message}` }]
        setTimeout(() => saveConversation(updated), 100)
        return updated
      })
      setCurrentStatus('')
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  async function handleAutoContinue() {
    const continuationPrompt = 'Continue from where you left off. Do not re-read files you have already read. Resume the task using the context you already have.'
    await handleSubmitWithPrompt(continuationPrompt)
  }

  async function handleSubmit() {
    if (!input.trim() || loading) return

    pushHistory(messages, input)

    let fullContent = input
    if (attachedFiles.length > 0) {
      const fileSections = attachedFiles.map(f => `\n\n--- FILE: ${f.path} ---\n${f.content}\n--- END: ${f.path} ---`)
      fullContent = input + fileSections.join('')
    }
    const userMessage: Message = { role: 'user', content: fullContent }
    const execMessage: Message = { role: 'assistant', content: '', isExecuting: true, events: [], model: selectedModel }

    setMessages(prev => [...prev, userMessage, execMessage])
    setLoading(true)
    setInput('')
    setAttachedFiles([])
    setCurrentStatus('Thinking...')
    executionStartRef.current = Date.now()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => {
            const msg: Record<string, any> = { role: m.role, content: m.content }
            if (m.tool_calls) msg.tool_calls = m.tool_calls
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
            if (m.name) msg.name = m.name
            return msg
          }),
          skill: selectedSkill || undefined,
          model: selectedModel || undefined,
          fileTreePath: fileTreePath || undefined,
          activeFilePath: activeFilePath || undefined
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalFiles: string[] = []
      let finalCommands: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)

            if (event.type === 'status') {
              setCurrentStatus(event.content as string)
            } else if (event.type === 'reasoning') {
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting) {
                  return [...prev.slice(0, -1), { ...last, reasoning: (last.reasoning || '') + (event.content as string) }]
                }
                return prev
              })
            } else if (event.type === 'tool_call') {
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting) {
                  return [...prev.slice(0, -1), {
                    ...last,
                    events: [...(last.events || []), { type: 'tool_call', name: event.name, args: event.args, reasoning: event.reasoning }]
                  }]
                }
                return prev
              })
            } else if (event.type === 'tool_output') {
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting && last.events) {
                  const events = [...last.events]
                  const lastToolCall = events[events.length - 1]
                  if (lastToolCall && lastToolCall.type === 'tool_call') {
                    lastToolCall.runningOutput = (lastToolCall.runningOutput || '') + (event.content as string)
                  }
                  return [...prev.slice(0, -1), { ...last, events }]
                }
                return prev
              })
            } else if (event.type === 'tool_result') {
              const animData = event.animationData as FileModificationEvent[] | undefined
              if (animData && onFileModified) {
                for (const ev of animData) onFileModified(ev)
              }
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting) {
                  const events = [...(last.events || [])]
                  events.push({ type: 'tool_result', name: event.name, args: event.args, output: event.output, insertions: event.insertions, deletions: event.deletions })
                  return [...prev.slice(0, -1), { ...last, events }]
                }
                return prev
              })
            } else if (event.type === 'done') {
              finalFiles = (event.filesModified as string[]) || []
              finalCommands = (event.commandsRun as string[]) || []
              const totalExecutionTime = executionStartRef.current ? Date.now() - executionStartRef.current : 0
              executionStartRef.current = 0

              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.isExecuting) {
                  const updated: Message[] = [...prev.slice(0, -1), {
                    role: 'assistant' as const,
                    content: event.content as string,
                    events: last.events,
                    filesModified: finalFiles,
                    commandsRun: finalCommands,
                    interrupted: !!event.interrupted,
                    executionDuration: totalExecutionTime,
                    model: last.model
                  }]
                  setTimeout(() => saveConversation(updated), 100)
                  if (event.interrupted) {
                    setTimeout(() => {
                      handleAutoContinue()
                    }, 800)
                  }
                  return updated
                }
                return prev
              })
              setCurrentStatus('')
            } else if (event.type === 'error') {
              const errMsg = (event.content as string) || 'Unknown error occurred'
              setMessages(prev => {
                const updated: Message[] = [...prev, { role: 'assistant' as const, content: `**Error:** ${errMsg}` }]
                setTimeout(() => saveConversation(updated), 100)
                return updated
              })
              setCurrentStatus('')
              setLoading(false)
              return
            }
          } catch (e: any) {
            if (e.message !== "Unexpected end of JSON input") {
              console.error('Parse error:', e, line)
            }
          }
        }
      }

      refreshUI(finalFiles, activeFilePath)
    } catch (err: any) {
      if (err.name === 'AbortError') {
setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.isExecuting) {
          const updated: Message[] = [...prev.slice(0, -1), { role: 'assistant' as const, content: 'Stopped by user.', events: last.events, model: last.model }]
          setTimeout(() => saveConversation(updated), 100)
          return updated
        }
        return prev
      })
        setCurrentStatus('')
        setLoading(false)
        abortRef.current = null
        return
      }
      console.error('Chat error:', err)

      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.isExecuting) {
          const updated: Message[] = [...prev.slice(0, -1), { role: 'assistant' as const, content: `Error: ${err.message}`, events: last.events, model: last.model }]
          setTimeout(() => saveConversation(updated), 100)
          return updated
        }
        const updated: Message[] = [...prev, { role: 'assistant' as const, content: `Error: ${err.message}` }]
        setTimeout(() => saveConversation(updated), 100)
        return updated
      })
      setCurrentStatus('')
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const newChat = () => {
    setMessages([])
    setChatId('')
    setShowHistory(false)
  }

  const loadChat = (id: string, title: string) => {
    fetch('/api/db/chats')
      .then(r => r.json())
      .then(data => {
        const chats = data.chats || []
        const found = chats.find((c: any) => c.id === id)
        if (found?.messages) {
          setChatId(found.id)
          setMessages(found.messages.map((m: any) => ({ ...m, role: m.role === 'user' ? 'user' as const : 'assistant' as const })))
          setShowHistory(false)
        }
      })
      .catch(() => {})
  }

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch('/api/db/chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      setSavedChats(prev => prev.filter(c => c.id !== id))
      if (chatId === id) newChat()
    } catch {}
  }

  const formatContent = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const parts: { type: string; content: string; language?: string }[] = []
    let lastIndex = 0
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
      }
      parts.push({ type: 'code', language: match[1] || 'text', content: match[2] })
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) })
    }

    return parts
  }

  const redoCount = historyIndex >= 0 ? historyStack.length - historyIndex - 1 : 0

    const redoBadge = redoCount > 0 ? (
      <div className="mb-3 flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <History size={14} className="text-amber-400" />
        <span className="text-xs text-amber-300 font-mono">
          {redoCount} message{redoCount > 1 ? 's' : ''} undone
        </span>
        <button
          onClick={redoLast}
          className="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded transition-colors"
        >
          Redo All
        </button>
        <button
          onClick={redo}
          className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
        >
          Redo Last
        </button>
      </div>
    ) : null

  const undoModal = undoModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={20} className="text-amber-400" />
          <h3 className="text-lg font-semibold text-zinc-100">Undo Changes</h3>
        </div>
        <p className="text-zinc-300 mb-6">
          This will undo all changes made after the selected message, including any file edits and tool runs. This action cannot be redone unless you use the redo buttons.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => { setUndoModalOpen(false); setPendingUndoIndex(-1) }}
            className="px-4 py-2 text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmUndo}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-lg transition-colors"
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="flex flex-col h-full bg-zinc-950 min-w-0">
      {/* Header */}
      <div className="h-10 bg-zinc-950 border-b border-zinc-800/50 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <img src={getModelDisplay(selectedModel)} className="w-5 h-5 shrink-0" alt="" />
          <span className="text-xs font-semibold text-zinc-200">{currentModel?.name || 'Cascade'}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 rounded transition-colors ${showHistory ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
            title="Chat history"
          >
            <History size={14} />
          </button>
          <button
            onClick={newChat}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            title="New Chat"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="border-b border-zinc-800/50 bg-zinc-950 animate-in slide-in-from-top-1 duration-150">
          <div className="p-2 max-h-48 overflow-y-auto space-y-0.5">
            {savedChats.length === 0 ? (
              <div className="px-2 py-3 text-xs text-zinc-600 text-center">No chat history</div>
            ) : (
              savedChats.map(c => (
                <div
                  key={c.id}
                  onClick={() => loadChat(c.id, c.title)}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    c.id === chatId ? 'bg-zinc-800/60 text-zinc-200' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <MessageSquare size={12} className="shrink-0 text-zinc-600" />
                  <span className="truncate flex-1">{c.title}</span>
                  <button
                    onClick={(e) => deleteChat(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-rose-400 transition-all"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scroll-smooth">
        {redoBadge}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-3">
              <Sparkles size={18} className="text-sky-400" />
            </div>
            <p className="text-sm text-zinc-500 max-w-xs">Ask me anything about your codebase</p>
            <p className="text-xs text-zinc-700 mt-1">I can help you build, debug, and refactor</p>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((msg, i) => (
              <div key={i} className="px-4 py-3 hover:bg-zinc-900/30 transition-colors">
                {msg.role === 'user' ? (
                  <div className="flex items-start gap-3 max-w-3xl">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-sky-500/20">
                      <User size={13} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-medium text-zinc-400">You</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigator.clipboard.writeText(msg.content)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="Copy"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            onClick={() => undo(i)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="Undo"
                          >
                            <ChevronLeft size={12} />
                          </button>
      </div>
      {undoModal}
    </div>
                      <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap select-text break-words">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 max-w-3xl">
                    <img src={getModelDisplay(msg.model || selectedModel)} className="w-6 h-6 shrink-0 mt-1" alt="" />
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="text-xs font-medium text-zinc-500 mb-1.5">
                        {msg.isExecuting ? 'Working...' : 'Cascade'}
                      </div>

                      {/* Reasoning block (streaming or final) */}
                      {msg.reasoning && (
                        <details className="group mb-2" open={msg.isExecuting}>
                          <summary className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
                            <Lightbulb size={11} />
                            <span>Reasoning</span>
                            <ChevronRight size={10} className="ml-auto group-open:rotate-90 transition-transform" />
                          </summary>
                          <div className="mt-1.5 text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap select-text bg-zinc-900/40 border border-zinc-800/30 rounded-lg p-2 max-h-[300px] overflow-y-auto">
                            {msg.reasoning}
                          </div>
                        </details>
                      )}

                      {/* Execution steps */}
                      {msg.events && msg.events.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {msg.events.reduce<(ExecutionEvent & { result?: ExecutionEvent })[]>((acc, ev, idx) => {
                            if (ev.type === 'tool_call') {
                              acc.push({ ...ev, result: undefined })
                            } else if (ev.type === 'tool_result' && acc.length > 0) {
                              acc[acc.length - 1].result = ev
                            }
                            return acc
                          }, []).map((step, idx) => (
                            <StepCard key={idx} event={step} result={step.result} />
                          ))}
                        </div>
                      )}

                      {/* Status during execution */}
                      {msg.isExecuting && currentStatus && (
                        <div className="flex items-center gap-2 text-xs text-zinc-500 py-1">
                          <div className="flex items-center gap-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0ms]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:150ms]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:300ms]" />
                          </div>
                          <span>{currentStatus}</span>
                        </div>
                      )}

                      {/* Final content */}
                      {!msg.isExecuting && msg.content && (
                        <div className="text-sm text-zinc-200 leading-relaxed select-text space-y-1">
                          {formatContent(msg.content).map((part, idx) => (
                            part.type === 'code' ? (
                              <CodeBlock key={idx} code={part.content} language={part.language || 'text'} />
                            ) : (
                              <p key={idx} className="whitespace-pre-wrap break-words leading-relaxed">{part.content}</p>
                            )
                          ))}
                        </div>
                      )}

                      {/* Summary footer */}
                      {!msg.isExecuting && (msg.filesModified || msg.commandsRun || msg.interrupted || msg.executionDuration) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-zinc-800/30">
                          {msg.filesModified && msg.filesModified.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                              <FileEdit size={10} />
                              {msg.filesModified.length} file{msg.filesModified.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {msg.filesModified?.slice(0, 3).map((f, fi) => {
                            const name = f.split('/').pop() || f
                            return (
                              <span key={fi} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 text-[10px] font-mono">
                                <FileText size={9} />
                                <span className="max-w-[100px] truncate">{name}</span>
                              </span>
                            )
                          })}
                          {msg.filesModified && msg.filesModified.length > 3 && (
                            <span className="text-[10px] text-zinc-600 font-mono">+{msg.filesModified.length - 3} more</span>
                          )}
                          {msg.commandsRun && msg.commandsRun.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-mono">
                              <Terminal size={10} />
                              {msg.commandsRun.length} cmd
                            </span>
                          )}
                          {msg.executionDuration && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/50 text-zinc-500 text-[10px] font-mono">
                              <Clock size={10} />
                              {Math.round(msg.executionDuration / 100) / 10}s
                            </span>
                          )}
                          {msg.interrupted && (
                            <span className="text-[10px] text-amber-400 font-mono">max steps reached</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 bg-zinc-950 border-t border-zinc-800/30">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 focus-within:border-zinc-600/60 transition-all shadow-sm">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {attachedFiles.map(f => (
                <span key={f.path} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-700">
                  <FileText size={10} className="text-zinc-500 shrink-0" />
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => detachFile(f.path)} className="text-zinc-500 hover:text-zinc-300 ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
<textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Ask me to build, fix, or explore your code..."
              className="w-full bg-transparent border-none outline-none text-sm text-zinc-200 px-4 py-3 resize-y min-h-[42px] max-h-[300px] placeholder:text-zinc-600"
              rows={1}
            />

          {/* Token counter */}
          <div className="px-3 flex items-center gap-2">
            <div className="flex-1 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${tokenColor}`} style={{ width: `${tokenPct}%` }} />
            </div>
            <span className={`text-[10px] tabular-nums ${tokenTextColor}`}>
              {(tokenCount / 1000).toFixed(1)}k / {(MAX_TOKENS / 1000).toFixed(0)}k
            </span>
          </div>

          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-1.5">
              {/* Model selector */}
              <div className="relative">
                <button
                  ref={modelBtnRef}
                  onClick={() => {
                    if (!showModelDropdown && modelBtnRef.current) {
                      const r = modelBtnRef.current.getBoundingClientRect()
                      const dropW = 224
                      const left = r.left + dropW > window.innerWidth ? window.innerWidth - dropW - 8 : r.left
                      setModelDropPos({ top: r.top - 4, left })
                    }
                    setShowModelDropdown(!showModelDropdown)
                  }}
                  className="text-[10px] px-2 py-1 rounded-md bg-zinc-800/60 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                >
                  <img src={getModelDisplay(selectedModel)} className="w-3.5 h-3.5 shrink-0" alt="" />
                  <span className="max-w-[80px] truncate">{currentModel?.name || 'Model'}</span>
                  <ChevronDown size={9} />
                </button>
                {showModelDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)} />
                    <div className="fixed z-50 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 max-h-60 overflow-y-auto" style={{ top: modelDropPos.top, left: modelDropPos.left, transform: 'translateY(-100%)' }}>
                      {models.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedModel(m.id); setShowModelDropdown(false) }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 flex items-center gap-2 ${
                            selectedModel === m.id ? 'text-sky-300 bg-sky-500/10' : 'text-zinc-400'
                          }`}
                        >
                          <img src={getModelDisplay(m.id)} className="w-4 h-4 shrink-0" alt="" />
                          <span className="text-[10px] text-zinc-600 font-mono w-10">{m.provider}</span>
                          <span className="truncate">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Skill selector */}
              <div className="relative">
                <button
                  ref={skillBtnRef}
                  onClick={() => {
                    if (!showSkillDropdown && skillBtnRef.current) {
                      const r = skillBtnRef.current.getBoundingClientRect()
                      const dropW = 320
                      const left = r.left + dropW > window.innerWidth ? window.innerWidth - dropW - 8 : r.left
                      setSkillDropPos({ top: r.top - 4, left })
                    }
                    setShowSkillDropdown(!showSkillDropdown)
                  }}
                  className={`text-[10px] px-2 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    selectedSkill
                      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20'
                      : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <Zap size={10} className={selectedSkill ? 'text-sky-400' : 'text-zinc-500'} />
                  <span className="max-w-[60px] truncate">{selectedSkill || 'Agent'}</span>
                  <ChevronDown size={9} />
                </button>
                {showSkillDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => { setShowSkillDropdown(false); setSkillSearch('') }} />
                    <div className="fixed z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl max-h-[420px] flex flex-col" style={{ top: skillDropPos.top, left: skillDropPos.left, transform: 'translateY(-100%)' }}>
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                        <Search size={12} className="text-zinc-500 shrink-0" />
                        <input
                          value={skillSearch}
                          onChange={e => setSkillSearch(e.target.value)}
                          placeholder="Search by name, description, category, tag..."
                          className="bg-transparent border-none outline-none text-xs text-zinc-200 w-full placeholder:text-zinc-600"
                          autoFocus
                        />
                        {skillSearch && (
                          <button onClick={() => setSkillSearch('')} className="text-zinc-500 hover:text-zinc-300">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {/* Clear skill */}
                        <button
                          onClick={() => { onSkillChange?.(''); setShowSkillDropdown(false); setSkillSearch('') }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 flex items-center gap-2 ${
                            !selectedSkill ? 'text-sky-300' : 'text-zinc-400'
                          }`}
                        >
                          Default (no skill)
                        </button>

                        {/* Recently used */}
                        {!skillSearch && recentSkillObjects.length > 0 && (
                          <>
                            <div className="px-3 pt-2 pb-1 text-[10px] text-zinc-600 font-medium uppercase tracking-wider flex items-center gap-1.5">
                              <Clock size={10} /> Recent
                            </div>
                            {recentSkillObjects.map(skill => (
                              <button
                                key={`recent-${skill.name}`}
                                onClick={() => { onSkillChange?.(skill.name); addRecentSkill(skill.name); setShowSkillDropdown(false); setSkillSearch('') }}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                                  selectedSkill === skill.name ? 'text-sky-300 bg-sky-500/10' : 'text-zinc-400'
                                }`}
                              >
                                <div className="truncate">{skill.name}</div>
                                {skill.description && <div className="text-[10px] text-zinc-600 truncate mt-0.5">{skill.description}</div>}
                              </button>
                            ))}
                            <div className="mx-3 border-b border-zinc-800/50" />
                          </>
                        )}

                        {/* Categorized skills */}
                        {sortedCategoryNames.length === 0 && (
                          <div className="px-3 py-4 text-xs text-zinc-600 text-center">No skills found</div>
                        )}
                        {sortedCategoryNames.map(cat => {
                          const isCollapsed = collapsedCategories.has(cat) && !!skillSearch === false
                          const catSkills = filteredByCategory[cat]
                          return (
                            <div key={cat}>
                              <button
                                onClick={() => toggleCategory(cat)}
                                className="w-full text-left px-3 py-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider hover:bg-zinc-800/50 flex items-center gap-1.5 sticky top-0 bg-zinc-900/95 backdrop-blur-sm"
                              >
                                <ChevronRight size={10} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                                <span className="truncate">{cat}</span>
                                <span className="ml-auto text-zinc-700 font-normal normal-case">{catSkills.length}</span>
                              </button>
                              {!isCollapsed && catSkills.map(skill => (
                                <button
                                  key={skill.name}
                                  onClick={() => { onSkillChange?.(skill.name); addRecentSkill(skill.name); setShowSkillDropdown(false); setSkillSearch('') }}
                                  className={`w-full text-left px-3 pl-6 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                                    selectedSkill === skill.name ? 'text-sky-300 bg-sky-500/10' : 'text-zinc-400'
                                  }`}
                                >
                                  <div className="truncate">{skill.name}</div>
                                  {skill.description && (
                                    <div className="text-[10px] text-zinc-600 truncate mt-0.5 max-w-full">{skill.description}</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )
                        })}
                        {filteredSkills.length > 0 && (
                          <div className="px-3 py-2 text-[10px] text-zinc-600 text-center border-t border-zinc-800">
                            {filteredSkills.length} of {skills.length} skills
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Attach file */}
              <div className="relative">
                <button
                  ref={fileBtnRef}
                  onClick={() => {
                    if (!showFilePicker && fileBtnRef.current) {
                      const r = fileBtnRef.current.getBoundingClientRect()
                      const dropW = 320
                      const left = r.left + dropW > window.innerWidth ? window.innerWidth - dropW - 8 : r.left
                      setFileDropPos({ top: r.top - 4, left })
                    }
                    setShowFilePicker(!showFilePicker)
                    setPickerView('main')
                  }}
                  className="text-[10px] px-2 py-1 rounded-md bg-zinc-800/60 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                  title="Attach file"
                >
                  <Paperclip size={11} />
                </button>
                {showFilePicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => { setShowFilePicker(false); setFilePickerSearch(''); setPickerView('main') }} />
                    <div className="fixed z-50 w-80 bg-[#09090b] border border-zinc-800 rounded-lg shadow-2xl max-h-[420px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150" style={{ top: fileDropPos.top, left: fileDropPos.left, transform: 'translateY(-100%)' }}>
                      
                      {/* Search Header */}
                      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/60 bg-black/40">
                        <Search size={12} className="text-zinc-500 shrink-0" />
                        <input
                          value={filePickerSearch}
                          onChange={e => setFilePickerSearch(e.target.value)}
                          placeholder="Search attachments..."
                          className="bg-transparent border-none outline-none text-xs text-zinc-100 w-full placeholder:text-zinc-600 font-sans"
                          autoFocus
                        />
                        {filePickerSearch && (
                          <button onClick={() => setFilePickerSearch('')} className="text-zinc-500 hover:text-zinc-300">
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      <div className="overflow-y-auto flex-1 custom-scrollbar py-1">
                        
                        {/* VIEW 1: Main Category Hub */}
                        {pickerView === 'main' && !filePickerSearch && (
                          <div className="space-y-0.5">
                            
                            <button
                              onClick={() => setPickerView('editors')}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-600/10 hover:text-sky-400 text-zinc-300 transition-colors flex items-center gap-2.5"
                            >
                              <Layers size={13} className="text-zinc-500 hover:text-sky-400 shrink-0" />
                              <span className="font-medium">Open Editors</span>
                              <span className="ml-auto text-[10px] text-zinc-600 font-mono">({openTabs.length})</span>
                            </button>

                            <button
                              onClick={() => setPickerView('files')}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-600/10 hover:text-sky-400 text-zinc-300 transition-colors flex items-center gap-2.5"
                            >
                              <FolderOpen size={13} className="text-zinc-500 hover:text-sky-400 shrink-0" />
                              <span className="font-medium">Files & Folders...</span>
                            </button>

                            <button
                              onClick={() => setPickerView('skills')}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-600/10 hover:text-sky-400 text-zinc-300 transition-colors flex items-center gap-2.5"
                            >
                              <Sparkles size={13} className="text-zinc-500 hover:text-sky-400 shrink-0" />
                              <span className="font-medium">Instructions...</span>
                            </button>

                            <label
                              htmlFor="screenshot-uploader"
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-600/10 hover:text-sky-400 text-zinc-300 transition-colors flex items-center gap-2.5 cursor-pointer"
                            >
                              <Camera size={13} className="text-zinc-500 shrink-0" />
                              <span className="font-medium">Screenshot</span>
                            </label>

                            <button
                              onClick={() => setPickerView('problems')}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-600/10 hover:text-sky-400 text-zinc-300 transition-colors flex items-center gap-2.5"
                            >
                              <AlertTriangle size={13} className="text-zinc-500 hover:text-sky-400 shrink-0" />
                              <span className="font-medium">Problems...</span>
                            </button>

                            <button
                              onClick={() => {
                                if (activeFilePath) {
                                  setInput(prev => `Trace file exports and active declarations inside this symbol context: \n${prev}`)
                                  attachFile(activeFilePath, activeFilePath.split('/').pop() || activeFilePath)
                                } else {
                                  alert('Open a file first to parse local symbols.')
                                }
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-600/10 hover:text-sky-400 text-zinc-300 transition-colors flex items-center gap-2.5"
                            >
                              <Braces size={13} className="text-zinc-500 hover:text-sky-400 shrink-0" />
                              <span className="font-medium">Symbols...</span>
                            </button>

                            <button
                              onClick={() => setPickerView('sessions')}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-600/10 hover:text-sky-400 text-zinc-300 transition-colors flex items-center gap-2.5"
                            >
                              <History size={13} className="text-zinc-500 hover:text-sky-400 shrink-0" />
                              <span className="font-medium">Sessions...</span>
                            </button>

                            <button
                              onClick={() => setPickerView('tools')}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-600/10 hover:text-sky-400 text-zinc-300 transition-colors flex items-center gap-2.5"
                            >
                              <Wrench size={13} className="text-zinc-500 hover:text-sky-400 shrink-0" />
                              <span className="font-medium">Tools...</span>
                            </button>

                            <div className="px-3 pt-3 pb-1 text-[9px] font-bold text-zinc-600 uppercase tracking-wider">
                              recently opened
                            </div>

                            {recentFiles.length === 0 ? (
                              <div className="px-3 py-2 text-[10px] text-zinc-600 italic">No recently edited files</div>
                            ) : (
                              recentFiles.map(pathStr => {
                                const name = pathStr.split('/').pop() || pathStr
                                const parent = pathStr.split('/').slice(-2, -1)[0] || 'workspace'
                                const isAttached = attachedFiles.some(a => a.path === pathStr)
                                return (
                                  <button
                                    key={pathStr}
                                    onClick={() => !isAttached && attachFile(pathStr, name)}
                                    className={`w-full text-left px-3 py-1 text-xs transition-colors hover:bg-zinc-900 flex items-center gap-2 ${isAttached ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  >
                                    <FileText size={12} className="text-sky-500/80 shrink-0" />
                                    <span className="truncate text-zinc-300 font-mono text-[11px]">{name}</span>
                                    <span className="text-[9px] text-zinc-600 truncate max-w-[80px] ml-1 font-sans">{parent}</span>
                                    {isAttached && <Check size={10} className="ml-auto text-sky-400" />}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}

                        {/* VIEW 2: Open Editors */}
                        {pickerView === 'editors' && (
                          <div className="space-y-0.5">
                            <button onClick={() => setPickerView('main')} className="w-full text-left px-3 py-1.5 text-[10px] text-sky-400 hover:underline font-semibold">
                              ← Back to categories
                            </button>
                            <div className="px-3 pb-1 text-[10px] font-bold text-zinc-500 uppercase">Current Open Editors</div>
                            {openTabs.length === 0 ? (
                              <div className="px-3 py-4 text-xs text-zinc-600 italic">No files open in editor</div>
                            ) : (
                              openTabs.map(t => {
                                const isAttached = attachedFiles.some(a => a.path === t.path)
                                return (
                                  <button
                                    key={t.id}
                                    onClick={() => !isAttached && attachFile(t.path, t.name)}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-900 flex items-center gap-2 ${isAttached ? 'text-sky-400 bg-sky-500/5' : 'text-zinc-400'}`}
                                  >
                                    <FileText size={11} className="text-amber-500" />
                                    <span className="truncate">{t.name}</span>
                                    {isAttached && <Check size={10} className="ml-auto text-sky-400" />}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}

                        {/* VIEW 3: Files & Folders */}
                        {(pickerView === 'files' || filePickerSearch) && (
                          <div className="space-y-0.5">
                            {!filePickerSearch && (
                              <button onClick={() => setPickerView('main')} className="w-full text-left px-3 py-1.5 text-[10px] text-sky-400 hover:underline font-semibold">
                                ← Back to categories
                              </button>
                            )}
                            <div className="px-3 pb-1 text-[10px] font-bold text-zinc-500 uppercase">
                              {filePickerSearch ? 'Search matches' : 'All Workspace Files'}
                            </div>
                            {filteredFilePickerFiles.length === 0 && (
                              <div className="px-3 py-4 text-xs text-zinc-600 text-center">No files found</div>
                            )}
                            {filteredFilePickerFiles.slice(0, 50).map(f => {
                              const isAttached = attachedFiles.some(a => a.path === f.path)
                              return (
                                <button
                                  key={f.path}
                                  onClick={() => !isAttached && attachFile(f.path, f.name)}
                                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 flex items-center gap-2 ${
                                    isAttached ? 'text-sky-400 bg-sky-500/5' : 'text-zinc-400'
                                  }`}
                                >
                                  <FileText size={11} className={isAttached ? 'text-sky-400' : 'text-zinc-600'} />
                                  <span className="truncate font-mono text-[11px]">{f.name}</span>
                                  {isAttached && <Check size={10} className="ml-auto text-sky-400" />}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* VIEW 4: Instructions / Skills */}
                        {pickerView === 'skills' && (
                          <div className="space-y-0.5">
                            <button onClick={() => setPickerView('main')} className="w-full text-left px-3 py-1.5 text-[10px] text-sky-400 hover:underline font-semibold">
                              ← Back to categories
                            </button>
                            <div className="px-3 pb-1 text-[10px] font-bold text-zinc-500 uppercase">Select Active Agent Skill</div>
                            {skills.map(skill => (
                              <button
                                key={skill.name}
                                onClick={() => { onSkillChange?.(skill.name); setShowFilePicker(false) }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-900 ${selectedSkill === skill.name ? 'text-sky-300 bg-sky-500/10' : 'text-zinc-400'}`}
                              >
                                <div className="font-semibold">{skill.name}</div>
                                <div className="text-[10px] text-zinc-600 truncate mt-0.5">{skill.description}</div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* VIEW 5: Problems / Lint Results */}
                        {pickerView === 'problems' && (
                          <div className="space-y-0.5">
                            <button onClick={() => setPickerView('main')} className="w-full text-left px-3 py-1.5 text-[10px] text-sky-400 hover:underline font-semibold">
                              ← Back to categories
                            </button>
                            <div className="px-3 pb-1 text-[10px] font-bold text-zinc-500 uppercase">Files containing Diagnostics</div>
                            {Object.keys(lintResults).length === 0 ? (
                              <div className="px-3 py-4 text-xs text-zinc-600 italic">No syntax errors tracked</div>
                            ) : (
                              Object.entries(lintResults).map(([filePath, res]) => {
                                const name = filePath.split('/').pop() || filePath
                                const isAttached = attachedFiles.some(a => a.path === filePath)
                                return (
                                  <button
                                    key={filePath}
                                    onClick={() => {
                                      if (!isAttached) attachFile(filePath, name)
                                      setInput(prev => `Fix the lint diagnostics found inside this file: ${name}. Errors: ${res.errors}, Warnings: ${res.warnings}\n${prev}`)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-900 flex items-center justify-between"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-medium truncate text-zinc-300 font-mono text-[11px]">{name}</div>
                                      <div className="text-[10px] text-zinc-500 truncate">{filePath}</div>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0 ml-2">
                                      {res.errors > 0 && <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold">E: {res.errors}</span>}
                                      {res.warnings > 0 && <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold">W: {res.warnings}</span>}
                                    </div>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}

                        {/* VIEW 6: Sessions */}
                        {pickerView === 'sessions' && (
                          <div className="space-y-0.5">
                            <button onClick={() => setPickerView('main')} className="w-full text-left px-3 py-1.5 text-[10px] text-sky-400 hover:underline font-semibold">
                              ← Back to categories
                            </button>
                            <div className="px-3 pb-1 text-[10px] font-bold text-zinc-500 uppercase font-sans">Chat History sessions</div>
                            {savedChats.length === 0 ? (
                              <div className="px-3 py-3 text-xs text-zinc-600 italic">No sessions saved</div>
                            ) : (
                              savedChats.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => { loadChat(c.id, c.title); setShowFilePicker(false) }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-900 truncate"
                                >
                                  {c.title}
                                </button>
                              ))
                            )}
                          </div>
                        )}

                        {/* VIEW 7: Tools */}
                        {pickerView === 'tools' && (
                          <div className="space-y-0.5">
                            <button onClick={() => setPickerView('main')} className="w-full text-left px-3 py-1.5 text-[10px] text-sky-400 hover:underline font-semibold">
                              ← Back to categories
                            </button>
                            <div className="px-3 pb-1 text-[10px] font-bold text-zinc-500 uppercase">Run Assistant Commands</div>
                            <button
                              onClick={() => { setInput(`Write comprehensive test cases for the open component context.\n${input}`); setShowFilePicker(false) }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-900 block"
                            >
                              <div className="font-semibold text-zinc-200">Generate Tests</div>
                              <div className="text-[10px] text-zinc-500">Inject code test specs prompt template</div>
                            </button>
                            <button
                              onClick={() => { setInput(`Refactor this block to improve performance and code readability:\n${input}`); setShowFilePicker(false) }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-900 block"
                            >
                              <div className="font-semibold text-zinc-200">Refactor Code</div>
                              <div className="text-[10px] text-zinc-500">Perform cleaner syntax splits</div>
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  </>
                )}
                <input 
                  type="file" 
                  id="screenshot-uploader" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload} 
                />
              </div>
            </div>

            {loading ? (
              <button
                onClick={() => abortRef.current?.abort()}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                title="Stop"
              >
                <Square size={14} className="text-rose-400" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="p-2 bg-sky-500 hover:bg-sky-400 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-sky-500/20"
              >
                <Send size={14} className="text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
