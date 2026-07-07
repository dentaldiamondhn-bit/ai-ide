import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const name = searchParams.get('name')

  try {
    if (id) {
      const { data, error } = await supabaseAdmin.from('skills').select('*').eq('id', id).single()
      if (error) return Response.json({ error: error.message }, { status: 404 })
      return Response.json(data)
    }
    if (name) {
      const { data, error } = await supabaseAdmin.from('skills').select('*').eq('name', name).single()
      if (error) return Response.json({ error: error.message }, { status: 404 })
      return Response.json(data)
    }
    const { data, error } = await supabaseAdmin.from('skills').select('*').order('name')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabaseAdmin.from('skills').insert({
      name: body.name,
      description: body.description || '',
      prompt: body.prompt || '',
      category: body.category || '',
      tags: body.tags || [],
      is_public: body.is_public ?? true,
      created_by: body.created_by || '00000000-0000-0000-0000-000000000000',
      version: 1,
    }).select().single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json(data, { status: 201 })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (!body.id && !body.name) {
      return Response.json({ error: 'id or name required' }, { status: 400 })
    }
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.prompt !== undefined) updates.prompt = body.prompt
    if (body.category !== undefined) updates.category = body.category
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.is_public !== undefined) updates.is_public = body.is_public
    updates.updated_at = new Date().toISOString()

    const query = supabaseAdmin.from('skills').update(updates)
    if (body.id) query.eq('id', body.id)
    else query.eq('name', body.name)

    const { data, error } = await query.select().single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json(data)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const name = searchParams.get('name')

  if (!id && !name) {
    return Response.json({ error: 'id or name query param required' }, { status: 400 })
  }

  try {
    const query = supabaseAdmin.from('skills').delete()
    if (id) query.eq('id', id)
    else query.eq('name', name)
    const { error } = await query
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ success: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
