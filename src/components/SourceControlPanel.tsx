'use client'

import { useState, useEffect } from 'react'
import {
  GitBranch, Check, Plus, Minus, RotateCcw,
  ArrowUp, GitCommit, FileCode, RefreshCw
} from 'lucide-react'

interface GitFileChange {
  path: string
  isStaged: boolean
  isUnstaged: boolean
  type: 'modified' | 'untracked' | 'deleted' | 'added'
}

export default function SourceControlPanel() {
  const [branchName, setBranchName] = useState('main')
  const [changes, setChanges] = useState<GitFileChange[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPushing, setIsPushing] = useState(false)

  const fetchStatus = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/git?action=status')
      const data = await res.json()
      if (res.ok) {
        setBranchName(data.branch)
        setChanges(data.changes || [])
      }
    } catch (err) {
      console.error('Failed to load repository status:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleGitAction = async (action: string, filePath?: string) => {
    try {
      const res = await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload: { path: filePath || '.' }
        })
      })
      if (res.ok) {
        fetchStatus()
      } else {
        const errData = await res.json()
        alert(`Git Action [${action}] failed: ${errData.error}`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCommit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!commitMsg.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'commit',
          payload: { message: commitMsg }
        })
      })
      if (res.ok) {
        setCommitMsg('')
        fetchStatus()
      } else {
        const errData = await res.json()
        alert(`Commit failed: ${errData.error}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePush = async () => {
    setIsPushing(true)
    try {
      const res = await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push' })
      })
      if (res.ok) {
        alert('Successfully pushed commits to remote branch!')
      } else {
        const err = await res.json()
        alert(`Push failed: ${err.error}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsPushing(false)
    }
  }

  const stagedChanges = changes.filter(c => c.isStaged)
  const unstagedChanges = changes.filter(c => c.isUnstaged || c.type === 'untracked')

  const getStatusBadge = (type: string) => {
    switch (type) {
      case 'untracked': return <span className="text-[10px] text-emerald-500 font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 font-mono">U</span>
      case 'added': return <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.2 rounded bg-emerald-400/10 font-mono">A</span>
      case 'deleted': return <span className="text-[10px] text-rose-500 font-bold px-1.5 py-0.2 rounded bg-rose-500/10 font-mono">D</span>
      default: return <span className="text-[10px] text-amber-500 font-bold px-1.5 py-0.2 rounded bg-amber-500/10 font-mono">M</span>
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 font-sans select-none border-r border-zinc-800/60">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-900/40">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Source Control</span>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-all"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handlePush}
            disabled={isPushing}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-all flex items-center gap-1"
            title="Push to remote"
          >
            <ArrowUp size={12} className={isPushing ? 'animate-bounce' : ''} />
          </button>
        </div>
      </div>

      {/* Branch */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/20 border-b border-zinc-800/40 text-xs text-sky-400 font-medium">
        <GitBranch size={13} />
        <span className="truncate">{branchName}</span>
      </div>

      {/* Commit form */}
      <form onSubmit={handleCommit} className="p-3 border-b border-zinc-800/40 space-y-2">
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message (Ctrl+Enter to commit)"
          className="w-full h-16 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500/50 resize-none font-sans"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              handleCommit()
            }
          }}
        />
        <button
          type="submit"
          disabled={!commitMsg.trim() || isLoading}
          className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-900 disabled:text-zinc-600 rounded text-xs text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <GitCommit size={13} />
          <span>Commit Changes</span>
        </button>
      </form>

      {/* Changes list */}
      <div className="flex-1 overflow-y-auto p-1 space-y-4">

        {/* Staged */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            <span>Staged Changes ({stagedChanges.length})</span>
            {stagedChanges.length > 0 && (
              <button
                onClick={() => handleGitAction('unstage', '.')}
                className="text-zinc-500 hover:text-zinc-300 font-sans lowercase font-normal"
              >
                unstage all
              </button>
            )}
          </div>
          {stagedChanges.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-600 italic">No staged changes</div>
          ) : (
            <div className="space-y-0.5">
              {stagedChanges.map(file => (
                <div key={file.path} className="group flex items-center justify-between px-2 py-1 hover:bg-zinc-800/60 rounded text-xs transition-colors">
                  <div className="flex items-center gap-2 truncate max-w-[200px]">
                    <FileCode size={13} className="text-zinc-500 shrink-0" />
                    <span className="truncate text-zinc-300 font-mono text-[11px]">{file.path}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(file.type)}
                    <button
                      onClick={() => handleGitAction('unstage', file.path)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 transition-all"
                      title="Unstage"
                    >
                      <Minus size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unstaged */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            <span>Changes ({unstagedChanges.length})</span>
            {unstagedChanges.length > 0 && (
              <button
                onClick={() => handleGitAction('stage', '.')}
                className="text-zinc-500 hover:text-zinc-300 font-sans lowercase font-normal"
              >
                stage all
              </button>
            )}
          </div>
          {unstagedChanges.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-600 italic">No modifications found</div>
          ) : (
            <div className="space-y-0.5">
              {unstagedChanges.map(file => (
                <div key={file.path} className="group flex items-center justify-between px-2 py-1 hover:bg-zinc-800/60 rounded text-xs transition-colors">
                  <div className="flex items-center gap-2 truncate max-w-[200px]">
                    <FileCode size={13} className="text-zinc-500 shrink-0" />
                    <span className="truncate text-zinc-300 font-mono text-[11px]">{file.path}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(file.type)}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                      <button
                        onClick={() => handleGitAction('discard', file.path)}
                        className="p-0.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-amber-400"
                        title="Discard changes"
                      >
                        <RotateCcw size={11} />
                      </button>
                      <button
                        onClick={() => handleGitAction('stage', file.path)}
                        className="p-0.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400"
                        title="Stage changes"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
