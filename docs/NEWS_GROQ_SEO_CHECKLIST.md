# KriptoKeyfi Haber, Groq ve SEO Uygulama Checklist'i

Son güncelleme: 6 Ağustos 2026

Bu dosya, haberlerin KriptoKeyfi içinde Türkçe ve editoryal değer taşıyan bir özetle sunulması; kullanıcının isterse en sonda özgün kaynağa geçmesi; haber sayfalarının taranabilir, hızlı ve ölçülebilir hale getirilmesi için canlı uygulama planıdır.

## Temel kararlar ve sınırlar

- [x] Mevcut teknoloji doğrulandı: frontend React 19 + Vite SPA, backend Express + Prisma + MySQL. Proje Next.js kullanmıyor; bu nedenle ISR doğrudan uygulanmayacak.
- [x] Haber kartlarının `/haberler/:slug` iç route'una gitmesi ve kaynak bağlantısının detayın sonunda bulunması korunacak.
- [x] Frontend harici haber API'sine veya Groq'a doğrudan bağlanmayacak. Tüm istekler backend ve veritabanı üzerinden ilerleyecek.
- [x] Harici sayfanın tam metni izin olmadan scrape edilmeyecek, saklanmayacak veya yeniden yayımlanmayacak.
- [x] Özet yalnızca kaynağın kullanım izni verdiği başlık, excerpt/spot ve metadata üzerinden üretilecek.
- [x] Çok kısa bir girdiden 200-300 kelimelik metin uydurulmayacak. Özet uzunluğu mevcut kanıt miktarına göre belirlenecek.
- [x] AI içeriği tek başına “özgün SEO içeriği” kabul edilmeyecek; bağlam, neden önemli, ilgili konu/coin ve iç linklerle gerçek editoryal değer eklenecek.
- [x] `rel="nofollow"` bir “SEO gücü sızmasını” kesin olarak engelleyen araç gibi değerlendirilmeyecek; dış kaynak CTA'sında atıf ve güvenlik amacıyla `nofollow noopener noreferrer` kullanılacak.

## Aşama 1 — Groq sağlayıcı katmanı

- [x] Backend ortam değişkenlerini ekle:
  - `NEWS_AI_PROVIDER=groq`
  - `GROQ_API_KEY=`
  - `GROQ_PRIMARY_MODEL=openai/gpt-oss-20b`
  - `GROQ_FALLBACK_MODEL=openai/gpt-oss-120b`
  - `NEWS_AI_ENABLED=true`
  - `NEWS_AI_MAX_CONCURRENCY=2`
- [x] OpenAI'ye özel mevcut yerelleştirme kodunu sağlayıcıdan bağımsız `NewsLocalizationProvider` arayüzüne ayır.
- [x] `GroqNewsLocalizationProvider` adapter'ını oluştur.
- [x] Groq'un OpenAI uyumlu `POST /openai/v1/chat/completions` endpoint'ini yalnızca backend'den çağır.
- [x] SDK zorunluluğu oluşturmadan mevcut Node `fetch` ile entegrasyonu gerçekleştir.
- [x] API anahtarını loglardan, hata mesajlarından ve frontend bundle'ından tamamen uzak tut.
- [x] Ücretsiz kota değişebileceği için model ve limitleri kod yerine env üzerinden yönet.
- [x] Birincil model kullanılamazsa yalnızca tanımlı fallback modele geç; sınırsız model döngüsü oluşturma.
- [x] `llama-3.3-70b-versatile` kullanma: Groq bu modeli 16 Ağustos 2026'da free/developer tier için kapatıyor.

## Aşama 2 — Güvenli ve kaliteli içerik boru hattı

- [x] Akışı `fetch → normalize → dedupe → izin kontrolü → AI işleme → kalite kontrolü → kayıt/yayın` olarak uygula.
- [x] Dedupe için mevcut üç kontrolü koru:
  - `sourceId + providerNewsId`
  - normalize edilmiş canonical/original URL
  - başlık fingerprint'i
- [x] Yalnızca `isActive + isTrusted + commercialUseAllowed + excerptAllowed` kaynakları işle.
- [x] Kaynak metindeki HTML'i güvenli biçimde temizle; script, iframe, instruction/prompt injection parçalarını modele gönderme.
- [x] Groq isteğine en fazla izin verilen başlık, excerpt, kaynak adı, tarih ve kategori bilgisini gönder.
- [x] Modelden yapılandırılmış JSON iste:
  - `title_tr`
  - `summary_tr`
  - `why_it_matters`
  - `market_impact`
  - `watch_outs`
  - `tags`
  - `related_coins`
  - `confidence`
  - `needs_review`
