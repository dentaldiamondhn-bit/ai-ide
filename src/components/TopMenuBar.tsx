'use client'

import { useCallback } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PanelLeft, PanelRight, Terminal, PanelTop } from 'lucide-react'

interface TopMenuBarProps {
  onSave?: () => void
  activeFilePath?: string | null
  fileTreePath?: string | null
  onNewFile?: () => void
  onNewFolder?: () => void
  onCloseTab?: () => void
  onCloseAllTabs?: () => void
  onToggleSidebar?: () => void
  onToggleTerminal?: () => void
  onToggleChat?: () => void
  onToggleEditor?: () => void
  showSidebar?: boolean
  showTerminal?: boolean
  showChat?: boolean
  showEditor?: boolean
  onOpenFolder?: (path: string) => void
  onOpenFile?: (path: string, content: string) => void
}

function createFileOrFolder(type: 'FILE' | 'FOLDER') {
  const name = prompt(`Enter new ${type.toLowerCase()} name:`)
  if (!name) return
  const targetPath = `${process.cwd()}/${name}`
  fetch('/api/files/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: type === 'FILE' ? 'CREATE_FILE' : 'CREATE_FOLDER', targetPath }),
  }).then(r => r.json()).then(data => {
    if (!data.success) alert('Failed to create ' + type.toLowerCase())
    else window.location.reload()
  })
}

