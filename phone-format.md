

## 📌 **GENEL KURALLAR**

* Türkiye’de telefon numaraları **10 hanelidir** (ülke kodu hariç).
* Ülke kodu varsa: **+90**, **90**, **0090** gibi yazılabilir.
* Telefonlar farklı biçimlerde boşluklu / boşluksuz / parantezli / tireli olabilir.
* Sadece **Türkiye mobil**, **Türkiye sabit hat**, **444**, **800**, **850** numaralarını tespit et.
* Numara içinde kaçak harf, noktalama, yanlış karakter varsa temizle.

---

## 📌 **1. MOBİL NUMARALAR (GSM)**

### **Yapı**

* Daima **5XX ile başlar** (ör: 530–599 arası).
* Ülke kodu olabilir veya olmayabilir.

### **Geçerli Biçimler**

Aşağıdaki tüm biçimler geçerlidir:

* `05XX XXX XX XX`
* `+90 5XX XXX XX XX`
* `5XX XXX XX XX`
* `5XXXXXXXXX`
* `0(5XX) XXX XX XX`
* `+905XXXXXXXXX`

### **GSM Numarası Şablonu**

* `^(\+?90|0)?5\d{9}$`
  (farklı yazımları temizledikten sonra doğrulama için)

---

## 📌 **2. SABİT HAT NUMARALARI (KARASAL)**

### **Yapı**

* Türkiye sabit hatları **3 haneli alan kodu + 7 haneli numara** şeklindedir.
* Alan kodları **2XX veya 3XX** şeklindedir.
* Şehirden şehire kod değişir (ör: 212, 216, 312, 224 vb.).

### **Geçerli Biçimler**

* `0XXX XXX XX XX`
* `+90  XXX XXX XX XX`
* `(0XXX) XXX XX XX`
* `XXX XXX XX XX`
* `0XXXXXXXXXX`
* `+90XXXXXXXXXXX`

### **Sabit Hat Şablonu**

Numara temizlendikten sonra:

* İlk üç rakam **2** veya **3** ile başlamalı.
* Toplam 10 hane olmalı (ör: 2121234567).

---

## 📌 **3. ÖZEL NUMARALAR**

### **444’lü Numara**

* `444 X XX XX`
* Alan kodu yoktur, 7 rakamlıdır.

### **850’li Numara**

* `0850 XXX XX XX`
* `850XXXXXXX`
* Toplam 10 hanelidir (850 ile başlar).

### **800’lü Numara**

* `0800 XXX XX XX`
* Ücretsiz hatlar.

### **Özel Numara Şablonları**

* **444** → `^444\d{4}$`
* **850** → `^0850\d{7}$` veya `^850\d{7}$`
* **800** → `^0800\d{7}$` veya `^800\d{7}$`

---

## 📌 **4. OLASI YAZIM BİÇİMLERİ**

Scrape sırasında karşılaşılabilecek örnekler:

* `0 555 555 55 55`
* `0555-555-55-55`
* `(+90) 555 555 55 55`
* `+9 0 555 555 55 55`
* `05555555555`
* `5 5 5 5 5 5 5 5 5 5`
* `212 555 55 55`
* `(0212) 5555555`
* `0 (212) 555 55 55`
* `444 0 123`
* `0850 222 00 00`

Bu nedenle:

* Tüm boşluklar, `-`, `(`, `)` gibi karakterler temizlenmeli.
* Sadece **rakamlar** kalmalı.
* Sonra kategoriye göre doğrulanmalı.

---

## 📌 **5. TESPİT MANTIĞI**

### Numara temizleme:

1. Sayı dışındaki tüm karakterleri kaldır.
2. Ülke kodu varsa (`+90`, `90`, `0090`) çıkar.
3. Kalan rakamlara göre türünü belirle.

### Tür belirleme:

* **10 haneli ve 5 ile başlıyorsa → Mobil**
* **10 haneli ve 2 veya 3 ile başlıyorsa → Sabit hat**
* **444 ile başlıyorsa ve toplam 7 hane → 444’lü numara**
* **850 ile başlıyorsa → 850 numara**
* **800 ile başlıyorsa → 800 numara**
* Diğerleri → geçersiz

---

## 📌 **6. SONUÇ FORMATIN**

Her tespit edilen numara şu formatta normalize edilmeli:

