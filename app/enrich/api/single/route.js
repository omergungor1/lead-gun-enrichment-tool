import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchSite } from '@/lib/fetchSite'
import { fetchSiteHard } from '@/lib/fetchSiteHard'
import { extractPhones } from '@/lib/extractPhones'
import { extractEmails } from '@/lib/extractEmails'
import { insertPhonesEmails, insertMapPhone } from '@/lib/insertPhonesEmails'
import { updateLeadStatus } from '@/lib/updateLeadStatus'

/**
 * Tek bir lead için enrichment işlemi - POST /enrich/api/single
 * Parametre: lead_id
 */
export async function POST(request) {
  try {
    const { lead_id } = await request.json()

    if (!lead_id) {
      return NextResponse.json(
        { error: 'lead_id is required' },
        { status: 400 }
      )
    }

    // Lead'i çek
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json(
        { error: `Lead bulunamadı: ${leadError?.message || 'Unknown'}` },
        { status: 404 }
      )
    }

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
        return NextResponse.json({
          success: true,
          leadId: lead.id,
          message: 'Only map phone added',
          logs: logs,
          duration: duration
        })
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
        logs.push(`[${lead.id}] Fetch edilen sayfa sayısı: ${siteData?.pages || 0}`)
        logs.push(`[${lead.id}] URL'ler: ${siteData?.urls?.join(', ') || 'N/A'}`)

        if (siteData && siteData.html) {
          // HTML'in ilk 500 karakterini logla
          logs.push(`[${lead.id}] HTML önizleme (ilk 500 karakter): ${siteData.html.substring(0, 500)}...`)

          phones = extractPhones(siteData.html)
          emails = extractEmails(siteData.html)
          logs.push(`[${lead.id}] Çıkarılan telefon sayısı: ${phones.length}, Email sayısı: ${emails.length}`)

          // Eğer telefon ve email bulunamadıysa ve HTML'de template syntax varsa hard mode'a geç
          if ((phones.length === 0 && emails.length === 0) &&
            (siteData.html.includes('{{') || siteData.html.includes('ng-binding') || siteData.html.includes('ng-'))) {
            logs.push(`[${lead.id}] ⚠️ Light mode'da telefon/email bulunamadı ve template syntax tespit edildi, hard mode'a geçiliyor...`)
            throw new Error('No phones/emails found and template syntax detected - switching to hard mode')
          }

          if (phones.length > 0) {
            logs.push(`[${lead.id}] Bulunan telefonlar: ${phones.join(', ')}`)
          }
          if (emails.length > 0) {
            logs.push(`[${lead.id}] Bulunan emailler: ${emails.join(', ')}`)
          }
        } else {
          logs.push(`[${lead.id}] ✗ HTML içeriği boş`)
        }
      } catch (lightError) {
        logs.push(`[${lead.id}] ✗ Light mode başarısız: ${lightError.message}`)
        logs.push(`[${lead.id}] Light mode hata detayı: ${lightError.stack}`)
        // Light mode başarısız, hard mode dene
        logs.push(`[${lead.id}] Hard mode ile site çekiliyor: ${lead.website}`)
        try {
          siteData = await fetchSiteHard(lead.website)
          fetchMode = 'hard'
          logs.push(`[${lead.id}] ✓ Hard mode başarılı - HTML uzunluğu: ${siteData?.html?.length || 0} karakter`)

          if (siteData && siteData.html) {
            // HTML'in ilk 500 karakterini logla
            logs.push(`[${lead.id}] HTML önizleme (ilk 500 karakter): ${siteData.html.substring(0, 500)}...`)

            phones = extractPhones(siteData.html)
            emails = extractEmails(siteData.html)
            logs.push(`[${lead.id}] Çıkarılan telefon sayısı: ${phones.length}, Email sayısı: ${emails.length}`)

            if (phones.length > 0) {
              logs.push(`[${lead.id}] Bulunan telefonlar: ${phones.join(', ')}`)
            }
            if (emails.length > 0) {
              logs.push(`[${lead.id}] Bulunan emailler: ${emails.join(', ')}`)
            }
          } else {
            logs.push(`[${lead.id}] ✗ HTML içeriği boş`)
          }
        } catch (hardError) {
          // Her iki mod da başarısız
          logs.push(`[${lead.id}] ✗ Hard mode başarısız: ${hardError.message}`)
          logs.push(`[${lead.id}] Hard mode hata detayı: ${hardError.stack}`)
          const errorMsg = `Light: ${lightError.message}, Hard: ${hardError.message}`
          await updateLeadStatus(lead.id, 'failed', errorMsg)
          const duration = Date.now() - startTime
          logs.push(`[${lead.id}] Tamamlandı (${duration}ms) - Her iki mod başarısız`)
          console.log(logs.join('\n'))
          return NextResponse.json({
            success: false,
            leadId: lead.id,
            error: errorMsg,
            logs: logs,
            duration: duration
          })
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

      return NextResponse.json({
        success: true,
        leadId: lead.id,
        phonesFound: phones.length,
        emailsFound: emails.length,
        phonesInserted: insertResult.phonesInserted,
        emailsInserted: insertResult.emailsInserted,
        fetchMode: fetchMode,
        htmlLength: siteData?.html?.length || 0,
        logs: logs,
        duration: duration
      })
    } catch (error) {
      // Hata durumunda status'u güncelle
      logs.push(`[${lead.id}] ✗ Beklenmeyen hata: ${error.message}`)
      logs.push(`[${lead.id}] Stack: ${error.stack}`)
      await updateLeadStatus(lead.id, 'failed', error.message).catch(() => { })
      const duration = Date.now() - startTime
      logs.push(`[${lead.id}] Tamamlandı (${duration}ms) - Hata`)
      console.log(logs.join('\n'))
      return NextResponse.json({
        success: false,
        leadId: lead.id,
        error: error.message,
        logs: logs,
        duration: duration
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Single enrich error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