export default function TopMenuBar({ onSave, activeFilePath, fileTreePath, onNewFile, onNewFolder, onCloseTab, onCloseAllTabs, onToggleSidebar, onToggleTerminal, onToggleChat, onToggleEditor, showSidebar, showTerminal, showChat, showEditor, onOpenFolder, onOpenFile }: TopMenuBarProps) {
  const filename = activeFilePath ? activeFilePath.split('/').pop() : 'Workspace'
  const folderName = fileTreePath ? fileTreePath.split('/').pop() || fileTreePath : null

  const handleSave = () => onSave?.()

  const handleNewFile = useCallback(() => {
    const name = prompt('Enter file name:')
    if (!name) return
    fetch('/api/files/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE_FILE', targetPath: name }),
    }).then(r => r.json()).then(d => { if (!d.success) alert('Failed') })
  }, [])

  const handleNewFolder = useCallback(() => {
    const name = prompt('Enter folder name:')
    if (!name) return
    fetch('/api/files/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE_FOLDER', targetPath: name }),
    }).then(r => r.json()).then(d => { if (!d.success) alert('Failed') })
  }, [])

  return (
    <header className="h-9 w-full bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between px-3 text-xs select-none z-50">
      <div className="flex items-center gap-2">
        <span className="font-bold text-sky-400 tracking-wider text-sm mr-2">Ω</span>
        
        <div className="flex items-center gap-0.5">
          {/* File */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-2.5 py-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-100 font-medium font-sans cursor-pointer">
              File
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200 min-w-[200px]">
              <DropdownMenuItem onClick={handleNewFile} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                New File <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+N</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNewFolder} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                New Folder <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+Shift+N</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onSelect={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.onchange = () => {
                  const file = input.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const content = reader.result as string
                    if (onOpenFile) onOpenFile(file.name, content)
                  }
                  reader.readAsText(file)
                }
                input.click()
              }} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Open File... <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+O</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {
                const path = prompt('Enter directory path to open:', '/home/dentaldiamondhn')
                if (path && onOpenFolder) onOpenFolder(path)
              }} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Open Folder... <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+K Ctrl+O</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={handleSave} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Save <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+S</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Save As... <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+Shift+S</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={onCloseTab} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Close Tab <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+W</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCloseAllTabs} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Close All Tabs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-2.5 py-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-100 font-medium font-sans cursor-pointer">
              Edit
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200 min-w-[200px]">
              <DropdownMenuItem onClick={() => document.execCommand?.('undo') || alert('Undo not available')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Undo <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+Z</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.execCommand?.('redo') || alert('Redo not available')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Redo <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+Shift+Z</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={() => document.execCommand?.('cut') || alert('Cut not available')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Cut <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+X</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.execCommand?.('copy') || alert('Copy not available')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Copy <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+C</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.execCommand?.('paste') || alert('Paste not available')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Paste <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+V</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={() => alert('Find: Ctrl+F')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Find <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+F</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert('Replace: Ctrl+H')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Replace <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+H</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert('Find in Files: Ctrl+Shift+F')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Find in Files <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+Shift+F</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Selection */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-2.5 py-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-100 font-medium font-sans cursor-pointer">
              Selection
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200 min-w-[200px]">
              <DropdownMenuItem onClick={() => document.execCommand?.('selectAll') || alert('Select All not available')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Select All <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+A</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2 opacity-50">
                Expand Selection <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+=</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2 opacity-50">
                Shrink Selection <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+-</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-2.5 py-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-100 font-medium font-sans cursor-pointer">
              View
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200 min-w-[200px]">
              <DropdownMenuItem onClick={() => alert('Command Palette')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Command Palette <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+Shift+P</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={onToggleSidebar} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                <span className="flex items-center gap-2">
                  {showSidebar ? '✓ ' : ''}Toggle Sidebar
                </span>
                <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+B</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleEditor} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                <span className="flex items-center gap-2">
                  {showEditor ? '✓ ' : ''}Toggle Editor
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleTerminal} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                <span className="flex items-center gap-2">
                  {showTerminal ? '✓ ' : ''}Toggle Terminal
                </span>
                <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+`</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleChat} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                <span className="flex items-center gap-2">
                  {showChat ? '✓ ' : ''}Toggle Chat Panel
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={() => alert('Zoom In')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Zoom In <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+=</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert('Zoom Out')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Zoom Out <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+-</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { try { document.documentElement.requestFullscreen() } catch { alert('Fullscreen not available') } }} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Full Screen <span className="ml-auto text-zinc-500 text-[10px]">F11</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Go */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-2.5 py-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-100 font-medium font-sans cursor-pointer">
              Go
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200 min-w-[200px]">
              <DropdownMenuItem onClick={() => alert('Go to File: Ctrl+P')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Go to File <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+P</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert('Go to Line: Ctrl+G')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Go to Line <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+G</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2 opacity-50">
                Go to Definition <span className="ml-auto text-zinc-500 text-[10px]">F12</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2 opacity-50">
                Go to Symbol <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+Shift+O</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2 opacity-50">
                Back <span className="ml-auto text-zinc-500 text-[10px]">Alt+Left</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2 opacity-50">
                Forward <span className="ml-auto text-zinc-500 text-[10px]">Alt+Right</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Terminal */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-2.5 py-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-100 font-medium font-sans cursor-pointer">
              Terminal
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200 min-w-[200px]">
              <DropdownMenuItem onClick={() => alert('New Terminal')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                New Terminal <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+`</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={() => alert('Run Task...')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Run Task...
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert('Run Build Task: Ctrl+Shift+B')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Run Build Task <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+Shift+B</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2 opacity-50">
                Configure Tasks...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-2.5 py-1 rounded text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-100 font-medium font-sans cursor-pointer">
              Help
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200 min-w-[200px]">
              <DropdownMenuItem onClick={() => window.open('https://opencode.ai', '_blank')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Documentation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert('Keyboard Shortcuts: Ctrl+K Ctrl+S')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Keyboard Shortcuts <span className="ml-auto text-zinc-500 text-[10px]">Ctrl+K Ctrl+S</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={() => window.open('https://github.com/anomalyco/opencode/issues', '_blank')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                Report Issue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert('AI-IDE v1.0.0 - Built with Next.js')} className="focus:bg-zinc-800 focus:text-zinc-50 cursor-pointer py-2">
                About
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="text-zinc-500 text-[11px] font-mono truncate max-w-md hidden sm:block">
        {folderName ? `${folderName} — ${filename}` : `ai-ide — ${filename}`}
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded transition-colors ${showSidebar ? 'text-zinc-200 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
          title="Toggle File Explorer"
        >
          <PanelLeft size={15} />
        </button>
        <button
          onClick={onToggleEditor}
          className={`p-1.5 rounded transition-colors ${showEditor ? 'text-zinc-200 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
          title="Toggle Editor"
        >
          <PanelTop size={15} />
        </button>
        <button
          onClick={onToggleTerminal}
          className={`p-1.5 rounded transition-colors ${showTerminal ? 'text-zinc-200 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
          title="Toggle Terminal"
        >
          <Terminal size={15} />
        </button>
        <button
          onClick={onToggleChat}
          className={`p-1.5 rounded transition-colors ${showChat ? 'text-zinc-200 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
          title="Toggle Chat Panel"
        >
          <PanelRight size={15} />
        </button>
      </div>
    </header>
  )
}
