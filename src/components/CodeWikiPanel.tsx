'use client'

import React, { useState, useEffect } from 'react'
import { BookOpen, Search, Plus, FileText, ChevronRight, Check, Trash2 } from 'lucide-react'

interface WikiPage {
  title: string
  category: string
  summary: string
  content: string
  fileName: string
}

export default function CodeWikiPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activePage, setActivePage] = useState<WikiPage | null>(null)
  const [showCreator, setShowCreator] = useState(false)
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('guides')

  const fetchPages = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/wiki')
      const data = await res.json()
      setWikiPages(data.pages || [])
    } catch {} finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchPages() }, [])

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) return

    const fileName = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.md'
    const content = `# ${newTitle}\n\n${newContent}`

    try {
      await fetch('/api/wiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, content })
      })
      await fetchPages()
      setShowCreator(false)
      setNewTitle('')
      setNewContent('')
    } catch {}
  }

  const handleDeletePage = async (fileName: string) => {
    if (!confirm('Delete this wiki page?')) return
    try {
      await fetch('/api/wiki', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName })
      })
      setActivePage(null)
      await fetchPages()
    } catch {}
  }

  const filteredPages = wikiPages.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderMarkdown = (md: string) => {
    return md
      .replace(/^### (.+)$/gm, '<h3 class="text-xs font-bold text-zinc-200 mt-3 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold text-zinc-100 mt-4 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-base font-bold text-zinc-50 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-200 font-semibold">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="text-sky-400 bg-zinc-800/60 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
      .replace(/^- (.+)$/gm, '<li class="text-zinc-400 ml-4 list-disc text-[11px]">$1</li>')
      .replace(/\n\n/g, '<br/><br/>')
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 font-sans select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-900/40">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <BookOpen size={13} className="text-sky-400" /> CodeWiki
        </span>
        <button
          onClick={() => { setShowCreator(!showCreator); setActivePage(null) }}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-all"
          title="Create Article"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Search */}
      {!activePage && !showCreator && (
        <div className="p-3 border-b border-zinc-800/40">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wiki articles..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 pl-7 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500/50"
            />
            <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-600" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {showCreator ? (
          <form onSubmit={handleCreatePage} className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Create Article</span>
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Environment Setup"
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/40"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/40"
              >
                <option value="architecture">Architecture</option>
                <option value="api">API Documentation</option>
                <option value="guides">User Guides</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">Markdown Content</label>
              <textarea
                required
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="# Title&#10;Write documentation here..."
                className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/40 resize-none font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreator(false)} className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button type="submit" className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1">
                <Check size={12} /> Save
              </button>
            </div>
          </form>
        ) : activePage ? (
          <div className="space-y-3">
            <button
              onClick={() => setActivePage(null)}
              className="text-[10px] text-sky-400 font-semibold hover:underline flex items-center gap-1"
            >
              ← Back to articles
            </button>
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{activePage.category}</span>
              <h1 className="text-sm font-bold text-zinc-100">{activePage.title}</h1>
            </div>
            <div
              className="p-3 bg-black/30 border border-zinc-800/40 rounded text-xs text-zinc-300 leading-relaxed space-y-1 select-text"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(activePage.content) }}
            />
            <button
              onClick={() => handleDeletePage(activePage.fileName)}
              className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 mt-2"
            >
              <Trash2 size={11} /> Delete page
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-zinc-600">Loading wiki...</div>
            ) : filteredPages.length === 0 ? (
              <div className="text-center py-12 text-zinc-600 text-xs italic">No articles found</div>
            ) : (
              filteredPages.map((page, idx) => (
                <div
                  key={idx}
                  onClick={() => setActivePage(page)}
                  className="group p-2.5 border border-zinc-800/40 rounded bg-zinc-900/10 hover:bg-zinc-900/40 cursor-pointer transition-all hover:border-zinc-800/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{page.category}</span>
                    <ChevronRight size={11} className="text-zinc-600 group-hover:text-zinc-400" />
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-300 group-hover:text-zinc-100 mt-0.5">{page.title}</h3>
                  <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{page.summary}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