- [x] JSON çıktısını Zod şemasıyla tekrar doğrula; hatalı cevabı veritabanına yazma.
- [x] Terminoloji prompt'unda Airdrop, Staking, Gas Fee, Whale/Balina, Bullish, Bearish, Smart Contract, Likidite, DeFi, Layer-2 ve ETF kullanımını koru.
- [x] Modelin girdide olmayan rakam, fiyat, kişi, tarih veya nedensellik üretmesini açıkça yasakla.
- [x] Yatırım tavsiyesi, fiyat tahmini, clickbait ve kesinlik belirten doğrulanmamış ifadeleri yasakla.
- [x] Yeterli girdide doğrulanmış özet ile editoryal katkının toplamını 120-220 kelime hedefinde tut.
- [x] Girdi çok kısaysa doğrulanmış özeti kısa tut ve `needs_review=true` işaretle; eksik olguları uydurma.
- [x] Özet ve editoryal katkıyı okunabilir ayrı bölümlere ayır; tek uzun blok üretme.
- [x] Kaynak excerpt'i ile özet arasında 4-gram benzerlik kontrolü uygula; aşırı benzer çıktıyı incelemeye al.
- [x] Başlık, özet ve editoryal katkı için Zod karakter sınırları ile kelime kalite kontrolü uygula.
- [x] Boş, şema dışı, URL/Markdown içeren veya yetersiz çıktıları reddet ya da incelemeye al.
- [x] Aynı `inputHash + promptVersion` için ikinci kez API çağrısı yapma.
- [x] 429 yanıtında `Retry-After` başlığını kullan; exponential backoff + jitter ile en fazla iki retry yap.
- [x] 401/403 hatalarında retry yapma; haber senkronizasyonunu ve kayıtlı haberleri etkileme.
- [x] Groq erişilemezse mevcut haberleri göstermeye devam et; haber akışını durdurma.
- [x] Beş başarısız denemeden sonra haberi manuel inceleme kuyruğuna al.
- [x] Rate-limit bilgisini yalnızca çalışma anında kullan; anahtar veya kişisel veri loglama.

## Aşama 3 — Veritabanı ve editoryal durum

- [x] `NewsArticle` üzerinde `titleTr`, `summaryTr`, `localizedAt`, `localizationError` ve `localizationAttempts` alanları mevcut.
- [x] `NewsAiSummary` üzerinde sağlayıcı, model, prompt sürümü ve input hash saklanabilecek alanlar mevcut.
- [x] `NewsAiSummary` alanlarını Groq çıktısındaki `why_it_matters`, olası etki, takip noktaları ve kalite metadata'sı ile eşleştir.
- [x] Migration ile `confidence`, `needsReview`, `wordCount` ve `qualityFlags` alanlarını ekle.
- [x] Migration'ı reset kullanmadan, mevcut kullanıcı ve trade bot verilerini koruyarak uygula.
- [x] AI başarısızsa orijinal izinli excerpt'i fallback olarak göster; boş sayfa üretme.
- [x] İlk 20 yabancı haber için otomatik yayın yerine admin incelemesi uygula.
- [x] Kalite kabul edildikten sonra yalnızca güvenilir kaynaklarda auto-publish aç.
- [x] Öne çıkarılmış, favorilenmiş veya editoryal içeriklere retention uygulamama kuralını koru.

## Aşama 4 — Haber detay sayfası ve mevcut tasarım

- [x] Haber kartları site içindeki `/haberler/:slug` sayfasına bağlanıyor.
- [x] Detay sayfasında görsel, başlık, kaynak, tarih ve Türkçe özet alanı mevcut.
- [x] Özet ve editoryal katkıyı kartlar yerine doğal paragraf akışında göster.
- [x] “Neden önemli?”, “Olası etkiler” ve “Takip edilecekler” bölümlerini özetten sonra ekle.
- [x] Sağ sütuna mevcut tasarım dilinde “En Çok Okunan” ve “Popüler Etiketler” bloklarını ekle.
- [x] Kaynak CTA kartını tüm özet ve editoryal katkıdan sonra göster.
- [x] CTA'yı turuncu dolu birincil buton yerine turuncu outline/ikincil aksiyon olarak tasarla.
- [x] CTA kartına kaynak logosu/fallback harfi, kaynak adı ve “Bu özet X kaynağından derlenmiştir” açıklaması ekle.
- [x] Dış bağlantıyı yeni sekmede `rel="nofollow noopener noreferrer"` ile aç.
- [x] Kaynak favicon/logo alanında yalnızca yerel varlıkları yükle; harici URL için kaynak baş harfi fallback'i uygula.
- [x] Detay sayfasında aynı kategori/story cluster üzerinden ilgili haberler bulunuyor.
- [x] İlgili haberleri görselli 3-4 karta dönüştür ve benzersiz iç linkler üret.
- [x] Mobilde sidebar'ı ana içerikten sonra göster; yatay taşmayı önleyen `min-w-0`, responsive grid ve sabit görsel oranları kullan.
- [x] Küçük telefon, büyük telefon, tablet ve desktop breakpoint kurallarını typecheck/production build ile doğrula; tarayıcı görsel regresyonunu yayın öncesi tekrar kontrol et.
- [x] RSS içindeki standart, kodlanmış ve lazy-load görsel alanlarını ayrıştır; yalnızca görsel izni bulunan kaynaklarda kaydet.
- [x] Görsel bulunmadığında veya yüklenemediğinde boş alan yerine yerel KriptoKeyfi kategori görseli göster.
- [x] Kaydet, paylaş ve “Haber merkezine dön” eylemlerini okuma akışının en altına birlikte yerleştir.

