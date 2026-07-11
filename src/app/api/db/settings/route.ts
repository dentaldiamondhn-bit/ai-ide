import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized credentials sequence' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('ai_ide_settings')
      .select('value')
      .eq('key', 'app_settings')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ settings: data?.value || null })
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

    const { settings } = await req.json()

    // Strip file content from tabs to keep payload small
    const safeSettings = { ...settings }
    if (safeSettings.tabs && Array.isArray(safeSettings.tabs)) {
      safeSettings.tabs = safeSettings.tabs.map((t: any) => ({
        id: t.id,
        name: t.name,
        path: t.path,
        language: t.language,
      }))
    }

    // Try insert first, then update if exists
    const existing = await supabaseAdmin
      .from('ai_ide_settings')
      .select('id')
      .eq('key', 'app_settings')
      .eq('user_id', user.id)
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
          user_id: user.id,
          value: safeSettings
        })
    }

    if (result.error) {
      return Response.json({ error: result.error.message, code: result.error.code }, { status: 500 })
    }
    return Response.json({ success: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
