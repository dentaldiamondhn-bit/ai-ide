import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user?.id) return user.id
  } catch {}

  try {
    const cookieStore = await cookies()
    const authCookie = cookieStore.getAll().find(c => c.name.endsWith('-auth-token'))
    if (!authCookie) return null
    let value = authCookie.value
    try { value = decodeURIComponent(value) } catch {}
    const parsed = JSON.parse(value)
    const session = parsed?.currentSession || parsed
    const accessToken = session?.access_token
    if (!accessToken) return null
    const parts = accessToken.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const payload = JSON.parse(atob(padded))
    return payload.sub || null
  } catch {}

  return null
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return Response.json({ settings: null })

  const deviceId = req.headers.get('x-device-id') || 'default'

  // Try with device_id column first
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_ide_settings')
      .select('value')
      .eq('key', 'app_settings')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .single()

    if (!error && data) return Response.json({ settings: data.value || null })
  } catch {}

  // Fallback: no device_id column yet
  try {
    const { data } = await supabaseAdmin
      .from('ai_ide_settings')
      .select('value')
      .eq('key', 'app_settings')
      .eq('user_id', userId)
      .single()

    return Response.json({ settings: data?.value || null })
  } catch {
    return Response.json({ settings: null })
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return Response.json({ success: true })

  const deviceId = req.headers.get('x-device-id') || 'default'

  try {
    const { settings } = await req.json()

    const safeSettings = { ...settings }
    if (safeSettings.tabs && Array.isArray(safeSettings.tabs)) {
      safeSettings.tabs = safeSettings.tabs.map((t: any) => ({
        id: t.id, name: t.name, path: t.path, language: t.language,
      }))
    }

    // Try with device_id first
    try {
      const existing = await supabaseAdmin
        .from('ai_ide_settings')
        .select('id')
        .eq('key', 'app_settings')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .maybeSingle()

      if (existing.error) throw existing.error

      let result
      if (existing.data) {
        result = await supabaseAdmin
          .from('ai_ide_settings')
          .update({ value: safeSettings })
          .eq('id', existing.data.id)
      } else {
        result = await supabaseAdmin
          .from('ai_ide_settings')
          .insert({ key: 'app_settings', user_id: userId, device_id: deviceId, value: safeSettings })
      }

      if (result.error) throw result.error
      return Response.json({ success: true })
    } catch {
      // Fallback: no device_id column — use plain user_id
      const existing = await supabaseAdmin
        .from('ai_ide_settings')
        .select('id')
        .eq('key', 'app_settings')
        .eq('user_id', userId)
        .maybeSingle()

      let result
      if (existing.data) {
        result = await supabaseAdmin
          .from('ai_ide_settings')
          .update({ value: safeSettings })
          .eq('id', existing.data.id)
      } else {
        result = await supabaseAdmin
          .from('ai_ide_settings')
          .insert({ key: 'app_settings', user_id: userId, value: safeSettings })
      }

      if (result.error) {
        return Response.json({ error: result.error.message }, { status: 500 })
      }
      return Response.json({ success: true })
    }
  } catch {
    return Response.json({ success: true })
  }
}
