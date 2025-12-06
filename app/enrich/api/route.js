import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchSite } from '@/lib/fetchSite'
import { fetchSiteHard } from '@/lib/fetchSiteHard'
import { extractPhones } from '@/lib/extractPhones'
import { extractEmails } from '@/lib/extractEmails'
import { insertPhonesEmails, insertMapPhone } from '@/lib/insertPhonesEmails'
import { updateLeadStatus } from '@/lib/updateLeadStatus'

const BATCH_SIZE = 100

/**
 * Enrichment pipeline - POST /enrich/api
 * Parametre: group_id
 */
export async function POST(request) {
  try {
    const { group_id } = await request.json()

    if (!group_id) {
      return NextResponse.json(
        { error: 'group_id is required' },
        { status: 400 }
      )
    }

    // Leads'leri çek (enrichment yapılmamış olanlar)
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('primary_group_id', group_id)
      .or('is_enriched.is.null,is_enriched.eq.false,enrichment_status.is.null,enrichment_status.eq.failed')
      .eq('is_active', true)
      .limit(1000) // Max 1000 lead

    if (leadsError) {
      return NextResponse.json(
        { error: `Failed to fetch leads: ${leadsError.message}` },
        { status: 500 }
      )
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        message: 'No leads to enrich',
        processed: 0,
        success: 0,
        failed: 0
      })
    }

    // Batch'ler halinde işle
    const batches = []
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      batches.push(leads.slice(i, i + BATCH_SIZE))
    }

    let totalProcessed = 0
    let totalSuccess = 0
    let totalFailed = 0

    // Her batch'i işle
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(lead => enrichLead(lead))
      )

      results.forEach((result, index) => {
        totalProcessed++
        if (result.status === 'fulfilled' && result.value.success) {
          totalSuccess++
        } else {
          totalFailed++
        }
      })

      // Batch'ler arasında kısa bir bekleme (sunucu yükünü azaltmak için)
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      message: 'Enrichment completed',
      processed: totalProcessed,
      success: totalSuccess,
      failed: totalFailed
    })
  } catch (error) {
    console.error('Enrichment error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Tek bir lead için enrichment işlemi
 */
async function enrichLead(lead) {
  const logs = []
  const startTime = Date.now()

  try {
    logs.push(`[${lead.id}] Başlangıç - Lead: ${lead.name}, Website: ${lead.website || 'YOK'}`)

    // 1. Maps telefonunu lead_phones içine ekle
    if (lead.phone) {
      logs.push(`[${lead.id}] Maps telefonu ekleniyor: ${lead.phone}`)
      const mapPhoneResult = await insertMapPhone(lead.id, lead.phone)
      if (mapPhoneResult.inserted) {
        logs.push(`[${lead.id}] ✓ Maps telefonu eklendi`)
      } else {
        logs.push(`[${lead.id}] ✗ Maps telefonu eklenemedi: ${mapPhoneResult.error}`)
      }
    } else {
      logs.push(`[${lead.id}] Maps telefonu yok, atlanıyor`)
    }

    // 2. Website yoksa sadece telefon eklenmiş olarak işaretle
    if (!lead.website || !lead.website.trim()) {
      logs.push(`[${lead.id}] Website yok, sadece telefon eklendi olarak işaretleniyor`)
      await updateLeadStatus(lead.id, 'success')
      const duration = Date.now() - startTime
      logs.push(`[${lead.id}] Tamamlandı (${duration}ms) - Sadece telefon eklendi`)
      console.log(logs.join('\n'))
      return {
        success: true,
        leadId: lead.id,
        message: 'Only map phone added',
        logs: logs
      }
    }

    let siteData = null
    let phones = []
    let emails = []
    let fetchMode = null

    // 3. Light mode fetch dene
    logs.push(`[${lead.id}] Light mode ile site çekiliyor: ${lead.website}`)
    try {
      siteData = await fetchSite(lead.website)
      fetchMode = 'light'
      logs.push(`[${lead.id}] ✓ Light mode başarılı - HTML uzunluğu: ${siteData?.html?.length || 0} karakter`)

      if (siteData && siteData.html) {
        console.log(`[enrichLead] ${lead.id} için HTML içeriği alındı, uzunluk: ${siteData.html.length}`)
        phones = extractPhones(siteData.html)
        console.log(`[enrichLead] ${lead.id} için telefon çıkarma tamamlandı: ${phones.length} telefon`)
        emails = extractEmails(siteData.html)
        console.log(`[enrichLead] ${lead.id} için email çıkarma tamamlandı: ${emails.length} email`)
        logs.push(`[${lead.id}] Çıkarılan telefon sayısı: ${phones.length}, Email sayısı: ${emails.length}`)

        // Eğer telefon ve email bulunamadıysa ve HTML'de template syntax varsa hard mode'a geç
        if ((phones.length === 0 && emails.length === 0) &&
          (siteData.html.includes('{{') || siteData.html.includes('ng-binding') || siteData.html.includes('ng-'))) {
          logs.push(`[${lead.id}] ⚠️ Light mode'da telefon/email bulunamadı ve template syntax tespit edildi, hard mode'a geçiliyor...`)
          throw new Error('No phones/emails found and template syntax detected - switching to hard mode')
        }

        if (phones.length > 0) {
          logs.push(`[${lead.id}] Bulunan telefonlar: ${phones.slice(0, 5).join(', ')}${phones.length > 5 ? '...' : ''}`)
        }
        if (emails.length > 0) {
          logs.push(`[${lead.id}] Bulunan emailler: ${emails.slice(0, 5).join(', ')}${emails.length > 5 ? '...' : ''}`)
        } else {
          logs.push(`[${lead.id}] ⚠️ Hiç email bulunamadı! HTML'de email araması yapılıyor...`)
          // HTML'de direkt email araması
          if (siteData.html.toLowerCase().includes('info@limoncatering.com.tr')) {
            logs.push(`[${lead.id}] ✓ HTML içinde "info@limoncatering.com.tr" string olarak bulundu ama regex yakalamadı!`)
          }
        }
      } else {
        logs.push(`[${lead.id}] ✗ HTML içeriği boş`)
      }
    } catch (lightError) {
      logs.push(`[${lead.id}] ✗ Light mode başarısız: ${lightError.message}`)
      // Light mode başarısız, hard mode dene
      logs.push(`[${lead.id}] Hard mode ile site çekiliyor: ${lead.website}`)
      try {
        siteData = await fetchSiteHard(lead.website)
        fetchMode = 'hard'
        logs.push(`[${lead.id}] ✓ Hard mode başarılı - HTML uzunluğu: ${siteData?.html?.length || 0} karakter`)

        if (siteData && siteData.html) {
          console.log(`[enrichLead] ${lead.id} için Hard mode HTML içeriği alındı, uzunluk: ${siteData.html.length}`)
          phones = extractPhones(siteData.html)
          console.log(`[enrichLead] ${lead.id} için Hard mode telefon çıkarma tamamlandı: ${phones.length} telefon`)
          emails = extractEmails(siteData.html)
          console.log(`[enrichLead] ${lead.id} için Hard mode email çıkarma tamamlandı: ${emails.length} email`)
          logs.push(`[${lead.id}] Çıkarılan telefon sayısı: ${phones.length}, Email sayısı: ${emails.length}`)

          if (phones.length > 0) {
            logs.push(`[${lead.id}] Bulunan telefonlar: ${phones.slice(0, 5).join(', ')}${phones.length > 5 ? '...' : ''}`)
          }
          if (emails.length > 0) {
            logs.push(`[${lead.id}] Bulunan emailler: ${emails.slice(0, 5).join(', ')}${emails.length > 5 ? '...' : ''}`)
          } else {
            logs.push(`[${lead.id}] ⚠️ Hard mode: Hiç email bulunamadı! HTML'de email araması yapılıyor...`)
            // HTML'de direkt email araması
            if (siteData.html.toLowerCase().includes('info@limoncatering.com.tr')) {
              logs.push(`[${lead.id}] ✓ Hard mode HTML içinde "info@limoncatering.com.tr" string olarak bulundu ama regex yakalamadı!`)
            }
          }
        } else {
          logs.push(`[${lead.id}] ✗ Hard mode HTML içeriği boş`)
        }
      } catch (hardError) {
        // Her iki mod da başarısız
        logs.push(`[${lead.id}] ✗ Hard mode başarısız: ${hardError.message}`)
        const errorMsg = `Light: ${lightError.message}, Hard: ${hardError.message}`
        await updateLeadStatus(lead.id, 'failed', errorMsg)
        const duration = Date.now() - startTime
        logs.push(`[${lead.id}] Tamamlandı (${duration}ms) - Her iki mod başarısız`)
        console.log(logs.join('\n'))
        return {
          success: false,
          leadId: lead.id,
          error: errorMsg,
          logs: logs
        }
      }
    }

    // 4. Telefon ve email'leri veritabanına ekle
    logs.push(`[${lead.id}] Veritabanına ekleniyor - Telefon: ${phones.length}, Email: ${emails.length}`)
    const insertResult = await insertPhonesEmails(lead.id, phones, emails)

    if (insertResult.errors && insertResult.errors.length > 0) {
      logs.push(`[${lead.id}] ✗ Veritabanı hataları: ${insertResult.errors.join(', ')}`)
    } else {
      logs.push(`[${lead.id}] ✓ Veritabanına eklendi - Telefon: ${insertResult.phonesInserted}, Email: ${insertResult.emailsInserted}`)
    }

    // 5. Status güncelle
    await updateLeadStatus(lead.id, 'success')

    const duration = Date.now() - startTime
    logs.push(`[${lead.id}] Tamamlandı (${duration}ms) - Başarılı`)
    console.log(logs.join('\n'))

    return {
      success: true,
      leadId: lead.id,
      phonesFound: phones.length,
      emailsFound: emails.length,
      phonesInserted: insertResult.phonesInserted,
      emailsInserted: insertResult.emailsInserted,
      fetchMode: fetchMode,
      logs: logs
    }
  } catch (error) {
    // Hata durumunda status'u güncelle
    logs.push(`[${lead.id}] ✗ Beklenmeyen hata: ${error.message}`)
    logs.push(`[${lead.id}] Stack: ${error.stack}`)
    await updateLeadStatus(lead.id, 'failed', error.message).catch(() => { })
    const duration = Date.now() - startTime
    logs.push(`[${lead.id}] Tamamlandı (${duration}ms) - Hata`)
    console.log(logs.join('\n'))
    return {
      success: false,
      leadId: lead.id,
      error: error.message,
      logs: logs
    }
  }
}

