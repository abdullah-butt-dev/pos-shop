import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// PATCH /api/pos/suppliers/[id] { name?, phone?, address?, notes?, is_active? }
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (typeof body?.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
      }
      updates.name = name
    }

    if (body?.phone !== undefined) {
      updates.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null
    }

    if (body?.address !== undefined) {
      updates.address = typeof body.address === 'string' ? body.address.trim() || null : null
    }

    if (body?.notes !== undefined) {
      updates.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    }

    if (typeof body?.is_active === 'boolean') {
      updates.is_active = body.is_active
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('pos_suppliers')
      .update(updates)
      .eq('id', params.id)
      .select('id, name, phone, address, notes, is_active, created_at')
      .single()

    if (error) {
      // Unique violation: another supplier already has this name.
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A supplier with this name already exists' }, { status: 409 })
      }
      console.error('[API /api/pos/suppliers/[id]] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[API /api/pos/suppliers/[id]] Unexpected error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('pos_suppliers')
      .delete()
      .eq('id', params.id)

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Cannot delete this supplier because it has existing purchase records' },
          { status: 409 },
        )
      }
      console.error('[API /api/pos/suppliers/[id]] Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API /api/pos/suppliers/[id]] Unexpected error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