```
{
  "raw": "orijinal yazım",
  "clean": "905551112233",
  "type": "mobile | landline | 444 | 850 | 800",
  "city_code": "örn: 212 (sabit hatlarda)",
  "valid": true/false
}
```

Mobil ve sabit hatlar için **daima uluslararası format**:

* `90XXXXXXXXXX`

Örn:
`0555 555 55 55` → **905555555555** değil → **90555555555** (başındaki tek 0 atılır)

---

## 📌 **7. HARİÇ TUTULACAKLAR**

* 11 haneli olup **05 ile başlamayan** numaralar → geçersiz
* 444 olmayan 7 haneliler → geçersiz
* 10 haneli olup 2, 3 veya 5 ile başlamayanlar → geçersiz
* Rastgele rakam dizileri (“1234567890” gibi)
* Fiyatlar, paralar, referans numaraları
* Faks numarası tespit edilirse yine dahil edilebilir (isteğe göre)

---

# 📌 **Bu talimatın amacı**

Web sitelerindeki tüm Türk telefon numaralarını, farklı yazım biçimlerini normalize ederek doğru türde sınıflandırmak. 

Bu görevlere ek olarak topladığın tüm telefon numaralarını normalize ederek insert etmelisin. 


**Amaç:** Her tespit edilen telefon için veritabanına direkt insert edilebilecek tek bir normalize edilmiş değer üret.
**Normalize edilmiş hedef format (mutlak):** `90XXXXXXXXXX`

* Yani: ülke kodu `90` + 10 haneli ulusal numara, boşluk/tire/parantez yok, `+` veya `0` **yok**.

**Örnek geçerli çıktı (veritabanına insert edilecek tek değer):**
`902242612060`
`905456674114`
`905456674114`

---

## 1) Öncelik ve genel kural

1. Bulunan her telefon adayı için **yalnızca bir** normalize edilmiş string üret.
2. Eğer sayfada birden fazla numara varsa, her numara için ayrı bir çıktı üret (her çıktı **yalnızca** normalize edilmiş string olmalı).
3. Hiçbir açıklama, meta veya JSON/etiket ile birlikte dönme — sadece düz metin (örnek: `905551122233`).
4. Geçersizse veya Türkiye numarası değilse sonuç üretme (veya boş string döndür).

---

## 2) Aşama aşama normalizasyon algoritması

**A. Aday tespiti (loosely match / ön eleme)**

* Sayfada telefon olabilecek kısımları yakalamak için şu geniş arama-regex’lerinden (veya benzerlerinden) yararlan:

  * `(?:(?:\+?90|0090|0)?[ \-\(\)\.\d]{7,20})`
  * veya daha sıkı: `(\+?90|0090|0)?[ \-\(\)\.\d]{9,15}`
* Bu, parantezli, boşluklu, tireli, noktalı vb. pek çok yazımı yakalar.

**B. Temizleme (cleaning)**

* Aday string’den tüm harfleri ve boşluk dışı sembolleri temizle: sadece rakamları bırak.

  * Örnek: `+90 (224) 261 20 60` → `902242612060`
  * `(0545) 667 41 14` → `05456674114`
  * `0555-555-55-55` → `05555555555`

**C. Ülke kodu / baştaki 0 işlemleri**

* Temizlenmiş rakam dizisini kontrol et:

  1. Eğer `^90\d{10}$` ise: zaten final formata yakın — **çıktı = bu string**. (ör: `902242612060` → çıktı `902242612060`)
  2. Eğer `^0\d{10}$` ise: baştaki `0` çıkar, kalan 10 hane alın ve başına `90` ekle → `90` + `xxxxxxxxxx`.

     * `05456674114` → `5456674114` → `90` + `5456674114` = `905456674114`
  3. Eğer `^5\d{9}$` veya `^[23]\d{9}$` ise: zaten ulusal 10 hane formatı (başında 0 yok)

     * `5456674114` → `90` + `5456674114` = `905456674114`
     * `2242612060` → `90` + `2242612060` = `902242612060`
  4. Eğer `^0090\d{10}$` ise: `00` çıkar → `90\d{10}` → çıktı bu formatta.
  5. Eğer `^\+90\d{10}$` ise: `+` çıkar → `90\d{10}` → çıktı bu formatta.

**D. Tür doğrulama (son kontrol — Türkiye için geçerli mi?)**

