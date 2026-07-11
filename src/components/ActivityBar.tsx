'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import {
  Folder, GitBranch, Search, Layers, BookOpen, Settings, LogOut
} from 'lucide-react'

interface ActivityBarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [loggingOut, setLoggingOut] = useState(false)

  const tabs = [
    { id: 'files', label: 'Explorer', icon: <Folder size={18} /> },
    { id: 'git', label: 'Source Control', icon: <GitBranch size={18} /> },
    { id: 'search', label: 'Search', icon: <Search size={18} /> },
    { id: 'codemaps', label: 'Codemaps', icon: <Layers size={18} /> },
    { id: 'deepwiki', label: 'CodeWiki', icon: <BookOpen size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ]

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to end your secure terminal session?')) {
      setLoggingOut(true)
      try {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
      } catch (err) {
        console.error('Logout error:', err)
      } finally {
        setLoggingOut(false)
      }
    }
  }

  return (
    <div className="w-12 h-full bg-zinc-950 border-r border-zinc-900/60 flex flex-col justify-between items-center py-4 shrink-0 select-none">

      {/* Top: Logo & Tabs */}
      <div className="flex flex-col items-center gap-6 w-full">
        <span className="w-7 h-7 rounded-lg bg-sky-600/10 border border-sky-500/20 flex items-center justify-center font-bold text-sky-400 text-sm select-none shadow-sm shadow-sky-500/5">
          Ω
        </span>

        <div className="flex flex-col items-center gap-2 w-full">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
              }`}
              title={tab.label}
            >
              {tab.icon}
              {activeTab === tab.id && (
                <div className="absolute left-0 w-[3px] h-4 bg-sky-500 rounded-r-full" />
              )}
              <span className="absolute left-14 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-semibold px-2 py-1 rounded shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: Sign Out */}
      <div className="flex flex-col items-center gap-2 w-full">
        <button
          onClick={handleSignOut}
          disabled={loggingOut}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border hover:border-rose-500/20 transition-all cursor-pointer relative group"
          title="Sign Out Session"
        >
          {loggingOut ? (
            <span className="w-4 h-4 border-2 border-rose-400/25 border-t-rose-400 rounded-full animate-spin" />
          ) : (
            <LogOut size={16} />
          )}
          <span className="absolute left-14 bg-zinc-900 border border-zinc-800 text-rose-400 text-[10px] font-semibold px-2 py-1 rounded shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            End Terminal Session
          </span>
        </button>
      </div>
    </div>
  )
}
