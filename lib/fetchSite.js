import * as cheerio from 'cheerio'

/**
 * Light mode scraper - Normal fetch ile site içeriğini alır
 * 20 saniye timeout, redirect desteği, Cloudflare friendly
 */
export async function fetchSite(url) {
  if (!url) {
    throw new Error('URL is required')
  }

  // URL'yi normalize et
  let normalizedUrl = url.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000) // 40 saniye timeout

  try {
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      redirect: 'follow',
      maxRedirects: 5
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const baseUrl = new URL(response.url || normalizedUrl)

    // İletişim sayfalarını bul
    const contactUrls = await findContactPages(html, baseUrl)

    // Yaygın iletişim URL'lerini de ekle (link bulunamasa bile dene)
    const commonContactPaths = [
      '/bize-ulasin',
      '/bize-ulasin/',
      '/iletisim',
      '/iletisim/',
      '/contact',
      '/contact/',
      '/contact-us',
      '/contact-us/',
      '/iletisim-bilgileri',
      '/iletisim-bilgileri/'
    ]

    for (const path of commonContactPaths) {
      try {
        const commonUrl = new URL(path, baseUrl).href
        if (!contactUrls.has(commonUrl)) {
          contactUrls.add(commonUrl)
        }
      } catch (err) {
        // Geçersiz URL, atla
      }
    }

    // Ana sayfa + iletişim sayfalarını fetch et
    const pages = [
      { url: baseUrl.href, html, source: 'homepage' }
    ]

    for (const contactUrl of Array.from(contactUrls).slice(0, 9)) { // Max 10 URL (1 ana sayfa + 9 iletişim)
      try {
        const contactResponse = await fetch(contactUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          redirect: 'follow'
        })

        if (contactResponse.ok) {
          const contactHtml = await contactResponse.text()
          console.log(`[fetchSite] İletişim sayfası indirildi: ${contactUrl}`)
          console.log(`[fetchSite] HTML uzunluğu: ${contactHtml.length} karakter`)

          // Test için info@limoncatering.com.tr araması
          if (contactHtml.includes('info@limoncatering.com.tr')) {
            console.log(`[fetchSite] ✓ "${contactUrl}" sayfasında "info@limoncatering.com.tr" bulundu!`)
            const index = contactHtml.indexOf('info@limoncatering.com.tr')
            const context = contactHtml.substring(Math.max(0, index - 100), Math.min(contactHtml.length, index + 100))
            console.log(`[fetchSite] Kontekst: ...${context}...`)
          } else {
            console.log(`[fetchSite] ✗ "${contactUrl}" sayfasında "info@limoncatering.com.tr" bulunamadı`)
          }

          pages.push({
            url: contactUrl,
            html: contactHtml,
            source: 'contact_page'
          })
        }
      } catch (err) {
        // İletişim sayfası fetch edilemezse devam et
        console.warn(`Failed to fetch contact page: ${contactUrl}`, err.message)
      }
    }

    // Tüm sayfaların HTML'ini birleştir
    const combinedHtml = pages.map(p => p.html).join('\n')

    console.log(`[fetchSite] Toplam ${pages.length} sayfa birleştirildi`)
    console.log(`[fetchSite] Birleştirilmiş HTML uzunluğu: ${combinedHtml.length} karakter`)

    // AngularJS veya diğer JS framework'lerinin template syntax'ını kontrol et
    // Eğer {{ }} gibi template syntax'ları varsa, sayfa JS render gerektiriyor demektir
    if (combinedHtml.includes('{{') || combinedHtml.includes('ng-binding') || combinedHtml.includes('ng-')) {
      console.log(`[fetchSite] ⚠️ Template syntax bulundu ({{ }} veya ng-*), JS render gerekiyor - Hard mode'a geçilmeli`)
      throw new Error('Template syntax detected - requires JS rendering (use hard mode)')
    }

    // Test için info@limoncatering.com.tr araması
    if (combinedHtml.includes('info@limoncatering.com.tr')) {
      console.log(`[fetchSite] ✓ Birleştirilmiş HTML'de "info@limoncatering.com.tr" bulundu!`)
      const index = combinedHtml.indexOf('info@limoncatering.com.tr')
      const context = combinedHtml.substring(Math.max(0, index - 100), Math.min(combinedHtml.length, index + 100))
      console.log(`[fetchSite] Kontekst: ...${context}...`)
    } else {
      console.log(`[fetchSite] ✗ Birleştirilmiş HTML'de "info@limoncatering.com.tr" bulunamadı`)
    }

    return {
      success: true,
      html: combinedHtml,
      pages: pages.length,
      urls: pages.map(p => p.url)
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout (20s)')
    }
    throw error
  }
}

/**
 * HTML'den iletişim sayfalarını bulur
 */
async function findContactPages(html, baseUrl) {
  const $ = cheerio.load(html)
  const contactUrls = new Set()

  // İletişim sayfası pattern'leri
  const contactPatterns = [
    '/iletisim',
    '/iletisim/',
    '/contact',
    '/contact/',
    '/iletisim-bilgileri',
    '/iletisim-bilgileri/',
    '/contact-us',
    '/contact-us/',
    '/bize-ulasin',
    '/bize-ulasin/',
    '/reach-us',
    '/reach-us/',
    '/iletisim-formu',
    '/iletisim-formu/',
    '/contact-form',
    '/contact-form/',
    '/hakkimizda',
    '/hakkimizda/',
    '/about',
    '/about/',
    '/about-us',
    '/about-us/'
  ]

  // Header ve footer linklerini bul
  $('header a, footer a, nav a').each((i, elem) => {
    const href = $(elem).attr('href')
    if (!href) return

    try {
      const fullUrl = new URL(href, baseUrl).href
      const pathname = new URL(fullUrl).pathname.toLowerCase()

      // İletişim pattern'lerinden biriyle eşleşiyor mu?
      if (contactPatterns.some(pattern => pathname.includes(pattern))) {
        contactUrls.add(fullUrl)
      }
    } catch (err) {
      // Geçersiz URL, atla
    }
  })

  // Ayrıca href'lerde "contact", "iletisim", "bize-ulasin" geçen linkleri bul
  $('a[href*="contact"], a[href*="iletisim"], a[href*="bize-ulasin"], a[href*="bize-ulas"], a[href*="ulasin"]').each((i, elem) => {
    const href = $(elem).attr('href')
    if (!href) return

    try {
      const fullUrl = new URL(href, baseUrl).href
      const pathname = new URL(fullUrl).pathname.toLowerCase()

      // İletişim ile ilgili sayfaları ekle
      if (pathname.includes('contact') ||
        pathname.includes('iletisim') ||
        pathname.includes('bize-ulasin') ||
        pathname.includes('bize-ulas') ||
        pathname.includes('ulasin') ||
        pathname.includes('reach')) {
        contactUrls.add(fullUrl)
      }
    } catch (err) {
      // Geçersiz URL, atla
    }
  })

  return Array.from(contactUrls)
}

