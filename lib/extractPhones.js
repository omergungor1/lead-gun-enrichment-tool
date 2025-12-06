import * as cheerio from 'cheerio'

/**
 * Türkiye telefon numaralarını HTML içeriğinden çıkarır ve normalize eder
 * SADECE tel: linklerinden veri çeker
 * Max 20 telefon döndürür
 * 
 * Normalize edilmiş format: 90XXXXXXXXXX (12 rakam)
 * - 90: ülke kodu
 * - XXXXXXXXXX: 10 haneli ulusal numara
 */
export function extractPhones(html) {
    if (!html || typeof html !== 'string') {
        return []
    }

    console.log('[extractPhones] Başlangıç, HTML uzunluğu:', html.length)

    const $ = cheerio.load(html)
    const normalizedPhones = new Set()

    // Sadece tel: linklerini bul
    $('a[href^="tel:"], a[href^="TEL:"]').each((i, elem) => {
        const href = $(elem).attr('href')
        if (!href) return

        // tel: veya TEL: prefix'ini kaldır
        let phoneValue = href.replace(/^tel:/i, '').trim()

        // URL decode yap (eğer encode edilmişse)
        try {
            phoneValue = decodeURIComponent(phoneValue)
        } catch (e) {
            // Decode edilemezse olduğu gibi kullan
        }

        console.log(`[extractPhones] tel: link bulundu: "${phoneValue}"`)

        // Normalize et
        const normalized = normalizePhone(phoneValue)
        if (normalized) {
            normalizedPhones.add(normalized)
            console.log(`[extractPhones] Normalize edildi: "${phoneValue}" → "${normalized}"`)
        } else {
            console.log(`[extractPhones] Geçersiz: "${phoneValue}"`)
        }
    })

    // Ayrıca href attribute'larında tel: geçen tüm elementleri kontrol et
    $('[href*="tel:"], [href*="TEL:"]').each((i, elem) => {
        const href = $(elem).attr('href')
        if (!href) return

        // tel: ile başlamalı (sadece içinde geçmesi yeterli değil)
        if (!/^tel:/i.test(href)) return

        let phoneValue = href.replace(/^tel:/i, '').trim()

        try {
            phoneValue = decodeURIComponent(phoneValue)
        } catch (e) {
            // Decode edilemezse olduğu gibi kullan
        }

        console.log(`[extractPhones] tel: attribute bulundu: "${phoneValue}"`)

        const normalized = normalizePhone(phoneValue)
        if (normalized) {
            normalizedPhones.add(normalized)
            console.log(`[extractPhones] Normalize edildi: "${phoneValue}" → "${normalized}"`)
        }
    })

    // Eğer tel: linklerinden hiçbir şey bulunamadıysa, HTML içindeki metinlerden telefon ara
    if (normalizedPhones.size === 0) {
        console.log('[extractPhones] tel: linklerinden telefon bulunamadı, HTML metninden aranıyor...')

        // HTML string'inden direkt arama yap (cheerio'nun text() metoduna güvenme)
        // Önce footer, contact, iletişim gibi bölümlerden ara
        let searchHtml = ''
        const contactSections = $('footer, .contact, .iletisim, [class*="contact"], [class*="iletisim"], [id*="contact"], [id*="iletisim"]')

        if (contactSections.length > 0) {
            // HTML içeriğini al (text değil)
            contactSections.each((i, elem) => {
                searchHtml += $(elem).html() || ''
            })
            console.log(`[extractPhones] İletişim bölümlerinden ${contactSections.length} element bulundu`)
            console.log(`[extractPhones] İletişim bölümü HTML (ilk 500 karakter): ${searchHtml.substring(0, 500)}`)
        } else {
            // Eğer özel bölüm bulunamazsa tüm HTML'den ara
            searchHtml = html
            console.log(`[extractPhones] Özel bölüm bulunamadı, tüm HTML'den aranıyor`)
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

        console.log(`[extractPhones] Arama metni uzunluğu: ${searchText.length} karakter`)
        if (searchText.length > 0) {
            console.log(`[extractPhones] Arama metni (ilk 500 karakter): ${searchText.substring(0, 500)}`)
        }

        // Türkiye telefon numarası pattern'leri - daha geniş ve esnek
        // Örnekler: 0535 779 53 50, (0535) 779 53 50, 05357795350, +90 535 779 53 50, 0 535 779 53 50, 0224 443 63 73
        const phonePatterns = [
            // (0XXX) XXX XX XX veya (0XXX) XXX-XX-XX formatı - daha esnek
            /\(?0\d{3}\)?\s*[-.\s]?\s*\d{3}\s*[-.\s]?\s*\d{2}\s*[-.\s]?\s*\d{2}/g,
            // 0XXX XXX XX XX formatı (boşluklu)
            /0\d{3}\s+\d{3}\s+\d{2}\s+\d{2}/g,
            // 0XXX XXX XXXX formatı (4 haneli son grup)
            /0\d{3}\s+\d{3}\s+\d{4}/g,
            // 0XXX-XXX-XX-XX formatı
            /0\d{3}-\d{3}-\d{2}-\d{2}/g,
            // 0XXX-XXX-XXXX formatı
            /0\d{3}-\d{3}-\d{4}/g,
            // 0XXXXXXXXX (10 hane, boşluksuz)
            /0\d{10}/g,
            // +90 XXX XXX XX XX formatı
            /\+90\s*\d{3}\s*\d{3}\s*\d{2}\s*\d{2}/g,
            // +90 XXX XXX XXXX formatı
            /\+90\s*\d{3}\s*\d{3}\s*\d{4}/g,
            // 90XXXXXXXXXX (12 hane, boşluksuz)
            /90\d{10}/g,
            // Sabit hat: (0XXX) XXX XX XX - daha esnek
            /\(?0[23]\d{2}\)?\s*[-.\s]?\s*\d{3}\s*[-.\s]?\s*\d{2}\s*[-.\s]?\s*\d{2}/g,
            // Sabit hat: 0XXX XXX XXXX (4 haneli son grup)
            /0[23]\d{2}\s+\d{3}\s+\d{4}/g,
            // Genel: 0 ile başlayan 11 haneli (0 + 10 hane)
            /\b0\d{10}\b/g,
            // Genel: Herhangi bir 0XXX formatı (daha geniş)
            /\b0\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g,
            // Genel: Herhangi bir 0XXX formatı (4 haneli son grup)
            /\b0\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g
        ]

        console.log(`[extractPhones] Arama metni uzunluğu: ${searchText.length} karakter`)

        for (let i = 0; i < phonePatterns.length; i++) {
            const pattern = phonePatterns[i]
            const matches = searchText.match(pattern)
            if (matches) {
                console.log(`[extractPhones] Pattern ${i + 1} eşleşti: ${matches.length} adet bulundu`)
                console.log(`[extractPhones] Bulunanlar: ${matches.slice(0, 5).join(', ')}${matches.length > 5 ? '...' : ''}`)
                for (const match of matches) {
                    const normalized = normalizePhone(match)
                    if (normalized) {
                        normalizedPhones.add(normalized)
                        console.log(`[extractPhones] Metinden bulundu: "${match}" → "${normalized}"`)
                    } else {
                        console.log(`[extractPhones] Bulundu ama normalize edilemedi: "${match}"`)
                    }
                }
            }
        }

        if (normalizedPhones.size === 0) {
            console.log(`[extractPhones] ⚠️ Hiçbir pattern eşleşmedi. Arama metninde telefon numarası benzeri string'ler:`)
            // Rakam gruplarını bul
            const digitGroups = searchText.match(/\b\d{3,}\b/g)
            if (digitGroups) {
                console.log(`[extractPhones] Rakam grupları: ${digitGroups.slice(0, 20).join(', ')}`)
            }
        }
    }

    const result = Array.from(normalizedPhones).slice(0, 20)
    console.log(`[extractPhones] Sonuç: ${result.length} geçerli telefon (tel: linklerinden ve metinden)`)

    return result
}

/**
 * Telefon numarasını normalize eder
 * Çıktı: 90XXXXXXXXXX formatında string veya null (geçersizse)
 */
export function normalizePhone(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') {
        return null
    }

    // A. Temizleme: Sadece rakamları bırak
    let digits = rawPhone.replace(/\D/g, '')

    if (!digits || digits.length === 0) {
        return null
    }

    // B. Ülke kodu ve baştaki 0 işlemleri
    let nationalNumber = null

    // 1. Zaten 90XXXXXXXXXX formatında mı?
    if (/^90\d{10}$/.test(digits)) {
        nationalNumber = digits.substring(2) // 10 haneli ulusal numara
        return `90${nationalNumber}`
    }

    // 2. 0XXXXXXXXXX formatında mı? (baştaki 0'ı çıkar)
    if (/^0\d{10}$/.test(digits)) {
        nationalNumber = digits.substring(1) // 0'ı çıkar, 10 hane kalır
        return `90${nationalNumber}`
    }

    // 3. 0090XXXXXXXXXX formatında mı? (00'ı çıkar)
    if (/^0090\d{10}$/.test(digits)) {
        nationalNumber = digits.substring(4) // 0090'ı çıkar, 10 hane kalır
        return `90${nationalNumber}`
    }

    // 4. +90XXXXXXXXXX formatında mı? (+ zaten temizlendi, 90XXXXXXXXXX olmalı)
    if (/^90\d{10}$/.test(digits)) {
        nationalNumber = digits.substring(2)
        return `90${nationalNumber}`
    }

    // 5. Ulusal 10 hane formatı (başında 0 veya 90 yok)
    // Mobil: 5XXXXXXXXX (10 hane, 5 ile başlar)
    // Sabit: 2XXXXXXXXX veya 3XXXXXXXXX (10 hane, 2 veya 3 ile başlar)
    if (/^[235]\d{9}$/.test(digits)) {
        return `90${digits}`
    }

    // 6. Özel numaralar: 444 (7 hane)
    // Talimata göre: 4440123 gibi 7 hane olarak insert edilmeli
    // Ancak normalize format 90XXXXXXXXXX (12 hane) olduğu için bu uymaz
    // Bu yüzden null döndürüyoruz (özel numaralar ayrı işlenecek veya farklı formatta kaydedilecek)
    if (/^444\d{4}$/.test(digits)) {
        // 4440123 -> 7 hane, normalize edilmez
        return null
    }

    // 444 ile başlayan ama farklı formatlar (0444...)
    if (/^0444\d{4}$/.test(digits)) {
        // 04440123 -> 4440123 (7 hane, normalize edilmez)
        return null
    }

    // 7. Özel numaralar: 850 (10 hane)
    // Örnek: 0850 222 00 00 → 908502220000
    if (/^0850\d{7}$/.test(digits)) {
        nationalNumber = digits.substring(1) // 0'ı çıkar: 850XXXXXXX (10 hane)
        return `90${nationalNumber}`
    }

    if (/^850\d{7}$/.test(digits)) {
        // 850XXXXXXX (7 hane) - bu durumda 10 hane olmalı, kontrol et
        // Eğer 850 ile başlayıp 7 hane daha varsa toplam 10 hane
        if (digits.length === 10) {
            return `90${digits}`
        }
        return null
    }

    // 8. Özel numaralar: 800 (10 hane)
    // Örnek: 0800 123 45 67 → 908001234567
    if (/^0800\d{7}$/.test(digits)) {
        nationalNumber = digits.substring(1) // 0'ı çıkar: 800XXXXXXX (10 hane)
        return `90${nationalNumber}`
    }

    if (/^800\d{7}$/.test(digits)) {
        // 800XXXXXXX (7 hane) - bu durumda 10 hane olmalı
        if (digits.length === 10) {
            return `90${digits}`
        }
        return null
    }

    // C. Tür doğrulama - Geçersiz formatlar
    // 10 haneli değilse veya geçerli bir tür değilse geçersiz
    if (digits.length < 10 || digits.length > 12) {
        return null
    }

    // 11 haneli kontrolü: 0XXXXXXXXXX formatı
    if (digits.length === 11) {
        if (digits.startsWith('0')) {
            nationalNumber = digits.substring(1) // 0'ı çıkar
            // Mobil: 5 ile başlamalı
            if (nationalNumber.startsWith('5') && nationalNumber.length === 10) {
                return `90${nationalNumber}`
            }
            // Sabit: 2 veya 3 ile başlamalı
            if ((nationalNumber.startsWith('2') || nationalNumber.startsWith('3')) && nationalNumber.length === 10) {
                return `90${nationalNumber}`
            }
            // Özel: 850 veya 800 ile başlamalı
            if ((nationalNumber.startsWith('850') || nationalNumber.startsWith('800')) && nationalNumber.length === 10) {
                return `90${nationalNumber}`
            }
        }
        return null
    }

    // 12 haneli kontrolü: 90XXXXXXXXXX formatı (zaten işlendi)
    if (digits.length === 12) {
        if (digits.startsWith('90')) {
            nationalNumber = digits.substring(2)
            // Mobil: 5 ile başlamalı
            if (nationalNumber.startsWith('5') && nationalNumber.length === 10) {
                return digits // Zaten doğru formatta
            }
            // Sabit: 2 veya 3 ile başlamalı
            if ((nationalNumber.startsWith('2') || nationalNumber.startsWith('3')) && nationalNumber.length === 10) {
                return digits // Zaten doğru formatta
            }
            // Özel: 850 veya 800 ile başlamalı
            if ((nationalNumber.startsWith('850') || nationalNumber.startsWith('800')) && nationalNumber.length === 10) {
                return digits // Zaten doğru formatta
            }
        }
        return null
    }

    // 10 haneli kontrolü: XXXXXXXXXX formatı (ulusal numara)
    if (digits.length === 10) {
        const firstDigit = digits[0]

        // Mobil: 5 ile başlamalı
        if (firstDigit === '5') {
            return `90${digits}`
        }

        // Sabit hat: 2 veya 3 ile başlamalı
        if (firstDigit === '2' || firstDigit === '3') {
            return `90${digits}`
        }

        // Özel: 850 veya 800 ile başlamalı
        if (firstDigit === '8') {
            if (digits.startsWith('850') || digits.startsWith('800')) {
                return `90${digits}`
            }
        }

        return null
    }

    // Geçersiz
    return null
}
