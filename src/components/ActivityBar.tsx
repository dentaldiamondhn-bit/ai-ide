'use client'

import {
  Files,
  Search,
  GitBranch,
  Map,
  BookOpen,
  Blocks,
  Play,
  Settings,
} from 'lucide-react'
import { cn } from "@/lib/utils"

interface ActivityBarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const navItems = [
    { id: 'files', icon: Files, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Global Search' },
    { id: 'git', icon: GitBranch, label: 'Source Control' },
    { id: 'codemaps', icon: Map, label: 'Codemaps' },
    { id: 'deepwiki', icon: BookOpen, label: 'Deepwiki' },
    { id: 'extensions', icon: Blocks, label: 'Extensions' },
    { id: 'debug', icon: Play, label: 'Run and Debug' },
  ]

  return (
    <aside className="w-12 h-full bg-zinc-950 border-r border-zinc-900 flex flex-col justify-between items-center py-2 select-none">
      <div className="flex flex-col w-full items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isSelected = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={item.label}
              className={cn(
                "w-full py-3 flex items-center justify-center relative transition-colors group",
                isSelected ? "text-sky-400" : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-sky-400" />
              )}
              <Icon size={18} strokeWidth={1.5} />
            </button>
          )
        })}
      </div>

      <div className="flex flex-col w-full items-center gap-1">
        <button title="Settings" className="w-full py-3 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors">
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  )
}