## Aşama 5 — URL, kategori ve iç link mimarisi

- [x] Kalıcı ve okunabilir `/haberler/:slug` yapısı mevcut.
- [x] Kategori filtrelerini gerçek linklere dönüştür: `/haberler/kategori/bitcoin`, `/haberler/kategori/defi`.
- [x] Etiketleri gerçek linklere dönüştür: `/haberler/etiket/bitcoin-etf`.
- [x] Client-side kategori, etiket ve konu sayfalarının backend filtre parametrelerini gerçekten kullanmasını sağla.
- [x] `/blog/*` ve `/insights/*` kopya route'larını istemci fallback'i ve Vercel/Netlify kalıcı redirect kurallarıyla `/haberler/*` canonical yapısına yönlendir.
- [x] Detay sayfasına `Anasayfa > Haberler > Kategori > Başlık` breadcrumb ekle.
- [x] Breadcrumb linklerini gerçek ve taranabilir anchor olarak üret.
- [x] Aynı olayı anlatan haberleri kalıcı `storyKey` cluster altında grupla; kategori fallback'ini koru.
- [x] Konu hub'larını yalnızca mevcut listede en az iki haber taşıyan etiketlerden dinamik oluştur; boş veya thin hub üretme.

## Aşama 6 — Server-side HTML ve teknik SEO

- [x] Mevcut sistemin Vite SPA olduğu ve SEO meta bilgilerinin şu anda client-side eklendiği doğrulandı.
- [x] Next.js'e plansız geçiş yapma; önce mevcut Vite yapısında sürdürülebilir SSR/prerender çözümünü uygula.
- [x] Haber detay ve kategori sayfalarının ilk HTTP cevabında gerçek başlık, özet ve iç linkleri HTML olarak döndürmesini sağla.
- [x] Seçilen çözümü production build üzerinde doğrula: haber route'ları için dinamik server-side render.
- [x] Her habere benzersiz, doğal ve yaklaşık 55-60 karakterlik `<title>` üret.
- [x] Her habere yaklaşık 145-160 karakterlik, kart metninin birebir kopyası olmayan meta description üret.
- [x] Self-referencing canonical ekle.
- [x] Dinamik Open Graph ve Twitter Card alanlarını ilk HTML yanıtında üret.
- [x] `NewsArticle` JSON-LD ekle:
  - `headline`
  - `image`
  - `datePublished`
  - gerçek değişiklik varsa `dateModified`
  - `author`
  - `publisher` ve logo
  - `mainEntityOfPage`
  - `isBasedOn`
- [x] `BreadcrumbList` JSON-LD ekle.
- [x] JSON-LD içeriğini XSS'e karşı güvenli serialize et.
- [x] `/sitemap.xml` dosyasını veritabanındaki yayımlanmış canonical haber ve kategori URL'lerinden dinamik üret.
- [x] Sitemap'i parçalara ayırmaya hazır yapı kur; yalnızca indexlenebilir ve 200 dönen URL'leri ekle.
- [x] `/robots.txt` içinde haber/kategori detaylarını aç; admin, auth ve API route'larını engelle.
- [x] Google Search Console'a sitemap gönderimi için deployment sonrası manuel adım ekle.

## Aşama 7 — Performans ve Core Web Vitals

- [x] Detay hero görselini LCP adayı olarak `fetchpriority="high"` ile yükle; liste görsellerini lazy-load et.
- [x] Görseller için sabit width/height veya aspect-ratio kullanarak CLS'yi önle.
- [x] Uzak görsel domainlerini whitelist et ve bozuk görsel fallback'i koru.
- [x] Görsel proxy/optimizasyon seçimini güvenlik ve telif açısından değerlendir; mevcut Hostinger yapısında proxy açma, kaynak/CDN WebP-AVIF varyantlarına hazır adapter politikası kullan.
- [x] Frontend bundle'daki mevcut 500 kB üzeri uyarıyı route-level code splitting ile azalt.
- [x] Haber detay route'unu lazy-load et.
- [x] Lighthouse mobile testinde Performance, SEO, Accessibility ve Best Practices sonuçlarını kaydet.
- [x] LCP, CLS ve INP regresyon eşikleri belirle.

