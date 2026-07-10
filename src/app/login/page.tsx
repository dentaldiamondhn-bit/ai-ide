'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-auth'
import { Sparkles, Terminal, Mail, Lock, ShieldAlert, Cpu, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setSuccessMsg('Terminal Account Created! Check your email to verify your security access code.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.refresh()
        router.push('/')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification sequences failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-300 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none selection:bg-sky-500/30">
      
      {/* Decorative cyber grid lines background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Futuristic glow elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-sky-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative z-10">
        
        {/* Upper brand banner */}
        <div className="text-center space-y-2.5 mb-8">
          <div className="flex justify-center items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-sky-600/10 border border-sky-500/20 flex items-center justify-center font-bold text-sky-400 text-lg select-none shadow-lg shadow-sky-500/5">
              Ω
            </span>
            <span className="text-xl font-bold tracking-tight text-white font-mono">ai-ide</span>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed max-w-xs mx-auto">
            Authorized session terminal window access. Identify credentials below to secure agent connectivity logs.
          </p>
        </div>

        {/* Dynamic Alerts */}
        {errorMsg && (
          <div className="p-3 mb-5 rounded-lg border border-rose-900/40 bg-rose-500/10 text-rose-400 text-xs flex items-start gap-2.5 leading-relaxed">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-5 rounded-lg border border-emerald-900/40 bg-emerald-500/10 text-emerald-400 text-xs flex items-start gap-2.5 leading-relaxed">
            <CheckCircle size={14} className="shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5 font-mono flex items-center gap-1.5">
              <Mail size={11} className="text-zinc-600" /> EMAIL SECURITY TOKEN
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="developer@ai-ide.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5 font-mono flex items-center gap-1.5">
              <Lock size={11} className="text-zinc-600" /> SESSION PASS-KEY
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl text-xs text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/10"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Cpu size={14} />
                <span>{isSignUp ? 'Initiate Account Deploy' : 'Open Workspace Gate'}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-900/60 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setErrorMsg('')
              setSuccessMsg('')
            }}
            className="text-[11px] text-zinc-500 hover:text-sky-400 transition-colors inline-flex items-center gap-1"
          >
            <span>{isSignUp ? 'Already authenticated?' : 'Need a private workspace pipeline?'}</span>
            <span className="font-semibold text-sky-500/80 hover:underline">
              {isSignUp ? 'Verify Access' : 'Create Credentials'}
            </span>
          </button>
        </div>

      </div>
    </div>
  )
}
