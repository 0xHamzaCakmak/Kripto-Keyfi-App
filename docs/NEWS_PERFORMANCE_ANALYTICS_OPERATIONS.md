# Haber performans, analytics ve operasyon standardı

## Core Web Vitals eşikleri

Mobil gerçek kullanıcı verisinde p75 hedefleri:

- LCP: iyi `<= 2500 ms`, uyarı `2501-4000 ms`, regresyon `> 4000 ms`
- CLS: iyi `<= 0.10`, uyarı `0.11-0.25`, regresyon `> 0.25`
- INP: iyi `<= 200 ms`, uyarı `201-500 ms`, regresyon `> 500 ms`
- Lighthouse yayın kapısı: Performance `>= 80`, Accessibility `>= 95`, Best Practices `>= 95`, SEO `>= 95`

Rapor: `docs/lighthouse-news-mobile-2026-08-07.json`. Lighthouse laboratuvar sonucu ile admin panelindeki izinli gerçek kullanıcı p75 verileri birlikte değerlendirilir.

7 Ağustos 2026 production mobil laboratuvar ölçümü: Performance `80`, Accessibility `100`, Best Practices `100`, SEO `100`; LCP `4014 ms`, CLS `0.010`, TBT `39 ms`. Lighthouse ölçümündeki LCP uyarı sınırındadır; yayın sonrasında izinli gerçek kullanıcı p75 LCP verisi admin panelinden izlenmelidir.

## Görsel ve bundle politikası

- Haber detay hero görseli yüksek öncelikli yüklenir; kart ve ilgili haber görselleri lazy-load edilir.
- Tüm görsellerde intrinsic ölçüler/aspect-ratio, async decoding ve yerel fallback bulunur.
- Yalnızca `VITE_NEWS_IMAGE_HOSTS` ve kod içindeki doğrulanmış HTTPS host listesi kabul edilir.
- Route bileşenleri lazy-load edilir. Ana chunk için 500 kB regresyonu build hatası kabul edilir.
- Hostinger üzerinde ayrı bir görsel dönüştürme servisi bulunmadığı için üçüncü taraf görsel proxy'si açılmaz; SSRF, telif ve bant genişliği riski alınmaz. CDN destekleyen kaynaklarda WebP/AVIF ve responsive varyant entegrasyonu kaynak adapter'ında yapılır.

## Analytics ve KVKK yaklaşımı

Sağlayıcı KriptoKeyfi backend'idir; üçüncü taraf analytics SDK'sı veya reklam çerezi kullanılmaz. Ölçüm varsayılan kapalıdır ve yalnızca kullanıcının “İzin ver” seçiminden sonra başlar.

Saklanmayan veriler:

- kullanıcı ID, e-posta, IP adresi veya cihaz parmak izi
- API anahtarı, auth tokenı veya cookie içeriği
- arama metni, form girdisi, tam URL veya query parametreleri

Saklanan sınırlı alanlar:

- izinli olay tipi, haber ID, kaynak slug, kategori
- özet kelime sayısı, anonim süre ve scroll yüzdesi
- LCP/CLS/INP adı ve sayısal değeri

## 30 günlük KPI'lar

- Teknik index uygunluğu: `>= %95`; gerçek Google index oranı Search Console'dan ayrıca izlenir.
- Ortalama doğrulanmış özet okuma: `>= 30 saniye`
- Kaynak CTA CTR: `%10-%45` gözlem bandı; aşırı düşük/yüksek değerlerde özet uzunluğu incelenir.
- İlgili haber CTR: `>= %8`
- AI hatalı iş oranı: `< %3`
- Worker son başarı yaşı: `< 15 dakika`; daha eskiyse operasyon alarmı
- Groq 429 sayısı ve bekleyen kuyruk her gün admin panelinden kontrol edilir.

Özet uzunluğu raporu `<150`, `150-199`, `200-249`, `250+` kelime gruplarında görüntülenme ve kaynak CTR karşılaştırması üretir.
