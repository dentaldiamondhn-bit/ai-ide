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
import SourceControlPanel from '@/components/SourceControlPanel'
import SearchPanel from '@/components/SearchPanel'
import CodemapsPanel from '@/components/CodemapsPanel'
import CodeWikiPanel from '@/components/CodeWikiPanel'
import SettingsPanel from '@/components/SettingsPanel'
import VSCodePanel from '@/components/VSCodePanel'
import WelcomeScreen from '@/components/WelcomeScreen'
import { isFileSystemAccessSupported, mapLocalDirectory, readLocalFile, writeLocalFile, findFileHandle, findDirHandleByPath, createLocalResource, deleteLocalResource } from '@/lib/local-fs'
import type { LocalFileNode } from '@/lib/local-fs'

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
  const [activeActivityTab, setActiveActivityTab] = useState('files')
  const [fsRootHandle, setFsRootHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [fsTree, setFsTree] = useState<LocalFileNode[]>([])
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
        } else {
          // No Supabase settings yet — use defaults
        }
      })
      .catch(() => {})
      .finally(() => { setSettingsLoaded(true) })
  }, [])

  useEffect(() => {
    if (!settingsLoaded) return
    const timeout = setTimeout(() => {
      const settings = { 
        showSidebar, 
        showTerminal, 
        showChat, 
        showEditor, 
        useVSCode, 
        fileTreePath, 
        selectedModel,
        selectedSkill,
        activeTabId,
        tabs: tabs.map(t => ({ id: t.id, name: t.name, path: t.path, language: t.language }))
      }
      fetch('/api/db/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      }).catch(() => {})
    }, 500)
    return () => clearTimeout(timeout)
  }, [showSidebar, showTerminal, showChat, showEditor, useVSCode, fileTreePath, selectedModel, selectedSkill, activeTabId, tabs, settingsLoaded])

  const toggleSidebar = useCallback(() => setShowSidebar(p => !p), [])
  const toggleTerminal = useCallback(() => setShowTerminal(p => !p), [])
  const toggleChat = useCallback(() => setShowChat(p => !p), [])
  const toggleEditor = useCallback(() => setShowEditor(p => !p), [])

  const handleOpenFolder = useCallback(async (path: string) => {
    // Try File System Access API first (direct local file access, no server needed)
    if (!path && isFileSystemAccessSupported()) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
        const tree = await mapLocalDirectory(dirHandle, dirHandle.name)
        setFsRootHandle(dirHandle)
        setFsTree(tree)
        setFileTreePath(dirHandle.name)
        setFileTreeKey(k => k + 1)
        return
      } catch (err) {
        // User cancelled picker — fall through to WebSocket/HTTP path
      }
    }
    // Fall back to WebSocket / HTTP API path
    setFsRootHandle(null)
    setFsTree([])
    setFileTreePath(path || undefined)
    setFileTreeKey(k => k + 1)
    if (path) {
      try {
        const stored = localStorage.getItem('ia-ide-recent-workspaces')
        let recents: string[] = stored ? JSON.parse(stored) : []
        recents = recents.filter(item => item !== path)
        recents.unshift(path)
        localStorage.setItem('ia-ide-recent-workspaces', JSON.stringify(recents.slice(0, 12)))
      } catch (err) {
        console.error('Failed to log recent workspace', err)
      }
    }
  }, [])

  const handleSelectFile = async (path: string) => {
    try {
      let content = ''
      // Try File System Access API first
      if (fsRootHandle && fsTree.length > 0) {
        try {
          const fileHandle = findFileHandle(fsTree, path)
          if (fileHandle) {
            content = await readLocalFile(fileHandle)
          }
        } catch {}
      }
      // Try WebSocket next
      if (!content) {
        try {
          const { wsReadFile } = await import('@/lib/ws-file-client')
          const wsContent = await wsReadFile(path)
          if (wsContent !== null) content = wsContent
        } catch {}
      }
      // Fall back to HTTP API
      if (!content) {
        const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(path)}`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to load file')
        }
        const data = await res.json()
        content = data.content || ''
      }
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
          content
        }
        setTabs(prev => [...prev, newTab])
        setActiveTabId(newTab.id)
      }
      debouncedLint(path, content)
    } catch (error: any) {
      console.error('Error loading file:', error)
      alert(`Failed to load file: ${error.message}`)
    }
  }

  const handleReloadFile = async (filePath: string) => {
    try {
      let content = ''
      if (fsRootHandle && fsTree.length > 0) {
        try {
          const fileHandle = findFileHandle(fsTree, filePath)
          if (fileHandle) content = await readLocalFile(fileHandle)
        } catch {}
      }
      if (!content) {
        try {
          const { wsReadFile } = await import('@/lib/ws-file-client')
          const wsContent = await wsReadFile(filePath)
          if (wsContent !== null) content = wsContent
        } catch {}
      }
      if (!content) {
        const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
        if (!res.ok) throw new Error('Failed to reload file')
        const data = await res.json()
        content = data.content || ''
      }
      setTabs(prev => prev.map(t => 
        t.path === filePath ? { ...t, content } : t
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
      // Try File System Access API first
      if (fsRootHandle && fsTree.length > 0) {
        try {
          const fileHandle = findFileHandle(fsTree, activeTab.path)
          if (fileHandle) {
            const ok = await writeLocalFile(fileHandle, fileContent)
            if (ok) { console.log('File saved to local disk'); return }
          }
        } catch {}
      }
      // Try WebSocket next
      try {
        const { wsFileAction } = await import('@/lib/ws-file-client')
        const result = await wsFileAction('SAVE_FILE', activeTab.path, fileContent)
        if (result) { console.log('File saved via WebSocket'); return }
      } catch {}
      // Fall back to HTTP API
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

  const handleNewFile = useCallback(async () => {
    const name = prompt('Enter new file name:')
    if (!name) return
    // Try File System Access API first
    if (fsRootHandle && fsTree.length > 0) {
      try {
        const dirHandle = findDirHandleByPath(fsTree, fileTreePath || fsRootHandle.name) || fsRootHandle
        await createLocalResource(dirHandle, name, 'file')
        const updatedTree = await mapLocalDirectory(fsRootHandle, fsRootHandle.name)
        setFsTree(updatedTree)
        handleRefreshFileTree()
        const filePath = fileTreePath ? `${fileTreePath}/${name}` : name
        handleSelectFile(filePath)
        return
      } catch {}
    }
    const root = fileTreePath || '/home/dentaldiamondhn/diamond-link-original'
    const targetPath = `${root}/${name}`.replace(/\/+/g, '/')
    try {
      try {
        const { wsFileAction } = await import('@/lib/ws-file-client')
        const result = await wsFileAction('CREATE_FILE', targetPath)
        if (result) { handleRefreshFileTree(); handleSelectFile(targetPath); return }
      } catch {}
      const res = await fetch('/api/files/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_FILE', targetPath }),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        handleRefreshFileTree()
        handleSelectFile(targetPath)
      } else {
        alert(`Failed to create file: ${data.error || 'Server error occurred.'}`)
      }
    } catch (err: any) {
      alert(`Failed to create file: ${err.message}`)
    }
  }, [fileTreePath, fsRootHandle, fsTree, handleRefreshFileTree, handleSelectFile])

  const handleNewFolder = useCallback(async () => {
    const name = prompt('Enter new folder name:')
    if (!name) return
    // Try File System Access API first
    if (fsRootHandle && fsTree.length > 0) {
      try {
        const dirHandle = findDirHandleByPath(fsTree, fileTreePath || fsRootHandle.name) || fsRootHandle
        await createLocalResource(dirHandle, name, 'directory')
        const updatedTree = await mapLocalDirectory(fsRootHandle, fsRootHandle.name)
        setFsTree(updatedTree)
        handleRefreshFileTree()
        return
      } catch {}
    }
    const root = fileTreePath || '/home/dentaldiamondhn/diamond-link-original'
    const targetPath = `${root}/${name}`.replace(/\/+/g, '/')
    try {
      try {
        const { wsFileAction } = await import('@/lib/ws-file-client')
        const result = await wsFileAction('CREATE_FOLDER', targetPath)
        if (result) { handleRefreshFileTree(); return }
      } catch {}
      const res = await fetch('/api/files/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_FOLDER', targetPath }),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        handleRefreshFileTree()
      } else {
        alert(`Failed to create folder: ${data.error || 'Server error occurred.'}`)
      }
    } catch (err: any) {
      alert(`Failed to create folder: ${err.message}`)
    }
  }, [fileTreePath, fsRootHandle, fsTree, handleRefreshFileTree])

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-zinc-200 overflow-hidden select-none">
      <TopMenuBar 
        onSave={handleSaveFile} 
        activeFilePath={activeTabContent?.path || null}
        fileTreePath={fileTreePath || null}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
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
        onOpenFolder={handleOpenFolder}
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
        <ActivityBar activeTab={activeActivityTab} onTabChange={setActiveActivityTab} />
        
        <div className="flex-1 min-h-0 overflow-hidden">
          <PanelGroup direction="horizontal" autoSaveId="ide-layout">
            {showSidebar && (
              <>
                <Panel id="sidebar" order={1} defaultSize={15} minSize={10} maxSize={30} className="overflow-hidden bg-zinc-950/50 flex flex-col">
                  <div className="flex-1 overflow-y-auto">
                    {activeActivityTab === 'git' ? (
                      <SourceControlPanel />
                    ) : activeActivityTab === 'search' ? (
                      <SearchPanel onSelectFile={(path) => handleSelectFile(path)} />
                    ) : activeActivityTab === 'codemaps' ? (
                      <CodemapsPanel onSelectFile={(path) => handleSelectFile(path)} />
                    ) : activeActivityTab === 'deepwiki' ? (
                      <CodeWikiPanel />
                    ) : activeActivityTab === 'settings' ? (
                      <SettingsPanel
                        currentPath={fileTreePath || ''}
                        openTabs={tabs}
                        activeTabId={activeTabId}
                        selectedModel={selectedModel}
                        selectedSkill={selectedSkill}
                        onModelChange={setSelectedModel}
                        onSkillChange={setSelectedSkill}
                      />
                    ) : (
                      settingsLoaded && <FileTree key={fileTreeKey} startPath={fileTreePath} activeFilePath={activeTabContent?.path || null} onFileSelect={handleSelectFile} onRefresh={handleRefreshFileTree} lintResults={lintResults} fsRootHandle={fsRootHandle} fsTree={fsTree} onFsTreeChange={setFsTree} />
                    )}
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
                            <WelcomeScreen
                              onOpenFolder={handleOpenFolder}
                              onNewFile={handleNewFile}
                              onNewFolder={handleNewFolder}
                              selectedModel={selectedModel}
                              onModelChange={setSelectedModel}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </Panel>

                  {showTerminal && (
                    <>
                      <PanelResizeHandle className="h-1 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-row-resize" />
                      <Panel id="terminal-panel" order={2} defaultSize={30} minSize={10} className="overflow-hidden bg-neutral-950 flex flex-col">
                        <div className="flex-1 min-h-0">
                          <TerminalPanel cwd={fileTreePath} lintResults={lintResults} />
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
                      openTabs={tabs}
                      lintResults={lintResults}
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