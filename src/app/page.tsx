'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { PanelLeft, PanelRight, Terminal, PanelBottom, ChevronRight, FileCode, FileText, Hash, Braces, FileType, Coffee, FileJson, FileImage, Settings, Code2 } from 'lucide-react'
import FileTree from '@/components/FileTree'
import CodeEditor from '@/components/CodeEditor'
import ChatPanel from '@/components/ChatPanel'
import type { FileModificationEvent } from '@/hooks/useEditorAnimation'
import TerminalPanel from '@/components/TerminalPanel'
import TopMenuBar from '@/components/TopMenuBar'
import ActivityBar from '@/components/ActivityBar'
import VSCodePanel from '@/components/VSCodePanel'

function getFileTabIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'tsx': case 'jsx': return <FileCode size={13} className="text-sky-400" />
    case 'ts': case 'js': return <FileCode size={13} className="text-amber-400" />
    case 'css': case 'scss': case 'less': return <Hash size={13} className="text-teal-400" />
    case 'json': return <Braces size={13} className="text-yellow-500" />
    case 'md': case 'mdx': return <FileText size={13} className="text-zinc-400" />
    case 'py': return <Coffee size={13} className="text-blue-400" />
    case 'rs': return <FileCode size={13} className="text-orange-400" />
    case 'go': return <FileCode size={13} className="text-cyan-400" />
    case 'java': case 'kt': return <FileCode size={13} className="text-red-400" />
    case 'html': case 'htm': case 'vue': case 'svelte': return <FileCode size={13} className="text-orange-300" />
    case 'svg': case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': return <FileImage size={13} className="text-purple-400" />
    case 'yaml': case 'yml': case 'toml': case 'ini': return <Settings size={13} className="text-zinc-400" />
    case 'sh': case 'bash': case 'zsh': return <Terminal size={13} className="text-emerald-400" />
    case 'sql': return <FileText size={13} className="text-blue-300" />
    case 'xml': return <Code2 size={13} className="text-amber-300" />
    case 'lock': return <FileType size={13} className="text-zinc-500" />
    default: return <FileText size={13} className="text-zinc-400" />
  }
}

function Breadcrumbs({ activePath }: { activePath: string }) {
  const cleanPath = activePath.replace(/^\/home\/[^/]+\//, '')
  const segments = cleanPath.split('/').filter(Boolean)
  return (
    <div className="h-6 px-3 border-b border-zinc-800/50 bg-zinc-950/30 flex items-center gap-1 text-[11px] text-zinc-500 font-mono shrink-0 overflow-x-auto">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={10} className="text-zinc-600 shrink-0" />}
          <span className={`hover:text-zinc-300 cursor-pointer transition-colors truncate max-w-[140px] ${i === segments.length - 1 ? 'text-zinc-300' : ''}`}>
            {seg}
          </span>
        </span>
      ))}
    </div>
  )
}

interface Tab {
  id: string
  name: string
  path: string
  language: string
  content: string
}

