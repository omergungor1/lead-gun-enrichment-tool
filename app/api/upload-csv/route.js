import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * CSV upload endpoint - POST /api/upload-csv
 * Parametre: group_id, leads (array)
 */
export async function POST(request) {
  try {
    const { group_id, leads } = await request.json()

    if (!group_id) {
      return NextResponse.json(
        { error: 'group_id is required' },
        { status: 400 }
      )
    }

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'leads array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Group'u kontrol et ve status'u processing'e çevir
    const { data: group, error: groupError } = await supabase
      .from('lead_groups')
      .select('*')
      .eq('id', group_id)
      .single()

    if (groupError || !group) {
      return NextResponse.json(
        { error: `Group not found: ${groupError?.message || 'Unknown'}` },
        { status: 404 }
      )
    }

    if (group.status !== 'pending') {
      return NextResponse.json(
        { error: 'Group status must be pending to upload CSV' },
        { status: 400 }
      )
    }

    // Group status'unu processing'e çevir
    await supabase
      .from('lead_groups')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', group_id)

    // Leads'leri batch'ler halinde ekle (her batch 100 kayıt)
    const BATCH_SIZE = 100
    let totalInserted = 0
    const errors = []

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE)

      // Her lead için user_id ekle (group'tan al)
      const leadsWithUserId = batch.map(lead => ({
        ...lead,
        user_id: group.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { data: insertedData, error: insertError } = await supabase
        .from('leads')
        .insert(leadsWithUserId)
        .select()

      if (insertError) {
        console.error(`Batch insert error (${i}-${i + batch.length}):`, insertError)
        errors.push(`Batch ${i}-${i + batch.length}: ${insertError.message}`)
      } else {
        totalInserted += insertedData?.length || 0
      }
    }

    // Group'u güncelle: lead_count ve status
    const { error: updateError } = await supabase
      .from('lead_groups')
      .update({
        lead_count: totalInserted,
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', group_id)

    if (updateError) {
      console.error('Group update error:', updateError)
    }

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      total: leads.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('CSV upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

