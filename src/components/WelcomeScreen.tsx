'use client'

import React, { useEffect, useState } from 'react'
import { FolderOpen, FilePlus, Compass, Sparkles, Code2, Clock, ChevronRight, Laptop } from 'lucide-react'

interface WelcomeScreenProps {
  onOpenFolder: (path: string) => void
  onNewFile: () => void
  onNewFolder: () => void
  selectedModel: string
  onModelChange: (model: string) => void
}

export default function WelcomeScreen({
  onOpenFolder,
  onNewFile,
  onNewFolder,
  selectedModel,
  onModelChange
}: WelcomeScreenProps) {
  const [recentFolders, setRecentFolders] = useState<string[]>([])
  const [detectedHome, setDetectedHome] = useState<string>('/home')
  const [osLabel, setOsLabel] = useState<string>('System')

  useEffect(() => {
    fetch('/api/env')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDetectedHome(data.defaultWorkspaceRoot)
          setOsLabel(data.osLabel)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    try {
      const recents = localStorage.getItem('ia-ide-recent-workspaces')
      if (recents) setRecentFolders(JSON.parse(recents))
    } catch (e) {
      console.error('Failed to load recent workspaces', e)
    }
  }, [])

  const handleOpenFolderClick = () => {
    const path = prompt(`Enter directory path to open (${osLabel} detected):`, detectedHome)
    if (path) onOpenFolder(path)
  }

  return (
    <div className="h-full w-full bg-neutral-900/40 text-zinc-300 overflow-y-auto p-8 flex flex-col md:flex-row gap-12 select-none animate-in fade-in duration-200">

      {/* LEFT: Branding & Quick Start */}
      <div className="flex-1 max-w-xl space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white text-lg select-none shadow-lg shadow-sky-600/15">
              Ω
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">ai-ide</h1>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed max-w-sm">
            Autonomous Coding Agent Workspace. Powered by NVIDIA models and custom system toolkits.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-[11px] uppercase font-bold tracking-wider text-zinc-500">Start</h2>
          <div className="space-y-1.5">
            <button
              onClick={handleOpenFolderClick}
              className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all text-xs font-medium text-zinc-200 group"
            >
              <FolderOpen size={16} className="text-amber-500 shrink-0 group-hover:scale-105 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="truncate">Open Folder...</div>
                <div className="text-[10px] text-zinc-500 truncate font-normal">Navigate your local files directory</div>
              </div>
              <span className="text-[10px] text-zinc-600 font-mono px-1.5 py-0.5 bg-zinc-950 rounded">Ctrl+K Ctrl+O</span>
            </button>

            <button
              onClick={onNewFile}
              className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all text-xs font-medium text-zinc-200 group"
            >
              <FilePlus size={16} className="text-sky-400 shrink-0 group-hover:scale-105 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="truncate">New File...</div>
                <div className="text-[10px] text-zinc-500 truncate font-normal">Create a clean script or component</div>
              </div>
              <span className="text-[10px] text-zinc-600 font-mono px-1.5 py-0.5 bg-zinc-950 rounded">Ctrl+N</span>
            </button>

            <button
              onClick={onNewFolder}
              className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all text-xs font-medium text-zinc-200 group"
            >
              <Code2 size={16} className="text-emerald-400 shrink-0 group-hover:scale-105 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="truncate">New Folder...</div>
                <div className="text-[10px] text-zinc-500 truncate font-normal">Create structural directory scopes</div>
              </div>
              <span className="text-[10px] text-zinc-600 font-mono px-1.5 py-0.5 bg-zinc-950 rounded">Ctrl+Shift+N</span>
            </button>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h2 className="text-[11px] uppercase font-bold tracking-wider text-zinc-500">Quick Configuration</h2>
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/20 grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">AI Engine</label>
              <select
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-sky-500/40 font-medium"
              >
                <option value="minimaxai/minimax-m3">MiniMax M3 (Default)</option>
                <option value="deepseek/deepseek-chat">DeepSeek-Coder-V2</option>
                <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                <option value="qwen/qwen3-coder-480b-a35b-instruct">Qwen3 Coder 480B</option>
                <option value="nvidia/llama-3.1-nemotron-70b-instruct">Nemotron 70B</option>
                <option value="nvidia/llama-3.3-nemotron-super-49b-v1">Nemotron Super 49B</option>
                <option value="moonshotai/kimi-k2">Kimi K2</option>
                <option value="z-ai/glm-4.7">GLM 4.7</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <span className="text-[10px] text-zinc-500 block mb-1.5 leading-tight">Status</span>
              <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 rounded flex items-center gap-1.5">
                <Sparkles size={11} className="text-emerald-400 shrink-0" />
                <span>Autonomous Agent Armed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Recent Workspaces */}
      <div className="w-full md:w-80 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <h2 className="text-[11px] uppercase font-bold tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Clock size={12} className="text-zinc-500" /> Recent Workspaces
          </h2>
        </div>

        {recentFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800/80 rounded-xl space-y-2">
            <Laptop size={20} className="text-zinc-700" />
            <p className="text-[11px] text-zinc-500">No recent workspaces logged.</p>
            <button
              onClick={handleOpenFolderClick}
              className="text-[10px] text-sky-400 hover:underline"
            >
              Open a directory to start
            </button>
          </div>
        ) : (
          <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
            {recentFolders.map((pathStr) => {
              const name = pathStr.split('/').pop() || pathStr
              return (
                <button
                  key={pathStr}
                  onClick={() => onOpenFolder(pathStr)}
                  className="w-full text-left p-2 hover:bg-zinc-800/40 border border-transparent hover:border-zinc-800 rounded-lg group transition-all flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate font-mono">
                      {name}
                    </div>
                    <div className="text-[10px] text-zinc-500 group-hover:text-zinc-400 truncate font-mono">
                      {pathStr}
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 ml-2" />
                </button>
              )
            })}
          </div>
        )}

        <div className="p-3.5 rounded-lg border border-zinc-800 bg-sky-950/10 text-zinc-400 text-[11px] leading-relaxed space-y-1.5">
          <div className="font-semibold text-sky-400 flex items-center gap-1">
            <Compass size={12} />
            <span>Developer Tip</span>
          </div>
          <p className="text-zinc-500 text-[10px]">
            Use the AI Chat panel to ask questions, generate code, or modify files. The agent can read, write, and lint your workspace autonomously.
          </p>
        </div>
      </div>
    </div>
  )
}