export default function IDEPage() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [fileTreeKey, setFileTreeKey] = useState(0)
  const [fileTreePath, setFileTreePath] = useState<string | undefined>(undefined)
  const [useVSCode, setUseVSCode] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showTerminal, setShowTerminal] = useState(true)
  const [showChat, setShowChat] = useState(true)
  const [showEditor, setShowEditor] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string>('minimaxai/minimax-m3')
  const [selectedSkill, setSelectedSkill] = useState<string>('')
  const [lintResults, setLintResults] = useState<Record<string, { errors: number; warnings: number }>>({})
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [animEvent, setAnimEvent] = useState<FileModificationEvent | null>(null)
  const activeTabContent = tabs.find(t => t.id === activeTabId)

  const triggerLint = useCallback(async (filePath: string, content?: string) => {
    try {
      const res = await fetch('/api/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      })
      const data = await res.json()
      setLintResults(prev => ({ ...prev, [filePath]: { errors: data.errors || 0, warnings: data.warnings || 0 } }))
    } catch {
      setLintResults(prev => ({ ...prev, [filePath]: { errors: 0, warnings: 0 } }))
    }
  }, [])

  const lintTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const debouncedLint = useCallback((filePath: string, content?: string) => {
    if (lintTimeoutRef.current) clearTimeout(lintTimeoutRef.current)
    lintTimeoutRef.current = setTimeout(() => triggerLint(filePath, content), 800)
  }, [triggerLint])

  useEffect(() => {
    fetch('/api/db/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          if (data.settings.showSidebar !== undefined) setShowSidebar(data.settings.showSidebar)
          if (data.settings.showTerminal !== undefined) setShowTerminal(data.settings.showTerminal)
          if (data.settings.showChat !== undefined) setShowChat(data.settings.showChat)
          if (data.settings.showEditor !== undefined) setShowEditor(data.settings.showEditor)
          if (data.settings.useVSCode !== undefined) setUseVSCode(data.settings.useVSCode)
          if (data.settings.fileTreePath !== undefined) setFileTreePath(data.settings.fileTreePath)
          if (data.settings.tabs !== undefined && data.settings.tabs.length > 0) {
            setTabs(data.settings.tabs)
            setActiveTabId(data.settings.activeTabId || data.settings.tabs[0]?.id || '')
          }
          if (data.settings.selectedModel !== undefined) setSelectedModel(data.settings.selectedModel)
          if (data.settings.selectedSkill !== undefined) setSelectedSkill(data.settings.selectedSkill)
        }
      })
      .catch(() => {})
      .finally(() => { setSettingsLoaded(true) })
  }, [])

  useEffect(() => {
    if (!settingsLoaded) return
    const settings = { 
      showSidebar, 
      showTerminal, 
      showChat, 
      showEditor, 
      useVSCode, 
      fileTreePath, 
      selectedModel,
      selectedSkill,
      tabs,
      activeTabId
    }
    fetch('/api/db/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    }).catch(() => {})
  }, [showSidebar, showTerminal, showChat, showEditor, useVSCode, fileTreePath, selectedModel, selectedSkill, tabs, activeTabId, settingsLoaded])

  const toggleSidebar = useCallback(() => setShowSidebar(p => !p), [])
  const toggleTerminal = useCallback(() => setShowTerminal(p => !p), [])
  const toggleChat = useCallback(() => setShowChat(p => !p), [])
  const toggleEditor = useCallback(() => setShowEditor(p => !p), [])

  const handleSelectFile = (path: string) => {
    fetch(`/api/files?action=read&path=${encodeURIComponent(path)}`)
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => {
            throw new Error(err.error || 'Failed to load file')
          })
        }
        return res.json()
      })
      .then(data => {
        const existingTab = tabs.find(t => t.path === path)
        if (existingTab) {
          setActiveTabId(existingTab.id)
        } else {
          const newTab: Tab = {
            id: Date.now().toString(),
            name: path.split('/').pop() || path,
            path,
            language: path.endsWith('.ts') ? 'typescript' : 
                      path.endsWith('.js') ? 'javascript' :
                      path.endsWith('.json') ? 'json' :
                      path.endsWith('.sql') ? 'sql' : 'text',
            content: data.content || ''
          }
          setTabs(prev => [...prev, newTab])
          setActiveTabId(newTab.id)
        }
        debouncedLint(path, data.content)
      })
      .catch(error => {
        console.error('Error loading file:', error)
        alert(`Failed to load file: ${error.message}`)
      })
  }

  const handleReloadFile = async (filePath: string) => {
    try {
      const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
      if (!res.ok) throw new Error('Failed to reload file')
      const data = await res.json()
      setTabs(prev => prev.map(t => 
        t.path === filePath ? { ...t, content: data.content } : t
      ))
    } catch (error) {
      console.error('Error reloading file:', error)
    }
  }

  const handleRefreshFileTree = () => {
    setFileTreeKey(prev => prev + 1)
  }

  const handleSaveFile = async (content?: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (!activeTab) return

    const fileContent = content || activeTab.content

    try {
      const res = await fetch('/api/files/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_FILE',
          targetPath: activeTab.path,
          content: fileContent
        })
      })

      if (res.ok) {
        console.log('File saved successfully')
      } else {
        alert('Failed to save file')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save file')
    }
  }

  const handleTabClose = (id: string) => {
    setTabs(prev => prev.filter(t => t.id !== id))
    if (activeTabId === id) {
      const remaining = tabs.filter(t => t.id !== id)
      if (remaining.length > 0) {
        setActiveTabId(remaining[remaining.length - 1].id)
      }
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-zinc-200 overflow-hidden select-none">
      <TopMenuBar 
        onSave={handleSaveFile} 
        activeFilePath={activeTabContent?.path || null}
        fileTreePath={fileTreePath || null}
        onCloseTab={() => activeTabContent && handleTabClose(activeTabContent.id)}
        onCloseAllTabs={() => setTabs([])}
        onToggleSidebar={toggleSidebar}
        onToggleTerminal={toggleTerminal}
        onToggleChat={toggleChat}
        onToggleEditor={toggleEditor}
        showSidebar={showSidebar}
        showTerminal={showTerminal}
        showChat={showChat}
        showEditor={showEditor}
        onOpenFolder={(path) => { setFileTreePath(path); setFileTreeKey(k => k + 1) }}
        onOpenFile={(name, content) => {
          const newTab = {
            id: Date.now().toString(),
            name,
            path: name,
            language: name.endsWith('.ts') ? 'typescript' : name.endsWith('.js') ? 'javascript' : 'text',
            content
          }
          setTabs(prev => [...prev, newTab])
          setActiveTabId(newTab.id)
        }}
      />

      <div className="flex-1 min-h-0 w-full flex">
        <ActivityBar />
        
        <div className="flex-1 min-h-0 overflow-hidden">
          <PanelGroup direction="horizontal" autoSaveId="ide-layout">
            {showSidebar && (
              <>
                <Panel id="sidebar" order={1} defaultSize={15} minSize={10} maxSize={30} className="overflow-hidden bg-zinc-950/50 flex flex-col">
                  <div className="flex-1 overflow-y-auto">
                    {settingsLoaded && <FileTree key={fileTreeKey} startPath={fileTreePath} activeFilePath={activeTabContent?.path || null} onFileSelect={handleSelectFile} onRefresh={handleRefreshFileTree} lintResults={lintResults} />}
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-col-resize" />
              </>
            )}

            {showEditor && (
              <Panel id="editor" order={2} defaultSize={55} minSize={30} className="overflow-hidden flex flex-col">
                <PanelGroup direction="vertical" autoSaveId="ide-editor-layout">
                  <Panel id="editor-panel" order={1} defaultSize={70} minSize={20} className="overflow-hidden bg-neutral-900 flex flex-col">
                    <div className="h-9 bg-zinc-950/80 border-b border-zinc-800 flex items-center shrink-0 overflow-x-auto">
                      <div className="flex items-center h-full">
                        {tabs.map((tab, idx) => (
                          <div
                            key={tab.id}
                            className={`group relative flex items-center gap-1.5 px-3 h-full text-xs cursor-pointer border-r border-zinc-800/50 transition-colors ${
                              activeTabId === tab.id
                                ? 'bg-neutral-900 text-white'
                                : 'bg-zinc-950/50 text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                            }`}
                            onClick={() => setActiveTabId(tab.id)}
                          >
                            <span className="shrink-0">
                              {getFileTabIcon(tab.name)}
                            </span>
                            <span className="truncate max-w-[120px]">{tab.name}</span>
                            {(() => {
                              const lint = lintResults[tab.path]
                              if (!lint || (lint.errors === 0 && lint.warnings === 0)) return null
                              return (
                                <span className={`ml-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold leading-none ${lint.errors > 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                  {lint.errors > 0 ? lint.errors : lint.warnings}
                                </span>
                              )
                            })()}
                            <button
                              className="w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-700/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={e => { e.stopPropagation(); handleTabClose(tab.id) }}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                <path d="M2.5 2.5l5 5m-5 0l5-5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                              </svg>
                            </button>
                            {activeTabId === tab.id && (
                              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {activeTabContent && (
                      <Breadcrumbs activePath={activeTabContent.path} />
                    )}
                    <div className="flex-1 overflow-hidden">
                      {useVSCode ? (
                        <VSCodePanel />
                      ) : (
                        <div className="h-full overflow-hidden">
                          {activeTabContent ? (
                            <CodeEditor
                              value={activeTabContent.content}
                              filePath={activeTabContent.path}
                              onChange={(content) => {
                                setTabs(prev => prev.map(t => 
                                  t.id === activeTabId ? { ...t, content } : t
                                ))
                                if (activeTabContent) debouncedLint(activeTabContent.path, content)
                              }}
                              onSave={handleSaveFile}
                              animationEvent={animEvent}
                            />
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500 select-none">
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-zinc-700">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                              </svg>
                              <span className="text-sm">Select a file to edit</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Panel>

                  {showTerminal && (
                    <>
                      <PanelResizeHandle className="h-1 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-row-resize" />
                      <Panel id="terminal-panel" order={2} defaultSize={30} minSize={10} className="overflow-hidden bg-neutral-950 flex flex-col">
                        <div className="h-8 border-b border-zinc-900 bg-zinc-950 flex items-center px-4 text-xs gap-4 text-zinc-400 shrink-0">
                          <span className="text-zinc-100 border-b border-white h-full flex items-center">Terminal</span>
                          <span>Output</span>
                          <span>Console</span>
                          <span>Problems</span>
                        </div>
                        <div className="flex-1 min-h-0">
                          <TerminalPanel cwd={fileTreePath} />
                        </div>
                      </Panel>
                    </>
                  )}
                </PanelGroup>
              </Panel>
            )}

            {showChat && (
              <>
                <PanelResizeHandle className="w-1 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-col-resize" />
                <Panel id="chat" order={3} defaultSize={30} minSize={20} maxSize={45} className="overflow-hidden bg-zinc-950 flex flex-col">
                  <div className="flex-1 overflow-hidden">
                    <ChatPanel 
                      onRefreshFileTree={handleRefreshFileTree}
                      onReloadFile={handleReloadFile}
                      onFileModified={setAnimEvent}
                      activeFilePath={activeTabContent?.path || null}
                      fileTreePath={fileTreePath || null}
                      selectedModel={selectedModel}
                      onModelChange={setSelectedModel}
                      selectedSkill={selectedSkill}
                      onSkillChange={setSelectedSkill}
                    />
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      </div>

      <footer className="h-6 w-full bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-3 text-xs text-zinc-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-zinc-500">⎇</span>
            <span>{activeTabContent ? (activeTabContent.language || 'text') : 'main'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>{activeTabContent ? activeTabContent.language || 'Plain' : ''}</span>
          <span>{Object.values(lintResults).reduce((sum, l) => sum + l.errors + l.warnings, 0)} Problems</span>
        </div>
      </footer>
    </div>
  )
}