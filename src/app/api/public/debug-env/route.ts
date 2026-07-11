import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const authCookie = allCookies.find(c => c.name.endsWith('-auth-token'))

  let cookieFormat = 'none'
  let userId = null
  if (authCookie) {
    try {
      let value = authCookie.value
      try { value = decodeURIComponent(value) } catch {}
      const parsed = JSON.parse(value)
      const session = parsed?.currentSession || parsed
      const accessToken = session?.access_token
      if (accessToken) {
        cookieFormat = 'supabase-ssr-v0.12+'
        const parts = accessToken.split('.')
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
          const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
          const payload = JSON.parse(atob(padded))
          userId = payload.sub
        }
      } else {
        cookieFormat = 'unknown-json'
      }
    } catch {
      cookieFormat = 'parse-error'
    }
  }

  return Response.json({
    totalCookies: allCookies.length,
    hasAuthCookie: !!authCookie,
    authCookieName: authCookie?.name || null,
    cookieFormat,
    userId,
    envStatus: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) + '...' || 'MISSING',
    },
  })
}
