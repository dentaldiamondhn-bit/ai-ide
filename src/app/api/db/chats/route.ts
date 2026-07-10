import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized credentials sequence' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('ai_ide_chats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ chats: data || [] })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized credentials sequence' }, { status: 401 })
    }

    const { chat } = await req.json()
    const id = chat.id || `chat_${Date.now()}`

    const { error } = await supabaseAdmin
      .from('ai_ide_chats')
      .upsert({
        id,
        user_id: user.id,
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
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized credentials sequence' }, { status: 401 })
    }

    const { id } = await req.json()

    const { error } = await supabaseAdmin
      .from('ai_ide_chats')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ success: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
