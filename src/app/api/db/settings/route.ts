import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function getUserIdFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    const authCookie = allCookies.find(c => c.name.endsWith('-auth-token'))
    if (!authCookie) return null

    let value = authCookie.value
    try { value = decodeURIComponent(value) } catch {}

    const parsed = JSON.parse(value)
    const session = parsed?.currentSession || parsed
    const accessToken = session?.access_token
    if (!accessToken) return null

    // Decode JWT payload to get user ID
    const parts = accessToken.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const payload = JSON.parse(atob(padded))
    return payload.sub || null
  } catch {
    return null
  }
}

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return Response.json({ settings: null })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_ide_settings')
      .select('value')
      .eq('key', 'app_settings')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ settings: data?.value || null })
  } catch {
    return Response.json({ settings: null })
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return Response.json({ success: true })
  }

  try {
    const { settings } = await req.json()

    const safeSettings = { ...settings }
    if (safeSettings.tabs && Array.isArray(safeSettings.tabs)) {
      safeSettings.tabs = safeSettings.tabs.map((t: any) => ({
        id: t.id,
        name: t.name,
        path: t.path,
        language: t.language,
      }))
    }

    const existing = await supabaseAdmin
      .from('ai_ide_settings')
      .select('id')
      .eq('key', 'app_settings')
      .eq('user_id', userId)
      .single()

    let result
    if (existing.data) {
      result = await supabaseAdmin
        .from('ai_ide_settings')
        .update({ value: safeSettings })
        .eq('id', existing.data.id)
    } else {
      result = await supabaseAdmin
        .from('ai_ide_settings')
        .insert({
          key: 'app_settings',
          user_id: userId,
          value: safeSettings
        })
    }

    if (result.error) {
      return Response.json({ error: result.error.message, code: result.error.code }, { status: 500 })
    }
    return Response.json({ success: true })
  } catch {
    return Response.json({ success: true })
  }
}
