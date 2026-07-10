'use client'

import React, { useState } from 'react'
import { Settings, Cpu, Palette, Sliders, ShieldCheck, Check } from 'lucide-react'

interface IDESettings {
  aiModel: string
  telemetryEnabled: boolean
  autoSave: boolean
  approvalThreshold: 'always' | 'modified_only' | 'never'
  autoCommitOnSave: boolean
  terminalTheme: string
  gutterDiffs: boolean
}

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<'ai' | 'visuals' | 'system'>('ai')
  const [savedSuccess, setSavedSuccess] = useState(false)

  const [settings, setSettings] = useState<IDESettings>({
    aiModel: 'minimaxai/minimax-m3',
    telemetryEnabled: true,
    autoSave: true,
    approvalThreshold: 'always',
    autoCommitOnSave: false,
    terminalTheme: 'Dracula Dark',
    gutterDiffs: true
  })

  const handleSave = () => {
    localStorage.setItem('ide-settings', JSON.stringify(settings))
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  const update = (patch: Partial<IDESettings>) => setSettings(s => ({ ...s, ...patch }))

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 font-sans select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-900/40">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Settings size={13} className="text-sky-400" /> Settings
        </span>
        <button
          onClick={handleSave}
          className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all"
        >
          {savedSuccess ? <><Check size={11} /> Saved</> : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800/40 bg-zinc-900/10 text-[10px] font-bold text-zinc-500">
        {(['ai', 'visuals', 'system'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-center border-b transition-colors ${
              activeTab === tab ? 'text-sky-400 border-sky-500/80 bg-zinc-900/20' : 'border-transparent hover:text-zinc-300'
            }`}
          >
            {tab === 'ai' ? 'AI Engine' : tab === 'visuals' ? 'Visuals' : 'System'}
          </button>
        ))}
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* AI Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1 mb-1.5">
                <Cpu size={12} className="text-zinc-400" /> Active Model
              </label>
              <select
                value={settings.aiModel}
                onChange={(e) => update({ aiModel: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/40"
              >
                <optgroup label="NVIDIA Hosted">
                  <option value="minimaxai/minimax-m3">MiniMax M3 (Default)</option>
                  <option value="nvidia/llama-3.3-nemotron-super-49b-v1">Nemotron Super 49B</option>
                  <option value="nvidia/llama-3.1-nemotron-70b-instruct">Nemotron 70B</option>
                  <option value="qwen/qwen3-coder-480b-a35b-instruct">Qwen3 Coder 480B</option>
                  <option value="deepseek-ai/deepseek-r1">DeepSeek R1</option>
                  <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                </optgroup>
              </select>
            </div>

            <div className="pt-3 border-t border-zinc-800/40 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <ShieldCheck size={12} className="text-zinc-400" /> Tool Approval
              </label>
              <div className="space-y-1.5">
                {(['always', 'modified_only', 'never'] as const).map(mode => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                    <input
                      type="radio"
                      name="approvalMode"
                      checked={settings.approvalThreshold === mode}
                      onChange={() => update({ approvalThreshold: mode })}
                      className="accent-sky-500"
                    />
                    <span className="capitalize">{mode.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Visuals Tab */}
        {activeTab === 'visuals' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1 mb-1.5">
                <Palette size={12} className="text-zinc-400" /> Terminal Theme
              </label>
              <select
                value={settings.terminalTheme}
                onChange={(e) => update({ terminalTheme: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/40"
              >
                <option value="Dracula Dark">Dracula (Vivid)</option>
                <option value="Zinc Modern">Zinc Dark (Tailwind)</option>
                <option value="One Dark Pro">One Dark Pro</option>
              </select>
            </div>

            <div className="space-y-3 pt-3 border-t border-zinc-800/40">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Effects</label>

              <label className="flex items-center justify-between cursor-pointer text-xs text-zinc-300">
                <span>anime.js telemetry shimmers</span>
                <input
                  type="checkbox"
                  checked={settings.telemetryEnabled}
                  onChange={(e) => update({ telemetryEnabled: e.target.checked })}
                  className="accent-sky-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer text-xs text-zinc-300">
                <span>Editor gutter diffs</span>
                <input
                  type="checkbox"
                  checked={settings.gutterDiffs}
                  onChange={(e) => update({ gutterDiffs: e.target.checked })}
                  className="accent-sky-500 rounded"
                />
              </label>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Sliders size={12} className="text-zinc-400" /> Workspace
              </label>

              <label className="flex items-center justify-between cursor-pointer text-xs text-zinc-300">
                <span>Auto-save on change</span>
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => update({ autoSave: e.target.checked })}
                  className="accent-sky-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer text-xs text-zinc-300">
                <span>Auto-commit approved changes</span>
                <input
                  type="checkbox"
                  checked={settings.autoCommitOnSave}
                  onChange={(e) => update({ autoCommitOnSave: e.target.checked })}
                  className="accent-sky-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer text-xs text-zinc-300">
                <span>Bypass peer dependency checks</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="accent-sky-500 rounded"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
