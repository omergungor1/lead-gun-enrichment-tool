import { supabase } from './supabase'

/**
 * Lead'in enrichment durumunu günceller
 */
export async function updateLeadStatus(leadId, status, error = null) {
  const updateData = {
    enrichment_status: status,
    updated_at: new Date().toISOString()
  }

  if (status === 'success') {
    updateData.is_enriched = true
    updateData.enriched_at = new Date().toISOString()
    updateData.enrichment_error = null
  } else if (status === 'failed') {
    updateData.is_enriched = false
    updateData.enrichment_error = error || 'Unknown error'
  }

  const { error: updateError } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId)

  if (updateError) {
    throw new Error(`Failed to update lead status: ${updateError.message}`)
  }

  return { success: true }
}

