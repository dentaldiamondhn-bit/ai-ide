'use client'

import React, { useState } from 'react'
import {
  Search, Replace, RefreshCw, ChevronRight, ChevronDown,
  FileCode, CaseSensitive, WholeWord, Binary, MoreHorizontal,
  X, Check
} from 'lucide-react'

interface MatchItem {
  line: number
  text: string
  matches: { index: number; length: number }[]
}

interface SearchResult {
  path: string
  fullPath: string
  matches: MatchItem[]
  isExpanded?: boolean
}

export default function SearchPanel({ onSelectFile }: { onSelectFile?: (path: string, line?: number) => void }) {
  const [query, setQuery] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [includeFilter, setIncludeFilter] = useState('')
  const [excludeFilter, setExcludeFilter] = useState('')

  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [replaceStats, setReplaceStats] = useState<{ files: number; count: number } | null>(null)

  const triggerSearch = async (currentQuery = query) => {
    if (!currentQuery.trim()) {
      setResults([])
      return
    }
    setIsLoading(true)
    setReplaceStats(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          query: currentQuery,
          caseSensitive,
          wholeWord,
          useRegex,
          fileFilters: {
            include: includeFilter.trim() || undefined,
            exclude: excludeFilter.trim() || undefined
          }
        })
      })
      if (res.ok) {
        const data = await res.json()
        setResults((data.results || []).map((r: any) => ({ ...r, isExpanded: true })))
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const triggerReplaceAll = async () => {
    if (!query.trim()) return
    if (!confirm(`Replace all matches of "${query}" with "${replaceWith}"?`)) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace',
          query,
          replaceWith,
          caseSensitive,
          wholeWord,
          useRegex,
          fileFilters: {
            include: includeFilter.trim() || undefined,
            exclude: excludeFilter.trim() || undefined
          }
        })
      })
      if (res.ok) {
        const data = await res.json()
        setReplaceStats({ files: data.filesModified, count: data.occurrencesReplaced })
        setResults([])
      }
    } catch (err) {
      console.error('Replace failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleFileExpand = (index: number) => {
    setResults(prev => prev.map((item, idx) =>
      idx === index ? { ...item, isExpanded: !item.isExpanded } : item
    ))
  }

  const renderHighlightedText = (text: string, matches: { index: number; length: number }[]) => {
    if (matches.length === 0) return <span>{text}</span>

    const elements: React.ReactNode[] = []
    let lastIndex = 0
    const sorted = [...matches].sort((a, b) => a.index - b.index)

    sorted.forEach((m, idx) => {
      if (m.index > lastIndex) {
        elements.push(<span key={`t-${idx}`}>{text.slice(lastIndex, m.index)}</span>)
      }
      elements.push(
        <mark key={`m-${idx}`} className="bg-amber-500/30 text-amber-200 border border-amber-500/20 px-0.5 rounded-sm font-semibold">
          {text.slice(m.index, m.index + m.length)}
        </mark>
      )
      lastIndex = m.index + m.length
    })

    if (lastIndex < text.length) {
      elements.push(<span key="end">{text.slice(lastIndex)}</span>)
    }

    return <div className="truncate">{elements}</div>
  }

  const handleKeyPress = (e: React.KeyboardEvent, field: 'search' | 'replace') => {
    if (e.key === 'Enter') {
      if (field === 'search') triggerSearch()
      else triggerReplaceAll()
    }
  }

  const clearResults = () => {
    setQuery('')
    setReplaceWith('')
    setResults([])
    setReplaceStats(null)
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 font-sans select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-900/40">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Search</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => triggerSearch()}
            disabled={isLoading}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-all"
            title="Refresh Search"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={clearResults}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-all"
            title="Clear"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Search/Replace form */}
      <div className="p-3 border-b border-zinc-800/40 space-y-2.5 bg-zinc-900/10">

        {/* Search input with modifiers */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => handleKeyPress(e, 'search')}
            placeholder="Search query..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 pr-20 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500/50"
          />
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1 bg-zinc-900 pl-1">
            <button
              onClick={() => { setCaseSensitive(!caseSensitive); setTimeout(() => triggerSearch(), 50) }}
              className={`p-0.5 rounded transition-all ${caseSensitive ? 'text-sky-400 bg-sky-500/10 border border-sky-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Match Case (Aa)"
            >
              <CaseSensitive size={12} />
            </button>
            <button
              onClick={() => { setWholeWord(!wholeWord); setTimeout(() => triggerSearch(), 50) }}
              className={`p-0.5 rounded transition-all ${wholeWord ? 'text-sky-400 bg-sky-500/10 border border-sky-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Whole Word (ab)"
            >
              <WholeWord size={12} />
            </button>
            <button
              onClick={() => { setUseRegex(!useRegex); setTimeout(() => triggerSearch(), 50) }}
              className={`p-0.5 rounded transition-all ${useRegex ? 'text-sky-400 bg-sky-500/10 border border-sky-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Regex (.*)"
            >
              <Binary size={12} />
            </button>
          </div>
        </div>

        {/* Replace input */}
        <div className="flex gap-1 items-center">
          <input
            type="text"
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            onKeyDown={(e) => handleKeyPress(e, 'replace')}
            placeholder="Replace with..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500/50"
          />
          <button
            onClick={triggerReplaceAll}
            disabled={!query.trim() || isLoading}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Replace All"
          >
            <Replace size={13} />
          </button>
        </div>

        {/* Advanced filters toggle */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="hover:text-zinc-300 flex items-center gap-1"
          >
            <MoreHorizontal size={12} />
            <span>Files to include/exclude</span>
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-1.5 pt-1 border-t border-zinc-800/40">
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">include</label>
              <input
                type="text"
                value={includeFilter}
                onChange={(e) => setIncludeFilter(e.target.value)}
                placeholder="e.g. src/components"
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-sky-500/40 font-mono"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">exclude</label>
              <input
                type="text"
                value={excludeFilter}
                onChange={(e) => setExcludeFilter(e.target.value)}
                placeholder="e.g. css, json"
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-sky-500/40 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <RefreshCw size={16} className="animate-spin text-sky-500" />
            <span className="text-[10px] text-zinc-500 tracking-wider">Searching workspace...</span>
          </div>
        ) : replaceStats ? (
          <div className="p-3 bg-emerald-950/20 border border-emerald-800/30 rounded text-emerald-400 text-xs space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Check size={14} /> Replacement Complete
            </div>
            <p className="text-[11px] text-emerald-500/80">
              Updated {replaceStats.files} files, replaced {replaceStats.count} occurrences.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 space-y-1.5">
            <Search size={18} className="text-zinc-700" />
            <span className="text-xs text-zinc-500 italic">No results</span>
            <span className="text-[10px] text-zinc-600 leading-normal max-w-[180px]">
              Type a query above and press Enter to search
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="px-1 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
              {results.reduce((acc, curr) => acc + curr.matches.length, 0)} results in {results.length} files
            </div>

            {results.map((fileRes, fileIdx) => (
              <div key={fileRes.path} className="border border-zinc-800/40 rounded bg-zinc-900/10">
                <div
                  onClick={() => toggleFileExpand(fileIdx)}
                  className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-zinc-800/50 cursor-pointer text-xs font-semibold select-none text-zinc-300 truncate transition-colors rounded"
                >
                  {fileRes.isExpanded ? <ChevronDown size={13} className="text-zinc-500" /> : <ChevronRight size={13} className="text-zinc-500" />}
                  <FileCode size={13} className="text-sky-400 shrink-0" />
                  <span className="truncate font-mono text-[11px]">{fileRes.path}</span>
                  <span className="ml-auto text-[10px] bg-zinc-800/60 px-1.5 py-0.2 rounded font-mono text-zinc-500">
                    {fileRes.matches.length}
                  </span>
                </div>

                {fileRes.isExpanded && (
                  <div className="pl-3 py-1 border-l border-zinc-800 space-y-0.5 bg-black/10">
                    {fileRes.matches.map((matchItem, matchIdx) => (
                      <div
                        key={matchIdx}
                        onClick={() => onSelectFile?.(fileRes.fullPath, matchItem.line)}
                        className="group flex items-start gap-2.5 px-2 py-1 hover:bg-zinc-800/75 rounded text-xs cursor-pointer transition-all border border-transparent hover:border-zinc-800/40"
                      >
                        <span className="font-mono text-[10px] text-zinc-600 group-hover:text-sky-400 text-right w-6 shrink-0 pt-0.5">
                          {matchItem.line}
                        </span>
                        <div className="text-[11px] font-mono text-zinc-400 group-hover:text-zinc-200 select-text leading-tight truncate flex-1">
                          {renderHighlightedText(matchItem.text, matchItem.matches)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
