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
    return Response.json({ chats: [] })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_ide_chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ chats: data || [] })
  } catch {
    return Response.json({ chats: [] })
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { chat } = await req.json()
    const id = chat.id || `chat_${Date.now()}`

    const { error } = await supabaseAdmin
      .from('ai_ide_chats')
      .upsert({
        id,
        user_id: userId,
        ...chat,
        updated_at: new Date().toISOString(),
        created_at: chat.created_at || new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ success: true, id })
  } catch {
    return Response.json({ error: 'Failed to save chat' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { id } = await req.json()

    const { error } = await supabaseAdmin
      .from('ai_ide_chats')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Failed to delete chat' }, { status: 500 })
  }
}