## Aşama 8 — Analytics ve ölçüm

- [x] Analytics sağlayıcısını ve KVKK/çerez politikasını netleştir.
- [x] `news_summary_view` eventi ekle: haber ID, kaynak, kategori, özet kelime sayısı.
- [x] Özetin gerçekten okunduğunu süre + scroll depth ile ölç; yalnızca sayfa açılışını “okundu” sayma.
- [x] `news_source_click` eventi ekle: haber ID, kaynak, özet okuma süresi ve scroll depth.
- [x] `related_news_click` ve `category_click` eventlerini ekle.
- [x] Hassas veri, API anahtarı, tam URL query parametreleri veya kullanıcı metni analytics'e gönderme.
- [x] Özet uzunluğu ile kaynak tıklama oranını karşılaştıran rapor tanımla.
- [x] İlk 30 gün için kalite KPI'ları belirle: index oranı, ortalama okuma, kaynak CTR, ilgili haber CTR, AI hata oranı.

## Aşama 9 — Admin ve operasyon

- [x] Haber yönetimine AI durumu filtreleri ekle: Bekliyor, İşleniyor, Hazır, İnceleme Gerekli, Hatalı.
- [x] Admin kartında kullanılan sağlayıcı/model, kelime sayısı ve kalite uyarılarını göster.
- [x] Tek haber için “Yeniden özetle” aksiyonu ekle; çift tıklama/idempotency koruması uygula.
- [x] Adminin Türkçe başlık, özet, bağlam ve etiketleri düzenleyebilmesini sağla.
- [x] Manuel düzenlenmiş içeriği otomatik worker'ın ezmesini engelle.
- [x] Kaynak bazında AI açık/kapalı, auto-publish ve minimum inceleme ayarı ekle.
- [x] Groq kotası dolduğunda admin panelinde açık durum mesajı göster.
- [x] Worker sağlık bilgilerini kaydet: son başarılı işlem, bekleyen iş, hata sayısı, 429 sayısı.

## Aşama 10 — Test, güvenlik ve yayın

- [x] Provider adapter için başarılı cevap, 401, 429, timeout ve bozuk JSON testleri yaz.
- [x] Prompt injection içeren RSS excerpt fixture'ı ile güvenlik testi yaz.
- [x] Aynı haberin ikinci kez AI'a gönderilmediğini doğrulayan idempotency testi yaz.
- [x] Benzerlik ve kelime sayısı kalite testleri yaz.
- [x] SEO meta, canonical, NewsArticle ve Breadcrumb JSON-LD testleri yaz.
- [x] Sitemap/robots entegrasyon testleri yaz.
- [x] Haber kartı → detay → kaynak CTA akışını mobil ve desktop E2E test et.
- [x] İlk 20 Groq özetini manuel olarak doğruluk, dil, telif benzerliği ve yatırım tavsiyesi açısından incele.
- [x] Admin/staging için AI işleme, otomatik yayın ve haber sync özellik bayraklarını birbirinden ayır; güvenli varsayılanları uygula.
- [x] Mevcut fallback haberleri dry-run ve açık onay korumalı kontrollü batch ile backfill et.
- [ ] Production açılışından sonra 24 saat worker, hata ve rate-limit gözlemi yap. _(Kod ve runbook hazır; gerçek 24 saatlik pencere deployment sonrasında başlar.)_
- [x] API anahtarını yalnızca yerel/production secret manager'da tut; Git'e eklenmediğini otomatik secret taramasıyla doğrula.

## Kabul kriterleri

- [x] Hiçbir kart doğrudan harici kaynağa gitmiyor.
- [x] Her indexlenebilir veya yeni auto-publish edilen yabancı haberde doğrulanmış Türkçe başlık ve yeterli girdiye orantılı Türkçe özet bulunuyor; inceleme gereken eski sayfalar `noindex` kalıyor.
- [x] Model girdide olmayan kritik bilgi üretirse haber auto-publish edilmiyor.
- [x] Kaynak CTA'sı özetten sonra, ikincil görünümde ve güvenli dış link olarak bulunuyor.
- [x] Detay sayfasının ilk HTTP HTML yanıtında başlık, özet, canonical ve JSON-LD bulunuyor.
- [x] Kategori/etiket/breadcrumb/ilgili haber linkleri taranabilir.
- [x] Sitemap yalnızca yayımlanmış ve editoryal olarak indexlenebilir canonical URL'leri içeriyor.
- [x] Groq kesintisi haber listesini veya mevcut detay sayfalarını bozmaz.
- [x] Mobil görünümde yatay taşma, okunamayan CTA veya belirgin CLS oluşmaz.
- [x] Backend ve frontend typecheck, lint, test ve production build başarılıdır.

