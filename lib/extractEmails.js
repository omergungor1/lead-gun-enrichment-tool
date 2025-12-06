import * as cheerio from 'cheerio'

/**
 * Email adreslerini HTML içeriğinden çıkarır
 * SADECE mailto: linklerinden veri çeker
 * Max 20 email döndürür
 * 
 * Desteklenen formatlar:
 * - info@example.com
 * - info@example.com.tr
 * - user.name@subdomain.example.com
 */
export function extractEmails(html) {
  console.log('[extractEmails] Başlangıç')

  if (!html || typeof html !== 'string') {
    console.log('[extractEmails] HTML boş veya string değil')
    return []
  }

  console.log(`[extractEmails] HTML uzunluğu: ${html.length} karakter`)

  // HTML'de mailto: string araması (debug için)
  const mailtoMatches = html.match(/mailto:[^\s"'>]+/gi) || []
  console.log(`[extractEmails] HTML'de bulunan mailto: string'leri: ${mailtoMatches.length}`)
  if (mailtoMatches.length > 0) {
    console.log(`[extractEmails] Mailto string'leri:`, mailtoMatches.slice(0, 10))
  }

  const $ = cheerio.load(html)
  const emails = new Set()

  // Tüm <a> tag'lerini say
  const allLinks = $('a').length
  console.log(`[extractEmails] Toplam <a> tag sayısı: ${allLinks}`)

  // Sadece mailto: linklerini bul
  const mailtoLinks = $('a[href^="mailto:"], a[href^="MAILTO:"]')
  console.log(`[extractEmails] Cheerio ile bulunan mailto: link sayısı: ${mailtoLinks.length}`)

  mailtoLinks.each((i, elem) => {
    const href = $(elem).attr('href')
    if (!href) return

    // mailto: veya MAILTO: prefix'ini kaldır
    let emailValue = href.replace(/^mailto:/i, '').trim()

    // Query string varsa (mailto:email?subject=... gibi) kaldır
    if (emailValue.includes('?')) {
      emailValue = emailValue.split('?')[0]
    }

    // URL decode yap (eğer encode edilmişse)
    try {
      emailValue = decodeURIComponent(emailValue)
    } catch (e) {
      // Decode edilemezse olduğu gibi kullan
    }

    console.log(`[extractEmails] mailto: link bulundu: "${emailValue}"`)

    // Email validasyonu yap
    if (isValidEmail(emailValue)) {
      emails.add(emailValue.toLowerCase().trim())
      console.log(`[extractEmails] ✓ Geçerli email: "${emailValue}"`)
    } else {
      console.log(`[extractEmails] ✗ Geçersiz email: "${emailValue}"`)
    }
  })

  // Ayrıca href attribute'larında mailto: geçen tüm elementleri kontrol et
  const allMailtoElements = $('[href*="mailto:"], [href*="MAILTO:"]')
  console.log(`[extractEmails] href'inde mailto: geçen element sayısı: ${allMailtoElements.length}`)

  allMailtoElements.each((i, elem) => {
    const href = $(elem).attr('href')
    if (!href) return

    // mailto: ile başlamalı (sadece içinde geçmesi yeterli değil)
    if (!/^mailto:/i.test(href)) return

    let emailValue = href.replace(/^mailto:/i, '').trim()

    // Query string varsa kaldır
    if (emailValue.includes('?')) {
      emailValue = emailValue.split('?')[0]
    }

    try {
      emailValue = decodeURIComponent(emailValue)
    } catch (e) {
      // Decode edilemezse olduğu gibi kullan
    }

    console.log(`[extractEmails] mailto: attribute bulundu: "${emailValue}"`)

    if (isValidEmail(emailValue)) {
      emails.add(emailValue.toLowerCase().trim())
      console.log(`[extractEmails] ✓ Geçerli email: "${emailValue}"`)
    } else {
      console.log(`[extractEmails] ✗ Geçersiz email (attribute): "${emailValue}"`)
    }
  })

  // Fallback: Regex ile direkt HTML'den mailto: linklerini çıkar
  if (emails.size === 0 && mailtoMatches.length > 0) {
    console.log(`[extractEmails] ⚠️ Cheerio ile bulunamadı, regex fallback kullanılıyor`)
    for (const mailtoString of mailtoMatches) {
      let emailValue = mailtoString.replace(/^mailto:/i, '').trim()

      // Query string varsa kaldır
      if (emailValue.includes('?')) {
        emailValue = emailValue.split('?')[0]
      }

      // HTML entity'leri temizle
      emailValue = emailValue.replace(/&[^;]+;/g, '')

      // Parantez ve tırnak işaretlerini temizle
      emailValue = emailValue.replace(/["'<>()]/g, '')

      try {
        emailValue = decodeURIComponent(emailValue)
      } catch (e) {
        // Decode edilemezse olduğu gibi kullan
      }

      console.log(`[extractEmails] Regex fallback: "${emailValue}"`)

      if (isValidEmail(emailValue)) {
        emails.add(emailValue.toLowerCase().trim())
        console.log(`[extractEmails] ✓ Regex fallback ile geçerli email: "${emailValue}"`)
      }
    }
  }

  // Eğer mailto: linklerinden hiçbir şey bulunamadıysa, HTML içindeki metinlerden email ara
  if (emails.size === 0) {
    console.log('[extractEmails] mailto: linklerinden email bulunamadı, HTML metninden aranıyor...')

    // HTML string'inden direkt arama yap (cheerio'nun text() metoduna güvenme)
    // Önce footer, contact, iletişim gibi bölümlerden ara
    let searchHtml = ''
    const contactSections = $('footer, .contact, .iletisim, [class*="contact"], [class*="iletisim"], [id*="contact"], [id*="iletisim"]')

    if (contactSections.length > 0) {
      // HTML içeriğini al (text değil)
      contactSections.each((i, elem) => {
        searchHtml += $(elem).html() || ''
      })
      console.log(`[extractEmails] İletişim bölümlerinden ${contactSections.length} element bulundu`)
      console.log(`[extractEmails] İletişim bölümü HTML (ilk 500 karakter): ${searchHtml.substring(0, 500)}`)
    } else {
      // Eğer özel bölüm bulunamazsa tüm HTML'den ara
      searchHtml = html
      console.log(`[extractEmails] Özel bölüm bulunamadı, tüm HTML'den aranıyor`)
    }

    // HTML'den text çıkar (HTML tag'lerini kaldır ama içeriği koru)
    // Basit bir HTML tag temizleme
    let searchText = searchHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Script tag'lerini kaldır
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Style tag'lerini kaldır
      .replace(/<[^>]+>/g, ' ') // Tüm HTML tag'lerini kaldır
      .replace(/&nbsp;/g, ' ') // HTML entity'leri temizle
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşluğa çevir
      .trim()

    console.log(`[extractEmails] Arama metni uzunluğu: ${searchText.length} karakter`)
    if (searchText.length > 0) {
      console.log(`[extractEmails] Arama metni (ilk 500 karakter): ${searchText.substring(0, 500)}`)
    }

    // Email pattern'leri - daha geniş
    const emailPatterns = [
      // Standart email: word@word.word
      /\b[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}\b/g,
      // Daha esnek: @ işaretinden önce ve sonra herhangi bir karakter
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      // HTML içinde yazılmış email'ler (boşluklar olabilir)
      /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/g
    ]

    console.log(`[extractEmails] Arama metni uzunluğu: ${searchText.length} karakter`)

    for (let i = 0; i < emailPatterns.length; i++) {
      const pattern = emailPatterns[i]
      const emailMatches = searchText.match(pattern) || []
      console.log(`[extractEmails] Pattern ${i + 1} eşleşti: ${emailMatches.length} adet bulundu`)
      if (emailMatches.length > 0) {
        console.log(`[extractEmails] Bulunanlar: ${emailMatches.slice(0, 10).join(', ')}`)
        for (const emailMatch of emailMatches) {
          // HTML entity'lerini ve boşlukları temizle
          let cleanEmail = emailMatch.replace(/&[^;]+;/g, '').replace(/\s+/g, '').trim()
          if (isValidEmail(cleanEmail)) {
            emails.add(cleanEmail.toLowerCase().trim())
            console.log(`[extractEmails] Metinden bulundu: "${cleanEmail}"`)
          } else {
            console.log(`[extractEmails] Bulundu ama geçersiz: "${cleanEmail}"`)
          }
        }
      }
    }

    if (emails.size === 0) {
      console.log(`[extractEmails] ⚠️ Hiçbir pattern eşleşmedi. Arama metninde @ işareti geçen yerler:`)
      // @ işaretini bul
      const atSignMatches = searchText.match(/[^\s@]+@[^\s@]+/g)
      if (atSignMatches) {
        console.log(`[extractEmails] @ işareti içeren string'ler: ${atSignMatches.slice(0, 10).join(', ')}`)
      }
    }
  }

  const finalEmails = Array.from(emails).slice(0, 20)

  console.log(`[extractEmails] Sonuç: ${finalEmails.length} geçerli email bulundu (mailto: linklerinden ve metinden)`)
  if (finalEmails.length > 0) {
    console.log(`[extractEmails] Bulunan emailler:`, finalEmails)
  } else {
    console.log(`[extractEmails] ⚠️ Hiç email bulunamadı!`)
  }

  return finalEmails
}

/**
 * Email validasyonu
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    console.log(`[isValidEmail] "${email}" - email boş veya string değil`)
    return false
  }

  // Boş email'leri filtrele
  if (email.length < 5) {
    console.log(`[isValidEmail] "${email}" - çok kısa (${email.length} karakter)`)
    return false
  }

  // Geçersiz email formatlarını filtrele
  if (email.includes('..')) {
    console.log(`[isValidEmail] "${email}" - çift nokta içeriyor`)
    return false
  }
  if (email.startsWith('.')) {
    console.log(`[isValidEmail] "${email}" - nokta ile başlıyor`)
    return false
  }
  if (email.endsWith('.')) {
    console.log(`[isValidEmail] "${email}" - nokta ile bitiyor`)
    return false
  }
  if (email.startsWith('@')) {
    console.log(`[isValidEmail] "${email}" - @ ile başlıyor`)
    return false
  }
  if (email.endsWith('@')) {
    console.log(`[isValidEmail] "${email}" - @ ile bitiyor`)
    return false
  }
  if (!email.includes('@')) {
    console.log(`[isValidEmail] "${email}" - @ içermiyor`)
    return false
  }

  // @ işaretinden önce ve sonra kısımları kontrol et
  const parts = email.split('@')
  if (parts.length !== 2) {
    console.log(`[isValidEmail] "${email}" - @ sayısı yanlış (${parts.length} parça)`)
    return false
  }

  const [localPart, domain] = parts

  // Local part kontrolü
  if (!localPart || localPart.length === 0) {
    console.log(`[isValidEmail] "${email}" - local part boş`)
    return false
  }
  if (localPart.length > 64) {
    console.log(`[isValidEmail] "${email}" - local part çok uzun (${localPart.length} karakter)`)
    return false
  }

  // Domain kontrolü
  if (!domain || domain.length === 0) {
    console.log(`[isValidEmail] "${email}" - domain boş`)
    return false
  }
  if (domain.length > 255) {
    console.log(`[isValidEmail] "${email}" - domain çok uzun (${domain.length} karakter)`)
    return false
  }

  // Domain'de en az bir nokta olmalı
  if (!domain.includes('.')) {
    console.log(`[isValidEmail] "${email}" - domain'de nokta yok`)
    return false
  }

  // Yaygın spam/example email'leri filtrele
  // NOT: Tam eşleşme kontrolü yapılmalı, substring kontrolü değil
  // Örn: "mail.com" pattern'i "gmail.com" ile eşleşmemeli
  const spamPatterns = [
    'example.com',
    'test.com',
    'domain.com',
    'email.com',
    'mail.com', // Sadece mail.com domain'i, gmail.com değil
    'noreply',
    'no-reply',
    'donotreply',
    'example.org',
    'test.org'
  ]

  const domainLower = domain.toLowerCase()

  // Tam domain eşleşmesi veya domain'in sonu kontrolü
  // Örn: "mail.com" sadece "mail.com" ile eşleşmeli, "gmail.com" ile değil
  const matchedSpam = spamPatterns.find(pattern => {
    // Tam eşleşme
    if (domainLower === pattern) {
      return true
    }
    // Domain'in sonu pattern ile bitiyorsa (örn: subdomain.mail.com)
    if (domainLower.endsWith('.' + pattern)) {
      return true
    }
    // Ama substring kontrolü yapma (gmail.com mail.com içerir ama spam değil)
    return false
  })

  if (matchedSpam) {
    console.log(`[isValidEmail] "${email}" - spam pattern eşleşti: "${matchedSpam}" (domain: "${domainLower}")`)
    return false
  }

  // Geçerli TLD kontrolü (en az 2 karakter)
  const tld = domain.split('.').pop()
  if (!tld || tld.length < 2) {
    console.log(`[isValidEmail] "${email}" - TLD geçersiz: "${tld}"`)
    return false
  }

  console.log(`[isValidEmail] ✓ "${email}" - GEÇERLİ`)
  return true
}