* Mobil: ulusal 10 haneli ve ilk rakam `5` olmalı. (`5XXXXXXXXX`)
* Sabit: ulusal 10 haneli ve ilk rakam `2` veya `3` olmalı. (`2XXXXXXXXX` veya `3XXXXXXXXX`)
* Özel:

  * `444` → 7 haneli (ör: `4440123`) — normalize etme: **bu türleri veritabanına** `90` ile mi kaydetmek istediğinize göre karar verin. (Öneri: `904440123` değil; eğer tek sütuna kesin `90XXXXXXXXXX` formatı gerekiyorsa **444’lüleri `90`+0-padding ile değil, ayrı tut**. Ancak istenirse `90` + `444` + `xxxx` → örnek `90444012345` yapmayın; kötü uygulama.)
  * `850`/`0800`: genelde 10 hane (`0850xxxxxxx`, `0800xxxxxxx`) — normal mobil/sabit kurallarına göre değil; ama `0850...` → temizlendikten sonra `9050...` değil; **doğru normalize: `90` + ulusal 10 hane** (ör: `08501234567` → `8501234567` → `908501234567`).
* **Kural:** Eğer temizleme sonucu ulusal 10 hane elde edilemiyorsa veya ilk rakam 2/3/5/8/0/4 gibi özel istisnalar dışındaysa **geçersiz say ve çıktı üretme**.

**E. Nihai çıktı oluşturma**

* Nihai çıktı her zaman **`90` + ulusal 10 hane** (12 rakam) olmalı: örn `902242612060` veya `905456674114`.
* **Sadece** bu stringi döndür.

---

## 3) Regex ve doğrulama örnekleri

**Tespit için (geniş):**

```
(?:(?:\+?90|0090|0)?[ \-\(\)\.\d]{7,20})
```

**Temizlendikten sonra kabul edilecek formlar (son doğrulama):**

* Mobil (önce temizle, ardından kontrol): `^(?:\+?90|0090|0)?5\d{9}$`
* Sabit: `^(?:\+?90|0090|0)?[23]\d{9}$`
* 444: `^(?:444)\d{4}$` (bu 7 haneli, özel işlem gerekebilir)
* 0850: `^(?:\+?90|0090|0)?850\d{7}$`
* 0800: `^(?:\+?90|0090|0)?800\d{7}$`

**Normalize (çıktı) örnek kontrol regex’i:**

```
^90\d{10}$
```

— eğer bu sağlanmıyorsa **çıktı üretme**.

---

## 4) Örnek giriş → çıktı (tam olarak ne dönülecek)

Aşağıdaki örnekler **tam olarak** nasıl normalize edilip döndürüleceğini gösterir:

* `+90 (224) 261 20 60`  → `902242612060`
* `(0545) 667 41 14`     → `905456674114`
* `(0224) 238 38 54`     → `902242383854`
* `0555 555 55 55`       → `90555555555`  *(NOT: 1 eksik hane görünürse hata; doğru olan `05555555555` → `90555555555` )*
* `+905551112233`       → `905551112233`
* `444 0 123`            → **(özel)** tercihe göre: ya ayrı işlenecek, ya `4440123` diye dönecek — **öneri:** eğer veritabanı tek format (`90XXXXXXXXXX`) şartıysa **444’lüleri ayrı bir pipeline ile kaydet.**
* `0850 222 00 00`      → `908502220000`
* `0800 123 45 67`      → `908001234567`
* `123456`               → **geçersiz** (çıktı üretme)



Özel olarak: 444, 800 ve 850 ile başlayan numaraları 7 hane olarak insert et. 4440123, 8508585, 8008080 gibi insert edilmelidir.
---

## 5) Hata / istisna yönetimi

* Temizlendikten sonra **ulusal 10 hane** elde edilemiyorsa → **çıktı üretme** (veya boş metin).
* Eğer birden fazla aday eşleşiyorsa: her aday için ayrı normalize edilmiş satır üret. Cursor AI çıktısı birden fazla satır ise her satırı ayrı kayıt olarak insert edilebilir.
* Özel numaralar (444, 0800, 0850) için eğer veritabanı formatı `90XXXXXXXXXX` ise **önceden karar ver**:

  * A) Hepsini `90` + ulusal10hane yap (0850 -> `90850...`) — kabul edilebilir.
  * B) 444’lüleri ve ücretsiz hattı ayrı tut (tercih edilen yaklaşım).

