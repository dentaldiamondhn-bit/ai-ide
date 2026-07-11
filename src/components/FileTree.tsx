'use client'

import React, { useState, useEffect } from 'react'
import {
  Folder, FolderOpen,
  ChevronRight, ChevronDown, Trash2, Edit3, FilePlus, FolderPlus, RefreshCw,
  Copy, ClipboardCopy, CopyCheck, ClipboardPaste, ExternalLink
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

interface FileTreeProps {
  onFileSelect: (filePath: string) => void
  onRefresh?: () => void
  startPath?: string
  activeFilePath?: string | null
  lintResults?: Record<string, { errors: number; warnings: number }>
}

interface FileIconDef {
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}

// ── VS Code / Windsurf style file icons ──────────────────────────

function TextBadge({ bg, text, color = '#fff', size = 16 }: { bg: string; text: string; color?: string; size?: number }) {
  const fs = text.length > 2 ? 6 : text.length > 1 ? 7 : 8
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill={bg} />
      <text
        x="8" y="8.5" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={fs} fontWeight="800"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        {text}
      </text>
    </svg>
  )
}

function makeTextIcon(bg: string, text: string, color = '#fff'): React.ComponentType<{ size?: number; className?: string }> {
  return ({ size = 16, className }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill={bg} />
      <text
        x="8" y="8.5" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={text.length > 2 ? 6 : 7} fontWeight="800"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        {text}
      </text>
    </svg>
  )
}

function PythonIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#3572A5" />
      <path d="M9 3H7a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H7" stroke="#FFD43B" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="5" r="0.6" fill="#FFD43B" />
      <circle cx="8.5" cy="11" r="0.6" fill="#FFD43B" />
    </svg>
  )
}

function ReactIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#61DAFB" />
      <circle cx="8" cy="8" r="1.5" fill="#fff" />
      <ellipse cx="8" cy="8" rx="6" ry="2" fill="none" stroke="#fff" strokeWidth="0.9" transform="rotate(0 8 8)" opacity="0.9" />
      <ellipse cx="8" cy="8" rx="6" ry="2" fill="none" stroke="#fff" strokeWidth="0.9" transform="rotate(60 8 8)" opacity="0.9" />
      <ellipse cx="8" cy="8" rx="6" ry="2" fill="none" stroke="#fff" strokeWidth="0.9" transform="rotate(120 8 8)" opacity="0.9" />
    </svg>
  )
}

function DockerIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#2496ED" />
      <rect x="4" y="6" width="2" height="1.5" rx="0.3" fill="#fff" />
      <rect x="6.5" y="6" width="2" height="1.5" rx="0.3" fill="#fff" />
      <rect x="9" y="6" width="2" height="1.5" rx="0.3" fill="#fff" />
      <rect x="6.5" y="4" width="2" height="1.5" rx="0.3" fill="#fff" />
      <rect x="9" y="4" width="2" height="1.5" rx="0.3" fill="#fff" />
      <rect x="9" y="2" width="2" height="1.5" rx="0.3" fill="#fff" opacity="0.7" />
      <path d="M2 8.5C2 11 3.5 12.5 6 12.5h4c2 0 4-1 4-3.5" stroke="#fff" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function GitIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#F05032" />
      <path d="M4 12V5l3-3 2 2-3 3v5" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4" cy="12" r="1.2" fill="#fff" />
      <circle cx="4" cy="5" r="1" fill="#fff" />
    </svg>
  )
}

function RustIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#DEA584" />
      <circle cx="8" cy="8" r="2.5" fill="none" stroke="#fff" strokeWidth="1" />
      <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="#fff" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="8" cy="8" r="0.8" fill="#fff" />
    </svg>
  )
}

function GoIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#00ADD8" />
      <text x="8" y="9.5" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="8" fontWeight="900" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Go</text>
    </svg>
  )
}

function ImageIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#AB47BC" />
      <rect x="3" y="3.5" width="10" height="9" rx="1" fill="none" stroke="#fff" strokeWidth="0.9" />
      <circle cx="5.5" cy="6.5" r="1" fill="#fff" />
      <path d="M3 11l3-3 2 2 2-2 3 3" stroke="#fff" strokeWidth="0.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArchiveIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#75715E" />
      <rect x="2.5" y="3" width="11" height="2" rx="0.5" fill="none" stroke="#fff" strokeWidth="0.9" />
      <path d="M3 5v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5" stroke="#fff" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <line x1="7" y1="7.5" x2="9" y2="7.5" stroke="#fff" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  )
}

function TerminalIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#4CAF50" />
      <path d="M4 5l3 3-3 3" stroke="#fff" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8" y1="11" x2="12" y2="11" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function LockIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#75715E" />
      <rect x="4" y="7" width="8" height="5" rx="0.8" fill="none" stroke="#fff" strokeWidth="0.9" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#fff" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <circle cx="8" cy="9.5" r="0.8" fill="#fff" />
    </svg>
  )
}

const FILE_ICONS: Record<string, FileIconDef> = {
  ts: { icon: makeTextIcon('#3178C6', 'TS'), color: '#3178C6' },
  tsx: { icon: ReactIcon, color: '#61DAFB' },
  mts: { icon: makeTextIcon('#3178C6', 'TS'), color: '#3178C6' },
  cts: { icon: makeTextIcon('#3178C6', 'TS'), color: '#3178C6' },
  js: { icon: makeTextIcon('#F7DF1E', 'JS', '#1a1a1a'), color: '#F7DF1E' },
  jsx: { icon: ReactIcon, color: '#61DAFB' },
  mjs: { icon: makeTextIcon('#F7DF1E', 'JS', '#1a1a1a'), color: '#F7DF1E' },
  cjs: { icon: makeTextIcon('#F7DF1E', 'JS', '#1a1a1a'), color: '#F7DF1E' },
  json: { icon: makeTextIcon('#C9A85E', '{}'), color: '#C9A85E' },
  css: { icon: makeTextIcon('#42A5F5', '#'), color: '#42A5F5' },
  scss: { icon: makeTextIcon('#F06292', 'S'), color: '#F06292' },
  sass: { icon: makeTextIcon('#F06292', 'S'), color: '#F06292' },
  less: { icon: makeTextIcon('#1D365D', 'L'), color: '#1D365D' },
  html: { icon: makeTextIcon('#E44D26', 'H'), color: '#E44D26' },
  htm: { icon: makeTextIcon('#E44D26', 'H'), color: '#E44D26' },
  md: { icon: makeTextIcon('#42A5F5', 'MD'), color: '#42A5F5' },
  markdown: { icon: makeTextIcon('#42A5F5', 'MD'), color: '#42A5F5' },
  py: { icon: PythonIcon, color: '#3572A5' },
  rs: { icon: RustIcon, color: '#DEA584' },
  go: { icon: GoIcon, color: '#00ADD8' },
  java: { icon: makeTextIcon('#B07219', 'J'), color: '#B07219' },
  c: { icon: makeTextIcon('#00599C', 'C'), color: '#00599C' },
  cpp: { icon: makeTextIcon('#00599C', 'CP'), color: '#00599C' },
  h: { icon: makeTextIcon('#00599C', 'H'), color: '#00599C' },
  hpp: { icon: makeTextIcon('#00599C', 'H'), color: '#00599C' },
  sh: { icon: TerminalIcon, color: '#4CAF50' },
  bash: { icon: TerminalIcon, color: '#4CAF50' },
  zsh: { icon: TerminalIcon, color: '#4CAF50' },
  yaml: { icon: makeTextIcon('#6BB0E0', 'Y'), color: '#6BB0E0' },
  yml: { icon: makeTextIcon('#6BB0E0', 'Y'), color: '#6BB0E0' },
  toml: { icon: makeTextIcon('#8BC34A', 'T'), color: '#8BC34A' },
  sql: { icon: makeTextIcon('#E38C00', 'S'), color: '#E38C00' },
  xml: { icon: makeTextIcon('#D97706', 'X'), color: '#D97706' },
  svg: { icon: makeTextIcon('#42A5F5', 'SVG'), color: '#42A5F5' },
  png: { icon: ImageIcon, color: '#AB47BC' },
  jpg: { icon: ImageIcon, color: '#AB47BC' },
  jpeg: { icon: ImageIcon, color: '#AB47BC' },
  gif: { icon: ImageIcon, color: '#AB47BC' },
  ico: { icon: ImageIcon, color: '#AB47BC' },
  webp: { icon: ImageIcon, color: '#AB47BC' },
  zip: { icon: ArchiveIcon, color: '#75715E' },
  tar: { icon: ArchiveIcon, color: '#75715E' },
  gz: { icon: ArchiveIcon, color: '#75715E' },
  lock: { icon: LockIcon, color: '#75715E' },
  sum: { icon: makeTextIcon('#75715E', 'Σ'), color: '#75715E' },
}

