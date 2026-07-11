'use client'

import { useState, useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { 
  Mail, Lock, ShieldAlert, Cpu, CheckCircle, 
  Eye, EyeOff, Code2, Binary, TerminalSquare
} from 'lucide-react'
import { useRouter } from 'next/navigation'

const FLOATING_TAGS = ['import React', 'const app', 'await api()', 'const [db, setDb]', 'map((item) => ...)', 'export default', 'createClient()', 'git commit', 'npm run build', 'AST_NODE_MAPPED']

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [terminalLines, setTerminalLines] = useState<string[]>([
    'Initializing secure handshakes...',
    'Awaiting connection token identification...'
  ])
  const [bootProgress, setBootProgress] = useState(12)

  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    const messages = [
      'Authenticating system pipeline...',
      'Validating JWT cryptographic headers...',
      'Mapping workspace folder indexing systems...',
      'Securing sandbox environment allocations...',
      'Activating neural completion assistants...',
      'Configuring hot-module reloading pipelines...',
      'Scanning for diagnostics and lint variables...',
      'Deploying background compiler engines...'
    ]

    const interval = setInterval(() => {
      setTerminalLines(prev => {
        const nextMsg = messages[Math.floor(Math.random() * messages.length)]
        return [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] ${nextMsg}`]
      })
      setBootProgress(p => Math.min(100, p + Math.floor(Math.random() * 15)))
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    setTerminalLines(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] INITIATING AUTH SEQUENCE FOR: ${email}`
    ])

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        })
        if (error) throw error
        setSuccessMsg('Terminal Account Created! Check your email to verify your security access code.')
        setTerminalLines(prev => [...prev, `[SUCCESS] Account deployed. Verification email dispatched.`])
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        setTerminalLines(prev => [...prev, `[SUCCESS] Secure gate verification passed. Opening IDE...`])
        router.refresh()
        router.push('/')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification sequences failed.')
      setTerminalLines(prev => [...prev, `[CRITICAL_ERROR] Handshake failed: ${err.message || 'Verification rejected'}`])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-[#020203] text-zinc-300 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none selection:bg-sky-500/30">

      {/* Scan line effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(18,18,24,0)_95%,rgba(56,189,248,0.03)_95%)] bg-[size:100%_24px] pointer-events-none animate-pulse" />

      {/* Grid matrix background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_85%,transparent_100%)] pointer-events-none" />

      {/* Floating code tags */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        {FLOATING_TAGS.map((tag, idx) => (
          <div
            key={idx}
            className="absolute font-mono text-[11px] font-bold text-sky-400 select-none"
            style={{
              top: `${(idx * 11) % 95}%`,
              left: `${(idx * 23) % 85}%`,
              animation: `pulse ${4 + (idx % 3)}s infinite ease-in-out`
            }}
          >
            {tag}
          </div>
        ))}
      </div>

      {/* Cyber glows */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-sky-500/[0.02] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/[0.02] blur-[150px] rounded-full pointer-events-none" />

      {/* Main container */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">

        {/* Left: Live Compiler Simulator */}
        <div className="md:col-span-5 bg-zinc-950/40 border border-zinc-900/60 rounded-2xl p-6 backdrop-blur-md hidden md:flex flex-col justify-between h-[450px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono flex items-center gap-1.5">
                <TerminalSquare size={13} className="text-sky-400" /> Environment Telemetry
              </span>
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 border border-zinc-900/50 p-2.5 rounded-lg space-y-1">
                <span className="text-[9px] text-zinc-600 uppercase font-mono font-bold">Compiler status</span>
                <div className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1">
                  <Code2 size={12} /> AST_CLEAN
                </div>
              </div>
              <div className="bg-black/30 border border-zinc-900/50 p-2.5 rounded-lg space-y-1">
                <span className="text-[9px] text-zinc-600 uppercase font-mono font-bold">Connection Link</span>
                <div className="text-xs font-mono font-semibold text-sky-400 flex items-center gap-1">
                  <Binary size={12} /> SECURE_SSL
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <span className="text-[9px] text-zinc-500 uppercase font-mono font-bold">Live System Logs</span>
              <div className="bg-black/50 rounded-xl p-3 border border-zinc-900 font-mono text-[10px] leading-relaxed text-zinc-500 h-36 overflow-y-auto space-y-1 select-text">
                {terminalLines.map((line, i) => (
                  <div key={i} className="truncate">
                    <span className="text-zinc-700">{'>'}</span> {line}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Boot progress */}
          <div className="space-y-2 border-t border-zinc-900/60 pt-4">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span>SYSTEM COMPILE INDEX</span>
              <span className="text-sky-400 font-bold">{bootProgress}%</span>
            </div>
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 transition-all duration-700" style={{ width: `${bootProgress}%` }} />
            </div>
          </div>
        </div>

        {/* Right: Login Card */}
        <div className="md:col-span-7 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-8 backdrop-blur-md shadow-2xl flex flex-col justify-between">

          <div>
            {/* Brand */}
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

            {/* Alerts */}
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

            {/* Form */}
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
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-sky-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5 font-mono flex items-center gap-1.5">
                  <Lock size={11} className="text-zinc-600" /> SESSION PASS-KEY
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-sky-500/50 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl text-xs text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/10 cursor-pointer"
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
          </div>

          {/* Toggle */}
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
    </div>
  )
}
