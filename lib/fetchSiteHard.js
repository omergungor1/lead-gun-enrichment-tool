import { chromium } from 'playwright'

/**
 * Hard mode scraper - Playwright ile JS render edilmiş site içeriğini alır
 * 40 saniye timeout, Cloudflare bypass
 */
export async function fetchSiteHard(url) {
  if (!url) {
    throw new Error('URL is required')
  }

  // URL'yi normalize et
  let normalizedUrl = url.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  let browser = null

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    })

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'tr-TR'
    })

    const page = await context.newPage()

    // Cloudflare bypass için ekstra header'lar
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    })

    // Timeout: 40 saniye
    await page.goto(normalizedUrl, {
      waitUntil: 'networkidle',
      timeout: 40000
    })

    // Sayfanın yüklenmesini bekle
    await page.waitForTimeout(3000)

    // AngularJS ve diğer JS framework'lerinin render işlemini tamamlamasını bekle
    // Önce sayfada template syntax'ı ({{ }}) var mı kontrol et
    const hasTemplates = await page.evaluate(() => {
      return document.body.innerHTML.includes('{{')
    })

    // Eğer template syntax'ı varsa, render işlemini tamamlamasını bekle
    if (hasTemplates) {
      try {
        console.log('[fetchSiteHard] Template syntax bulundu, render işlemi bekleniyor...')
        // Template syntax'ının ({{ }}) kaybolmasını bekle (max 20 saniye)
        await page.waitForFunction(
          () => {
            const bodyHTML = document.body.innerHTML
            // Eğer {{ }} yoksa render tamamlanmış demektir
            if (!bodyHTML.includes('{{')) {
              return true
            }

            // Veya ng-binding class'ı olan elementler var ve içerik render edilmiş
            const ngBindings = document.querySelectorAll('.ng-binding')
            if (ngBindings.length > 0) {
              const hasRenderedContent = Array.from(ngBindings).some(el => {
                const text = el.textContent || el.innerHTML
                return text && !text.includes('{{') && text.trim().length > 0
              })
              if (hasRenderedContent) {
                return true
              }
            }

            return false
          },
          { timeout: 20000 }
        )
        console.log('[fetchSiteHard] Template render işlemi tamamlandı')
      } catch (err) {
        // Timeout olursa devam et
        console.log('[fetchSiteHard] Template render bekleme timeout, devam ediliyor')
      }
    } else {
      console.log('[fetchSiteHard] Template syntax bulunamadı, render bekleme atlanıyor')
    }

    // Ekstra bekleme: JS framework'lerinin tam yüklenmesi ve dinamik içeriklerin yüklenmesi için
    // Bazı sayfalarda lazy loading veya geç yüklenen içerikler olabilir
    await page.waitForTimeout(5000)

    // Son bir kontrol: tel: ve mailto: linklerinin render edilip edilmediğini kontrol et
    try {
      const hasRenderedLinks = await page.evaluate(() => {
        // tel: linklerini kontrol et
        const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
        const hasValidTel = telLinks.some(link => {
          const href = link.getAttribute('href')
          return href && !href.includes('{{') && /^tel:\d+/.test(href)
        })

        // mailto: linklerini kontrol et
        const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
        const hasValidMailto = mailtoLinks.some(link => {
          const href = link.getAttribute('href')
          return href && !href.includes('{{') && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/.test(href)
        })

        return hasValidTel || hasValidMailto
      })

      if (!hasRenderedLinks) {
        console.log('[fetchSiteHard] ⚠️ tel: veya mailto: linkleri henüz render edilmemiş, ekstra bekleme yapılıyor...')
        // Ekstra 5 saniye daha bekle
        await page.waitForTimeout(5000)
      } else {
        console.log('[fetchSiteHard] ✓ tel: veya mailto: linkleri render edilmiş')
      }
    } catch (err) {
      console.log('[fetchSiteHard] Link kontrolü hatası:', err.message)
    }

    // Ana sayfa HTML'ini al
    const html = await page.content()
    const baseUrl = new URL(normalizedUrl)
    const pages = [
      { url: normalizedUrl, html, source: 'homepage' }
    ]

    // İletişim sayfalarını bul ve çek
    const contactUrls = await page.evaluate(() => {
      const urls = new Set()
      const contactPatterns = ['/iletisim', '/contact', '/bize-ulasin', '/iletisim-bilgileri', '/contact-us']

      // Tüm linkleri kontrol et
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href')
        if (!href) return

        try {
          const fullUrl = new URL(href, window.location.origin).href
          const pathname = new URL(fullUrl).pathname.toLowerCase()

          // İletişim pattern'lerinden biriyle eşleşiyor mu?
          if (contactPatterns.some(pattern => pathname.includes(pattern))) {
            urls.add(fullUrl)
          }
        } catch (err) {
          // Geçersiz URL, atla
        }
      })

      return Array.from(urls)
    })

    // Yaygın iletişim URL'lerini de ekle
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
        if (!contactUrls.includes(commonUrl)) {
          contactUrls.push(commonUrl)
        }
      } catch (err) {
        // Geçersiz URL, atla
      }
    }

    // İletişim sayfalarını fetch et (max 5 sayfa)
    for (const contactUrl of contactUrls.slice(0, 5)) {
      try {
        console.log(`[fetchSiteHard] İletişim sayfası çekiliyor: ${contactUrl}`)
        await page.goto(contactUrl, {
          waitUntil: 'networkidle',
          timeout: 40000
        })
        await page.waitForTimeout(2000)

        const contactHtml = await page.content()
        pages.push({
          url: contactUrl,
          html: contactHtml,
          source: 'contact_page'
        })
        console.log(`[fetchSiteHard] İletişim sayfası indirildi: ${contactUrl} (${contactHtml.length} karakter)`)
      } catch (err) {
        console.warn(`[fetchSiteHard] İletişim sayfası fetch edilemedi: ${contactUrl}`, err.message)
      }
    }

    // Ana sayfaya geri dön
    await page.goto(normalizedUrl, {
      waitUntil: 'networkidle',
      timeout: 40000
    })

    // Tüm sayfaların HTML'ini birleştir
    const combinedHtml = pages.map(p => p.html).join('\n')

    await browser.close()
    browser = null

    return {
      success: true,
      html: combinedHtml,
      pages: pages.length,
      urls: pages.map(p => p.url)
    }
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    throw error
  }
}