function getFileIcon(name: string): FileIconDef {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (name.startsWith('.env')) return { icon: makeTextIcon('#F39C12', 'ENV'), color: '#F39C12' }
  if (name === '.gitignore' || name === '.gitattributes' || name === '.gitmodules') return { icon: GitIcon, color: '#F05032' }
  if (name.startsWith('Dockerfile')) return { icon: DockerIcon, color: '#2496ED' }
  if (name === 'Makefile' || name === 'makefile') return { icon: makeTextIcon('#E44D26', 'MK'), color: '#E44D26' }
  return FILE_ICONS[ext] || { icon: makeTextIcon('#8A8A8A', 'F'), color: '#8A8A8A' }
}

const excludedDirs = ['node_modules', '.git', '.next', '.vscode', '.idea', 'dist', 'out']

export default function FileTree({ onFileSelect, onRefresh, startPath, activeFilePath, lintResults }: FileTreeProps) {
  const [tree, setTree] = useState<FileNode[]>([])
  const [rootPath, setRootPath] = useState<string>('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [gitStatuses, setGitStatuses] = useState<Record<string, string>>({})
  const [gitBranch, setGitBranch] = useState('')

  const fetchTree = async (pathTarget?: string) => {
    setLoading(true)
    try {
      // Try WebSocket first (local file access from deployed app)
      const { wsListFiles } = await import('@/lib/ws-file-client')
      const wsResult = await wsListFiles(pathTarget)
      if (wsResult) {
        setTree(wsResult.tree)
        setRootPath(wsResult.rootPath)
        setParentPath(wsResult.parentPath)
        setLoading(false)
        return
      }
    } catch {}
    try {
      // Fall back to HTTP API (works in local dev)
      const url = pathTarget ? `/api/files?root=${encodeURIComponent(pathTarget)}` : '/api/files'
      const res = await fetch(url)
      const data = await res.json()
      if (data.tree) {
        setTree(data.tree)
        setRootPath(data.rootPath)
        setParentPath(data.parentPath || null)
      }
    } catch (err) {
      console.error('Failed to load file tree', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchGitStatus = async () => {
    try {
      const res = await fetch('/api/git?action=status')
      const data = await res.json()
      const statusMap: Record<string, string> = {}
      for (const change of (data.changes || [])) {
        if (change.type === 'untracked') statusMap[change.path] = 'untracked'
        else if (change.type === 'deleted') statusMap[change.path] = 'ignored'
        else statusMap[change.path] = 'modified'
      }
      setGitStatuses(statusMap)
      setGitBranch(data.branch || '')
    } catch {}
  }

  useEffect(() => {
    if (startPath) fetchTree(startPath)
    else fetchTree()
    fetchGitStatus()
  }, [startPath])

  const handleRefresh = () => {
    fetchTree()
    fetchGitStatus()
    onRefresh?.()
  }

  const navigateUp = () => {
    if (parentPath) fetchTree(parentPath)
  }

  if (loading) {
    return <div className="p-4 text-xs text-zinc-500 animate-pulse">Loading workspace...</div>
  }

  const displayPath = startPath || rootPath
  const workspaceName = displayPath.split('/').pop() || displayPath.split('\\').pop() || 'Workspace'

  return (
    <div className="flex flex-col h-full select-none text-zinc-300 font-sans text-sm">
      <div className="p-3 uppercase text-xs font-bold tracking-wider border-b border-zinc-800 text-zinc-400 flex justify-between items-center bg-zinc-900/50">
        <span className="truncate">Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={navigateUp}
            disabled={!parentPath}
            className={`transition-colors ${parentPath ? 'hover:text-zinc-200' : 'opacity-30 cursor-not-allowed'}`}
            title="Go to parent directory"
          >
            <ChevronRight size={14} className="rotate-180" />
          </button>
          <button 
            onClick={handleRefresh}
            className="hover:text-zinc-200 transition-colors"
            title="Refresh file tree"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
        {parentPath && (
          <div
            onClick={navigateUp}
            className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-zinc-800/60 cursor-pointer transition-colors duration-150 group text-zinc-500"
          >
            <ChevronRight size={14} className="rotate-180 text-zinc-600" />
            <FolderOpen size={16} className="text-amber-600/60" />
            <span className="truncate text-xs">..</span>
          </div>
        )}
        {tree.filter(n => !excludedDirs.includes(n.name)).map((node) => (
            <NodeItem key={node.path} node={node} onFileSelect={onFileSelect} onRefresh={handleRefresh} depth={0} activeFilePath={activeFilePath} lintResults={lintResults} gitStatuses={gitStatuses} />
          ))}
      </div>
    </div>
  )
}

function NodeItem({ node, onFileSelect, onRefresh, depth, activeFilePath, lintResults, gitStatuses }: { node: FileNode; onFileSelect: (p: string) => void; onRefresh: () => void; depth: number; activeFilePath?: string | null; lintResults?: Record<string, { errors: number; warnings: number }>; gitStatuses?: Record<string, string> }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = () => {
    if (node.isDirectory) {
      setIsOpen(!isOpen)
    } else {
      onFileSelect(node.path)
    }
  }

  const executeAction = async (actionType: string) => {
    let payload: any = { action: actionType, targetPath: node.path }

    if (actionType === 'RENAME') {
      const newName = prompt("Enter new name:", node.name)
      if (!newName) return
      payload.newName = newName
    }

    if (actionType === 'CREATE_FILE' || actionType === 'CREATE_FOLDER') {
      const name = prompt(`Enter new ${actionType === 'CREATE_FILE' ? 'file' : 'folder'} name:`)
      if (!name) return
      const cleanBasePath = node.path.endsWith('/') ? node.path.slice(0, -1) : node.path
      payload.targetPath = `${cleanBasePath}/${name}`.replace(/\/+/g, '/')
    }

    if (actionType === 'DELETE') {
      if (!confirm(`Are you sure you want to delete ${node.name}?`)) return
    }

    try {
      // Try WebSocket first
      try {
        const { wsFileAction } = await import('@/lib/ws-file-client')
        const result = await wsFileAction(payload.action, payload.targetPath, payload.content, payload.newName)
        if (result) { onRefresh(); return }
      } catch {}
      // Fall back to HTTP API
      const res = await fetch('/api/files/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success !== false) {
        onRefresh()
      } else {
        alert(`Action failed: ${data.error || 'Server error occurred.'}`)
      }
    } catch (error: any) {
      console.error('Action error:', error)
      alert(`Action failed: ${error.message}`)
    }
  }

  const copyPath = async (p: string) => {
    try {
      await navigator.clipboard.writeText(p)
    } catch { prompt('Copy this path:', p) }
  }

  const copyContent = async (p: string) => {
    try {
      let content = ''
      try {
        const { wsReadFile } = await import('@/lib/ws-file-client')
        const wsContent = await wsReadFile(p)
        if (wsContent !== null) content = wsContent
      } catch {}
      if (!content) {
        const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(p)}`)
        const data = await res.json()
        content = data.content || ''
      }
      if (content) await navigator.clipboard.writeText(content)
    } catch {}
  }

  const fileIconDef = node.isDirectory
    ? { icon: isOpen ? FolderOpen : Folder, color: isOpen ? '#fbbf24' : '#f59e0b' }
    : getFileIcon(node.name)

  const isActive = !node.isDirectory && activeFilePath === node.path
  const Icon = fileIconDef.icon

  const gitStatus = !node.isDirectory ? gitStatuses?.[node.path] : undefined
  const gitTextColor = gitStatus === 'modified' ? 'text-amber-400' : gitStatus === 'untracked' ? 'text-emerald-400' : gitStatus === 'ignored' ? 'text-zinc-600' : ''
  const gitBadge = gitStatus === 'modified' ? 'M' : gitStatus === 'untracked' ? 'U' : ''
  const gitBadgeColor = gitStatus === 'modified' ? 'bg-amber-500/15 text-amber-400' : gitStatus === 'untracked' ? 'bg-emerald-500/15 text-emerald-400' : ''

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          onClick={handleClick}
          className={`flex items-center gap-1.5 py-1 px-1 rounded hover:bg-zinc-800/60 cursor-pointer transition-colors duration-150 group ${isActive ? 'bg-sky-600/30 text-white' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <span className="text-zinc-500 group-hover:text-zinc-300">
            {node.isDirectory ? (
              isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span className="w-3.5" />
            )}
          </span>

          <span className="text-zinc-400 group-hover:text-zinc-300" style={{ color: fileIconDef.color }}>
            <Icon size={16} />
          </span>

          <span className={`truncate text-xs font-medium tracking-wide ${isActive ? 'text-white' : gitTextColor || 'text-zinc-300 group-hover:text-zinc-100'}`}>
            {node.name}
          </span>
          {gitBadge && (
            <span className={`ml-auto mr-0.5 min-w-[14px] h-3.5 px-1 flex items-center justify-center rounded text-[8px] font-bold leading-none ${gitBadgeColor}`}>
              {gitBadge}
            </span>
          )}
          {!node.isDirectory && (() => {
            const lint = lintResults?.[node.path]
            if (!lint || (lint.errors === 0 && lint.warnings === 0)) return null
            return (
              <span className={`ml-auto mr-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold leading-none ${lint.errors > 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {lint.errors > 0 ? lint.errors : lint.warnings}
              </span>
            )
          })()}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs min-w-[180px]">
        {node.isDirectory && (
          <>
            <ContextMenuItem onSelect={() => executeAction('CREATE_FILE')} className="flex items-center gap-2 cursor-pointer focus:bg-zinc-800">
              <FilePlus size={14} /> New File
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => executeAction('CREATE_FOLDER')} className="flex items-center gap-2 cursor-pointer focus:bg-zinc-800">
              <FolderPlus size={14} /> New Folder
            </ContextMenuItem>
            <ContextMenuSeparator className="bg-zinc-800" />
          </>
        )}
        <ContextMenuItem onSelect={() => copyPath(node.path)} className="flex items-center gap-2 cursor-pointer focus:bg-zinc-800">
          <ClipboardCopy size={14} /> Copy Path
        </ContextMenuItem>
        {!node.isDirectory && (
          <ContextMenuItem onSelect={() => copyContent(node.path)} className="flex items-center gap-2 cursor-pointer focus:bg-zinc-800">
            <Copy size={14} /> Copy Content
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => executeAction('DUPLICATE')} className="flex items-center gap-2 cursor-pointer focus:bg-zinc-800">
          <CopyCheck size={14} /> Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-zinc-800" />
        <ContextMenuItem onSelect={() => executeAction('RENAME')} className="flex items-center gap-2 cursor-pointer focus:bg-zinc-800">
          <Edit3 size={14} /> Rename...
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-zinc-800" />
        <ContextMenuItem onSelect={() => executeAction('DELETE')} className="flex items-center gap-2 cursor-pointer focus:bg-zinc-800 text-rose-400 focus:text-rose-400">
          <Trash2 size={14} /> Delete
        </ContextMenuItem>
      </ContextMenuContent>

      {node.isDirectory && isOpen && node.children && (
        <div className="relative">
          {node.children.filter((n: FileNode) => !excludedDirs.includes(n.name)).map((child: FileNode) => (
            <NodeItem key={child.path} node={child} onFileSelect={onFileSelect} onRefresh={onRefresh} depth={depth + 1} activeFilePath={activeFilePath} lintResults={lintResults} gitStatuses={gitStatuses} />
          ))}
        </div>
      )}
    </ContextMenu>
  )
}
