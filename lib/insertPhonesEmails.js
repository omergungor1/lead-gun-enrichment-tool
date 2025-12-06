import { supabase } from './supabase'
import { normalizePhone } from './extractPhones'

/**
 * Telefon ve email'leri veritabanına ekler (duplicate kontrolü ile)
 */
export async function insertPhonesEmails(leadId, phones, emails) {
  const results = {
    phonesInserted: 0,
    emailsInserted: 0,
    errors: []
  }

  // Telefonları ekle
  if (phones && phones.length > 0) {
    const phoneInserts = phones
      .filter(phone => phone && phone.trim().length > 0)
      .map(phone => ({
        lead_id: leadId,
        phone: phone.trim(),
        source: 'website',
        has_whatsapp: false
      }))

    if (phoneInserts.length > 0) {
      console.log(`[insertPhonesEmails] ${leadId} için ${phoneInserts.length} telefon ekleniyor:`, phoneInserts.map(p => p.phone))

      const { data: phoneData, error: phoneError } = await supabase
        .from('lead_phones')
        .upsert(phoneInserts, {
          onConflict: 'lead_id,phone',
          ignoreDuplicates: false
        })
        .select()

      if (phoneError) {
        console.error(`[insertPhonesEmails] ${leadId} telefon ekleme hatası:`, phoneError)
        results.errors.push(`Phone insert error: ${phoneError.message}`)
      } else {
        results.phonesInserted = phoneData?.length || 0
        console.log(`[insertPhonesEmails] ${leadId} için ${results.phonesInserted} telefon eklendi`)
      }
    } else {
      console.log(`[insertPhonesEmails] ${leadId} için geçerli telefon yok`)
    }
  } else {
    console.log(`[insertPhonesEmails] ${leadId} için telefon listesi boş`)
  }

  // Email'leri ekle
  if (emails && emails.length > 0) {
    const emailInserts = emails
      .filter(email => email && email.trim().length > 0)
      .map(email => ({
        lead_id: leadId,
        email: email.trim(),
        source: 'website'
      }))

    if (emailInserts.length > 0) {
      console.log(`[insertPhonesEmails] ${leadId} için ${emailInserts.length} email ekleniyor:`, emailInserts.map(e => e.email))

      const { data: emailData, error: emailError } = await supabase
        .from('lead_emails')
        .upsert(emailInserts, {
          onConflict: 'lead_id,email',
          ignoreDuplicates: false
        })
        .select()

      if (emailError) {
        console.error(`[insertPhonesEmails] ${leadId} email ekleme hatası:`, emailError)
        results.errors.push(`Email insert error: ${emailError.message}`)
      } else {
        results.emailsInserted = emailData?.length || 0
        console.log(`[insertPhonesEmails] ${leadId} için ${results.emailsInserted} email eklendi`)
      }
    } else {
      console.log(`[insertPhonesEmails] ${leadId} için geçerli email yok`)
    }
  } else {
    console.log(`[insertPhonesEmails] ${leadId} için email listesi boş`)
  }

  return results
}

/**
 * Maps'ten gelen telefonu lead_phones tablosuna ekler
 */
export async function insertMapPhone(leadId, phone) {
  if (!phone || !phone.trim()) {
    console.log(`[insertMapPhone] ${leadId} için telefon boş`)
    return { inserted: false, error: 'Phone is empty' }
  }

  // Telefonu normalize et
  const normalizedPhone = normalizePhone(phone.trim())

  if (!normalizedPhone) {
    console.log(`[insertMapPhone] ${leadId} için telefon normalize edilemedi:`, phone.trim())
    return { inserted: false, error: 'Phone could not be normalized' }
  }

  const phoneData = {
    lead_id: leadId,
    phone: normalizedPhone,
    source: 'map',
    has_whatsapp: false
  }

  console.log(`[insertMapPhone] ${leadId} için maps telefonu ekleniyor:`, phone.trim(), `→ normalize edildi:`, normalizedPhone)

  const { data, error } = await supabase
    .from('lead_phones')
    .upsert(phoneData, {
      onConflict: 'lead_id,phone',
      ignoreDuplicates: false
    })
    .select()

  if (error) {
    console.error(`[insertMapPhone] ${leadId} telefon ekleme hatası:`, error)
    return { inserted: false, error: error.message }
  }

  console.log(`[insertMapPhone] ${leadId} için maps telefonu eklendi:`, data)
  return { inserted: true, data }
}

