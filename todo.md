.env.local içine NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY leri koydum. Projede supabase psql tablo kullanıyoruz.




**Amaç:**
Google Maps’ten gelen lead verilerini Supabase’den alıp, web sitelerini scrape ederek telefon & email zenginleştirme işlemi yapmak, verileri `lead_phones` ve `lead_emails` tablolarına kaydetmek, enrichment durumlarını izlemek ve loglamak.

---

# 📌 GENEL PROJE MİMARİSİ

Bu proje Next.js 14 (app router), Supabase JS SDK ve lightweight scraper modülleri ile çalışacak.

## Ana özellikler:

1. Kullanıcıya **lead_groups** listesini sun

2. Seçilen grubun **leads** kayıtlarını çek (`primary_group_id` ile)

3. Enrichment durumu uygun olan leadleri seç:

   * is_enriched = false OR null
   * enrichment_status IS NULL
   * enrichment_status = 'failed'

4. Pipeline:

   * Lead’in `phone` alanını al → `lead_phones` tablosuna source="map" ile ekle (duplicate olmamalı)
   * Eğer lead.websitesi varsa(bazı leadlerin website sütunu boş olabilir):

     * Website’yi indir
     * Header, footer, contact sayfalarını bulmaya çalış
     * Regex ile max **20 telefon**, max **20 email** çıkar
     * Duplication kontrolü ile `lead_phones` ve `lead_emails` tablosuna ekle

5. Zenginleştirme sonucu:

   * Başarılı → leads tablosunda:

     ```
     is_enriched = true
     enriched_at = NOW()
     enrichment_status = 'success'
     enrichment_error = NULL
     ```
   * Hata →

     ```
     enrichment_status = 'failed'
     enrichment_error = 'error message'
     ```

6. Açılmayan veya sorunlu siteleri bir listeye ekle:

   * Bu listeyi kullanıcıya dashboard’dan göster
   * İsterse Playwright Worker ile tekrar “hard scraping” yapılır
     (JS rendering, Cloudflare bypass, timeout artırma) (Kullanıcı gözetiminde tek tek yarı otomatik bir sistem ile yapabiliriz.)

7. Dashboard:

   * Seçilen grup
   * Toplam lead
   * Kaçı success, kaçı failed
   * Log ekranı (gerçek zamanlı)
   * Son 100 scrape log’u

---

# 📌 DB TABLOLARI

### 1) leads

```
phone → Maps’ten gelen orijinal telefon
website → site adresi
```

Ek alanlar:

```
is_enriched BOOLEAN
enriched_at TIMESTAMP
enrichment_status TEXT
enrichment_error TEXT
```

### 2) lead_phones

```
id UUID PK
lead_id UUID fk
phone TEXT
has_whatsapp BOOLEAN (şimdilik null)
source TEXT ('map' veya 'website')
created_at timestamp
```

**UNIQUE constraint öner:**

```
UNIQUE (lead_id, phone)
```

### 3) lead_emails

```
id UUID PK
lead_id UUID fk
email TEXT
source TEXT
created_at timestamp
```

**UNIQUE constraint öner:**

```
UNIQUE (lead_id, email)
```

---

# 📌 SCRAPER TASARIMI

Scraper iki modda çalışmalı:

## 1) **Light Mode (Default)**

* Normal site fetch
* 10 saniye timeout
* Redirect desteği
* Cloudflare friendly user-agent
* Regex tarama
* Yalnızca şu sayfalar taranacak:

  * ana sayfa
  * /iletisim
  * /contact
  * vb. türkçe ve ingilizce sitelerdeki yaygın iletişim sayfalarının tamamnını kontrol et
  * Header ve footer linkleri

→ Bu mod 95% website’yi çözer, hızlı ve düşük maliyetlidir.

## 2) **Hard Mode (Fallback)**

* Playwright (Chromium headless) ile site açılır
* JS ile render edilir
* Cloudflare turnstile/challenge otomatik çözme
* 20 second timeout
* Tekrar regex taraması

→ Bu işlem yalnızca ilk mod hata verince çalışır.

---

# 📌 FİLE STRUCTURE (Cursor oluşturabilir)

```
/app
   /groups
      page.tsx → lead_groups listesi
   /group/[id]
      page.tsx → group leads listesi + “Zenginleştir” butonu
   /enrich
      /api
         route.ts → enrichment pipeline başlatıcı
   /logs
      page.tsx → log ekranı

/lib
   supabase.ts → client
   fetchSite.ts → lightweight scraper
   fetchSiteHard.ts → playwright scraper
   extractPhones.ts
   extractEmails.ts
   insertPhonesEmails.ts
   updateLeadStatus.ts

/components
   GroupSelector.tsx
   LeadList.tsx
   LogConsole.tsx
```

---

# 📌 ENRICHMENT PIPELINE AKIŞI

### 1) API endpoint: POST `/enrich/api`

* Parametre: group_id
* İşlemler:

  * Leads → 100’er batch’lerle çek
  * Her lead için async queue oluştur
  * `Promise.allSettled` kullan
  * Minimum sunucu yükü odaklı

### 2) Her lead için işlem:

```
1. Maps telefonunu lead_phones içine ekle (duplicate check)
2. Website varsa:
    - Light fetch dene
    - Hata → Hard fetch dene
3. Telefon & email çıkar (max 20 + 20)
4. lead_phones ve lead_emails'e ekle
5. Status güncelle
```

### 3) Loglama

Her işlem adımını:

* /logs sayfasına WebSocket ile aktar
* Supabase realtime kullanılabilir

---

# 📌 DUPLICATE ENGELLEME

Telefon için:

```
INSERT INTO lead_phones (lead_id, phone, source)
VALUES (...)
ON CONFLICT (lead_id, phone)
DO NOTHING;
```

Email için:

```
ON CONFLICT (lead_id, email)
DO NOTHING;
```

---

# 📌 REGEX TARAYICILAR

Telefon:

```
/(\+?\d[\d\s\-\(\)]{8,})/g
```

Email:

```
/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
```

---

# 📌 SCRAPE LİMİTLERİ

* max 20 telefon
* max 20 email
* max 10 URL fetch
* 10 saniye soft timeout

---

# 🎯 **Cursor’dan beklentim**

Bu prompt’a göre:

✔ Dosya yapısını kur
✔ Next.js API route’larını oluştur
✔ fetchSite, regex extractor, DB insert fonksiyonlarını yaz
✔ Dashboard + grup seçici + log ekranı UI tasarla
✔ 100’erli batch çalışan enrichment queue sistemi oluştur
✔ Tüm pipeline’ı çalışır halde üret