## Resmî kaynak notları

- Groq free tier limitleri organizasyon ve modele göre değişir; kesin güncel değer Groq Console Limits ekranından izlenmelidir: https://console.groq.com/docs/rate-limits
- `llama-3.3-70b-versatile` free/developer tier kapanış tarihi 16 Ağustos 2026'dır: https://console.groq.com/docs/deprecations
- **15 Ağustos 2026 geçişi:** Birincil haber yerelleştirme modeli `openai/gpt-oss-20b`, model içi fallback `openai/gpt-oss-120b` olarak güncellendi. GPT-OSS modellerinde Groq strict JSON Schema çıktısı ve düşük reasoning seviyesi kullanılıyor. `qwen/qwen3.6-27b` kapanan model değildir; varsayılan zincir sadeleştirilerek GPT-OSS ailesine taşındı.
- Groq yapılandırılmış JSON çıktıları: https://console.groq.com/docs/structured-outputs
- Google, kullanıcıya ek değer katmadan çok sayıda AI sayfası üretmenin scaled content abuse kapsamına girebileceğini belirtir: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content

## Canlı ilerleme günlüğü

1. **Yapıldı — 6 Ağustos 2026:** Mevcut React/Vite, Express, Prisma, haber route'ları ve client-side SEO yapısı incelendi.
2. **Yapıldı — 6 Ağustos 2026:** Kart → KriptoKeyfi detay sayfası → isteğe bağlı kaynak akışının mevcut olduğu doğrulandı.
3. **Yapıldı — 6 Ağustos 2026:** Groq free tier rate-limit yapısı ve güncel model durumu resmî dokümanlardan doğrulandı.
4. **Yapıldı — 6 Ağustos 2026:** `llama-3.3-70b-versatile` modelinin yaklaşan kapanışı tespit edilerek plana güncel birincil/fallback model yapısı eklendi.
5. **Yapıldı — 6 Ağustos 2026:** Telif, halüsinasyon, thin content ve scaled content risklerine karşı uygulanacak sınırlar belirlendi.
6. **Yapıldı — 6 Ağustos 2026:** Uygulama, test, kabul kriterleri ve yayın adımlarını içeren bu canlı checklist oluşturuldu.
7. **Yapıldı — 6 Ağustos 2026:** Haber yerelleştirme servisi OpenAI bağımlılığından ayrılarak sağlayıcıdan bağımsız hale getirildi.
8. **Yapıldı — 6 Ağustos 2026:** Groq adapter'ı, backend-only API çağrısı ve yapılandırılmış JSON doğrulaması eklendi.
9. **Yapıldı — 6 Ağustos 2026:** Güncel birincil ve fallback modeller env üzerinden yönetilir hale getirildi.
10. **Yapıldı — 6 Ağustos 2026:** Maksimum iki eşzamanlı AI işi ve anahtarsız güvenli çalışma davranışı eklendi.
11. **Yapıldı — 6 Ağustos 2026:** Groq adapter'ının dört testi geçti; backend typecheck ve lint kontrolleri başarılı oldu.
12. **Yapıldı — 6 Ağustos 2026:** Kullanıcının Groq anahtarı backend ortamında güvenli biçimde algılandı; anahtar hiçbir çıktıda gösterilmedi.
13. **Yapıldı — 6 Ağustos 2026:** Qwen 3.6 için non-thinking ve JSON Object modu, GPT-OSS fallback için strict JSON Schema modu ayrı ayrı yapılandırıldı.
14. **Yapıldı — 6 Ağustos 2026:** Groq `Retry-After` desteği ve en fazla iki kontrollü retry eklendi; sağlayıcı test sayısı beşe çıkarıldı.
15. **Yapıldı — 6 Ağustos 2026:** Gerçek Groq bağlantısı `qwen/qwen3.6-27b` ile başarıyla doğrulandı; Türkçe başlık ve özet üretildi.
16. **Yapıldı — 6 Ağustos 2026:** Kısa RSS girdisinin uzun SEO metnine güvenli biçimde dönüştürülemeyeceği canlı örnekle doğrulandı; toplu backfill kalite kapısı tamamlanana kadar durduruldu.
17. **Yapıldı — 6 Ağustos 2026:** Doğrulanmış haber özeti ile özgün “KriptoKeyfi Yorumu / Olası Etkiler” içerikleri veri ve arayüz katmanında birbirinden ayrıldı.
18. **Yapıldı — 6 Ağustos 2026:** AI kalite migration'ı reset kullanmadan uygulandı; mevcut kullanıcı ve trade bot verileri korundu.
19. **Yapıldı — 6 Ağustos 2026:** Güven skoru, inceleme durumu, kelime sayısı ve kalite bayrakları veritabanına eklendi.
20. **Yapıldı — 6 Ağustos 2026:** Kaynak CTA'sı editoryal katkının altına taşındı, outline stile ve güvenli/nofollow dış bağlantıya dönüştürüldü.
21. **Yapıldı — 6 Ağustos 2026:** “Ethereum Foundation's Management and Board Structure” haberi gerçek Groq çağrısıyla işlendi; 28 kelimelik doğrulanmış özet ve toplam 163 kelimelik editoryal katkı kaydedildi.
22. **Yapıldı — 6 Ağustos 2026:** İşlenen haber canlı backend API'sinde %95 güven skoru ve `needsReview=false` ile doğrulandı.
23. **Yapıldı — 6 Ağustos 2026:** Kalite/admin kapısı tamamlanmadan kontrolsüz toplu tüketimi önlemek için otomatik AI batch'i varsayılan olarak kapatıldı.
24. **Yapıldı — 6 Ağustos 2026:** HTML, kontrol karakteri, RSS kalıntısı ve prompt-injection parçalarını temizleyen güvenli girdi katmanı eklendi.
25. **Yapıldı — 6 Ağustos 2026:** Özet, editoryal katkı, etiketler, ilgili coinler, güven skoru ve inceleme durumu Zod ile doğrulanan yapılandırılmış çıktıya bağlandı.
26. **Yapıldı — 6 Ağustos 2026:** Kelime sınırı, 4-gram kaynak benzerliği, beklenmeyen URL/Markdown ve kısa kaynak kalite kontrolleri eklendi.
27. **Yapıldı — 6 Ağustos 2026:** `inputHash + promptVersion` idempotency, en fazla beş deneme ve kesintide mevcut haberi göstermeye devam eden fallback akışı tamamlandı.
28. **Yapıldı — 6 Ağustos 2026:** Mevcut 300 harici haberin tamamı Aşama 2 veri yapısına geçirildi; başarısız kayıt kalmadı.
29. **Yapıldı — 6 Ağustos 2026:** Yeni haberler için otomatik AI işleme açıldı; günlük Qwen kotası dolduğunda beklemeden GPT-OSS fallback modele geçiş eklendi.
30. **Yapıldı — 6 Ağustos 2026:** Backend 44 test, typecheck, lint ve production build; frontend typecheck ve production build kontrollerinden geçti.
31. **Yapıldı — 6 Ağustos 2026:** Yeni harici haberlerin önce `PENDING` editoryal durumuna girdiği yayın kapısı kuruldu.
32. **Yapıldı — 6 Ağustos 2026:** Yabancı kaynak başına ilk 20 manuel onay tamamlanmadan otomatik yayın yapılmaması kalıcı inceleme zamanı alanıyla uygulandı.
33. **Yapıldı — 6 Ağustos 2026:** Haber Yönetimi ekranına bekleyen haber kartları ile “Yayınla” ve “Reddet” kontrolleri eklendi.
34. **Yapıldı — 6 Ağustos 2026:** AI beş kez başarısız olduğunda izinli kaynak excerpt'ini Türkçe fallback alanlarına kaydeden ve manuel incelemeye alan güvenli akış eklendi.
35. **Yapıldı — 6 Ağustos 2026:** Auto-publish; aktif, güvenilir, ticari/özet izni doğrulanmış ve kullanım şartları kontrol edilmiş kaynaklarla sınırlandı.
36. **Yapıldı — 6 Ağustos 2026:** Retention yalnızca korunmayan harici haberlerde son 300 kayda uygulanacak şekilde düzeltildi; öne çıkan, editör seçimi, son dakika, favorilenmiş ve özgün içerikler korundu.
37. **Yapıldı — 6 Ağustos 2026:** Veri resetlenmeden editoryal inceleme migration'ı uygulandı; 2 kullanıcı ve 300 yayımlanmış haberin korunduğu doğrulandı.
38. **Yapıldı — 6 Ağustos 2026:** Backend 46 test, typecheck, lint ve production build; frontend typecheck ve production build kontrollerinden geçti.
39. **Yapıldı — 6 Ağustos 2026:** RSS görsel ayrıştırıcısı kodlanmış HTML, lazy-load ve `srcset` alanlarını destekleyecek şekilde genişletildi; mevcut kayıtlar için güvenli görsel yenileme komutu eklendi.
40. **Yapıldı — 6 Ağustos 2026:** Görseli olmayan veya yüklenemeyen haberlerde uzak kaynağı hotlink etmek yerine yerel KriptoKeyfi kategori görseli kullanılmaya başlandı.
41. **Yapıldı — 6 Ağustos 2026:** Editoryal katkı kart görünümünden çıkarılarak kalın paragraf başlangıçlarıyla doğal okuma akışına dönüştürüldü.
42. **Yapıldı — 6 Ağustos 2026:** Haberi kaydet, paylaş ve haber merkezine dön eylemleri okumanın bittiği alt bölüme taşındı.
43. **Yapıldı — 6 Ağustos 2026:** Backend 47 test, typecheck, lint ve production build; frontend typecheck ve production build kontrollerinden geçti.
44. **Yapıldı — 6 Ağustos 2026:** Detay sayfasına mobilde içerikten sonra gelen sticky desktop sidebar; En Çok Okunan ve Popüler Etiketler blokları eklendi.
45. **Yapıldı — 6 Ağustos 2026:** İlgili haberler yerel fallback destekli görselli dört karta dönüştürüldü; üçüncü taraf favicon hotlink'i kapatıldı.
46. **Yapıldı — 6 Ağustos 2026:** Kategori, etiket ve yoğun konu hub'ları gerçek `/haberler/*` URL'leri ve backend filtreleriyle bağlandı.
47. **Yapıldı — 6 Ağustos 2026:** Detay breadcrumb'ı gerçek anchor bağlantılarıyla eklendi; eski blog/insights yollarına istemci, Vercel ve Netlify kalıcı redirect kuralları tanımlandı.
48. **Yapıldı — 6 Ağustos 2026:** Mevcut 300 haber tarandı; 53 haber story anahtarı aldı ve birden fazla haber içeren 4 olay kümesi oluşturuldu.
49. **Yapıldı — 6 Ağustos 2026:** Backend 49 test, typecheck, lint ve production build; frontend typecheck ve production build kontrollerinden geçti.
50. **Kontrol notu — 6 Ağustos 2026:** Yerel tarayıcı oturumu bu ortamda kullanılamadı; responsive grid, taşma ve CLS önlemleri kod/build seviyesinde doğrulandı, yayın öncesi gerçek cihaz görsel turu korunuyor.
51. **Yapıldı — 6 Ağustos 2026:** Vite production build'ini sunan dinamik SEO render sunucusu eklendi; Next.js geçişi yapılmadan haber detay, kategori, etiket ve konu sayfalarının ilk HTTP yanıtına gerçek içerik yerleştirildi.
52. **Yapıldı — 6 Ağustos 2026:** Haber bazlı title, meta description, self-canonical, Open Graph, Twitter Card, NewsArticle ve BreadcrumbList verileri ilk HTML yanıtında üretildi.
53. **Yapıldı — 6 Ağustos 2026:** JSON-LD XSS güvenli serialize edildi; SEO render isteklerinin haber görüntülenme sayısını artırması engellendi.
54. **Yapıldı — 6 Ağustos 2026:** Dinamik sitemap index, 45.000 URL'lik parçalara hazır haber sitemap'i, yalnızca yoğun/indexlenebilir kategori-konu sitemap'i ve güvenli robots.txt eklendi.
55. **Yapıldı — 6 Ağustos 2026:** Production build üzerinden ham HTTP doğrulamasında detay/kategori/sitemap/robots uçları 200 döndü; H1, özet, iç link, canonical, OG/Twitter ve iki JSON-LD şeması JavaScript çalışmadan görüldü.
56. **Yapıldı — 6 Ağustos 2026:** 20 indexlenebilir canlı kayıtta title benzersizliği ve meta description uzunluğu doğrulandı; backend 49 test, lint, typecheck ve build ile frontend SEO testleri, typecheck ve build başarıyla tamamlandı.
57. **Hazır — deployment sonrası:** Alan adı yayına alındığında `docs/GOOGLE_SEARCH_CONSOLE_SETUP.md` adımlarıyla domain doğrulaması ve sitemap gönderimi yapılacak.
58. **Yapıldı — 6 Ağustos 2026:** Production SEO sunucusuna `/api` reverse proxy eklendi; login/refresh cookie başlıkları, JSON POST gövdeleri ve streaming cevaplar backend'e aktarılırken farklı origin istekleri engellendi. `/api/health` ve auth validation cevabı production modunda doğrulandı.
59. **Yapıldı — 7 Ağustos 2026:** Hero/list görsel öncelikleri, intrinsic ölçüler, HTTPS host whitelist'i ve yerel fallback tamamlandı; güvenlik/telif nedeniyle üçüncü taraf görsel proxy'si açılmadı.
60. **Yapıldı — 7 Ağustos 2026:** Route-level lazy loading ve vendor chunk ayrımıyla ana JavaScript chunk'ı 1.015 kB seviyesinden 268 kB'a indirildi; haber detayı ve ticker ayrı chunk oldu.
61. **Yapıldı — 7 Ağustos 2026:** Güncel production bundle üzerinde mobil Lighthouse sonucu Performance 80, Accessibility 100, Best Practices 100, SEO 100; LCP 4.014 ms, CLS 0,010 ve TBT 39 ms olarak kaydedildi.
62. **Yapıldı — 7 Ağustos 2026:** Varsayılan kapalı, açık kullanıcı onaylı ve yalnızca KriptoKeyfi backend'ine gönderilen KVKK odaklı first-party analytics katmanı eklendi.
63. **Yapıldı — 7 Ağustos 2026:** Doğrulanmış özet okuma, kaynak CTA, ilgili haber, kategori ve LCP/CLS/INP olayları; 30 günlük özet uzunluğu/CTR/KPI raporu tamamlandı.
64. **Yapıldı — 7 Ağustos 2026:** Analytics şeması tam URL, kullanıcı kimliği ve serbest metin gibi alanları strict doğrulamayla reddedecek şekilde test edildi; canlı proxy kontrolünde izinli olay 202, yasak alanlı olay 400 döndü.
65. **Yapıldı — 7 Ağustos 2026:** Haber Yönetimi ekranına AI durum filtreleri, sağlayıcı/model ve kalite bilgileri, manuel editör, yeniden özetleme koruması, kaynak bazlı AI/inceleme ayarları, Groq kota mesajı ve worker sağlık görünümü eklendi.
66. **Yapıldı — 7 Ağustos 2026:** Reset kullanılmadan operasyon/analytics migration'ı uygulandı; 2 kullanıcı, 300 haber ve 8 haber kaynağı korundu. Admin operasyon ve rapor uçları yetkili production proxy isteğinde 200 döndü.
67. **Yapıldı — 7 Ağustos 2026:** Backend 53 test, typecheck, lint, Prisma validate ve production build; frontend 4 SEO testi, typecheck ve production build kontrollerinden geçti.
68. **Yapıldı — 7 Ağustos 2026:** Groq adapter'ına timeout ve bozuk JSON testleri; RSS kaynaklı prompt-injection temizleme testi ve aynı input hash'inin ikinci kez AI'a gönderilmemesi testi eklendi.
69. **Yapıldı — 7 Ağustos 2026:** Özet uzunluğu, yüksek kaynak benzerliği, URL/Markdown kalite kapıları; sitemap/robots gerçek HTTP entegrasyonu test edildi.
70. **Yapıldı — 7 Ağustos 2026:** Production sunucuları ve gerçek Chrome ile desktop/mobile kart → dahili detay → güvenli kaynak CTA akışı geçti; her iki görünümde yatay taşma `0 px`, konsol hatası `0` oldu.
71. **Yapıldı — 7 Ağustos 2026:** İlk 20 Groq kaydı kaynak spotuyla manuel karşılaştırıldı; 8 kayıt geçti, 12 kayıt kısa kaynak/yüksek benzerlik nedeniyle incelemede tutuldu ve toplu onaylanmadı.
72. **Yapıldı — 7 Ağustos 2026:** `NEWS_AI_AUTO_PROCESS`, `NEWS_AI_AUTO_PUBLISH_ENABLED` ve `NEWS_SYNC_ENABLED` birbirinden ayrıldı; otomatik yayın varsayılan kapalı hale getirildi.
73. **Yapıldı — 7 Ağustos 2026:** Dry-run/açık onay/limit/yayımlanmış içerik korumalı backfill aracıyla üç eski fallback kayıt işlendi; ikisi `READY`, kısa kaynaklı biri `REVIEW_REQUIRED` kaldı.
74. **Yapıldı — 7 Ağustos 2026:** `.env.example` içindeki gerçek görünümlü Groq anahtarı kaldırıldı; repository secret taraması geçti. Kullanılmayan kritik açık taşıyan Gemini paketi kaldırıldı; backend production audit'i sıfır açık verdi.
75. **Yapıldı — 7 Ağustos 2026:** Frontend runtime/build bağımlılıkları güncellendi. Kalan React Router RSC advisory'sinin kullanılmayan RSC/action moduna ait olduğu ve zorla downgrade edilmemesi gerektiği güvenlik raporuna kaydedildi.
76. **Yapıldı — 7 Ağustos 2026:** Backend 60 test, typecheck, lint ve build; frontend 5 SEO/entegrasyon testi, typecheck, build ve desktop/mobile E2E kontrollerinden geçti.
77. **Hazır — deployment sonrası:** `NEWS_PRODUCTION_RUNBOOK.md` içindeki komutla 24 saatlik production worker/kaynak/rate-limit gözlemi başlatılacak. Zaman bağımlı bu kontrol canlı deploy öncesinde tamamlanmış sayılamaz.

Sonraki işlem: **Production deployment ve 24 saatlik gözlem penceresi.**
