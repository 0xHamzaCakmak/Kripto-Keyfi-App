# Kriptokeyfi Analytics — Nihai Mimari ve Uygulama Sırası

> Bu doküman, Kriptokeyfi analitik sisteminin nihai kararını ve uygulama sırasını
> içerir. Codex ile yapılan tüm ilgili çalışmalarda referans olarak kullanılabilir.

## 0. Nihai Karar

| Katman | Araç | Rol | Kime gösterilir |
|---|---|---|---|
| **Bağımsız trafik doğrulaması** | Google Analytics 4 | Dışarıya gösterilebilir, tarafsız trafik rakamı | Reklamverenler, ortaklar |
| **Native ziyaretçi/oturum analitiği** | Umami (self-hosted) | Admin panelin İÇİNDE gösterilecek gerçek zamanlı ziyaretçi/sayfa/kaynak/cihaz verisi | Sadece admin |
| **İş metrikleri** | Kriptokeyfi MySQL (`analytics_events`) | Platforma özgü event'ler (video izleme, cüzdan bağlama, creator başvurusu vb.) | Sadece admin |
| **PostHog** | — | **Şimdilik eklenmiyor.** Session replay veya gelişmiş funnel keşfi gerçekten gerekirse ileride ayrı bir faz olarak eklenir | — |

**PostHog neden şimdi değil:** Asıl farkı (session replay, gelişmiş funnel/retention
UI) büyük ölçüde madde 13'teki kendi DB tabanlı funnel yapısıyla karşılanıyor.
Üçüncü bir çerezli/kişisel veri toplayan aracı MVP'ye eklemek hem KVKK yükünü hem
tracking script sayısını gereksiz artırır. İleride gerçekten "kullanıcı ekranda
tam olarak ne yapıyor" seviyesinde bir ihtiyaç doğarsa (örn. bir akışta çok
kullanıcı kayboluyor ama neden anlaşılamıyorsa) o zaman eklenir.

**Neden GA4'ü admin panele API ile gömmüyoruz (şimdilik):** GA4 Data API, Google
Cloud service account kurulumu ve kota yönetimi gerektiriyor — bu karmaşıklığı
MVP'ye taşımıyoruz. GA4 kendi arayüzünden (analytics.google.com) izlenir, admin
panelde sadece oraya giden bir link/buton olur. İleride gerçek ihtiyaç doğarsa
ayrı bir faz olarak eklenir.

---

## 1. Mimari Diyagram

```text
Kriptokeyfi Ziyaretçisi
        │
        ▼
     React Frontend
    ┌────┴────┐
    ▼         ▼
  Umami      GA4
  Tracker    gtag.js
    │          │
    ▼          ▼
Umami API   (Google'ın kendi
    │        sunucuları — bizim
    │        altyapımızda değil)
    ▼
Umami PostgreSQL
(analytics.kriptokeyfi.com,
 ayrı VPS servisi)
    │
    ▼
Kriptokeyfi Backend  ◄── SADECE backend Umami API credential'larını bilir,
    │                    frontend asla doğrudan Umami'ye admin isteği atmaz
    ▼
Admin → Analytics (React admin panel)


Ayrıca, paralel olarak:

Kriptokeyfi kullanıcı aksiyonları (kayıt, cüzdan bağlama, video izleme vb.)
        │
        ▼
Kriptokeyfi Backend → analytics_events tablosu (MySQL, ana veritabanında)
        │
        ▼
Admin → Analytics (aynı ekranda Umami verisiyle birleştirilir)
```

**Kritik mimari kural:** Umami admin kimlik bilgileri (kullanıcı adı/şifre veya
API token) **asla frontend'e gönderilmez**. Frontend her zaman Kriptokeyfi'nin
kendi backend'ine istek atar, backend Umami API'sini arka planda çağırıp
sonucu döndürür. `analytics.kriptokeyfi.com` (Umami'nin kendi paneli) sadece
admin'in (senin) doğrudan erişebileceği, ayrı ve bağımsız bir yönetim arayüzü
olarak kalır — normal kullanıcılar ve hatta Kriptokeyfi admin panelindeki diğer
roller buraya erişemez.

---

## 2. Uygulama Sırası (Checklist)

### Aşama A — Kurulum

- [ ] **A1. GA4 hesabı oluştur** — Kriptokeyfi için ayrı bir GA4 Property,
  `kriptokeyfi.com` için Web Data Stream, Measurement ID (`G-XXXXXXXX`) al.
- [ ] **A2. GA4 tag'ini frontend'e ekle** — sadece public sayfalarda, admin
  panelde değil. Gerçek zamanlı raporda kendi ziyaretini test et.
- [ ] **A3. Umami'yi ayrı bir servis olarak VPS'e kur** — Kriptokeyfi backend/
  frontend'inden bağımsız, kendi PostgreSQL veritabanıyla,
  `analytics.kriptokeyfi.com` subdomain'inde. Docker ile kurulabilir.
- [ ] **A4. Umami'ye kriptokeyfi.com sitesini ekle** — Umami panelinden
  Websites → Add website, oluşan `websiteId`'yi not al.
- [ ] **A5. Umami tracking script'ini frontend'e ekle** — sadece public
  sayfalarda.
- [ ] **A6. GA4 + Umami'nin birlikte çalıştığını test et** — siteyi gez
  (Ana Sayfa → Coin → Haberler → Videolar), her iki panelin de (GA4 Realtime,
  Umami Realtime) ziyaretleri gösterdiğini doğrula. **Bu adım tamamlanmadan
  Admin Analytics geliştirmesine geçme.**

### Aşama B — Kriptokeyfi'ye Özgü Event'ler

- [ ] **B1. Event listesini sabitle** (isimlendirme standardı: snake_case):
  `user_register`, `user_login`, `wallet_connect`, `coin_view`, `news_open`,
  `video_open`, `youtube_connect`, `creator_application`, `airdrop_view`,
  `article_read`
- [ ] **B2. Bu event'leri Umami tracker üzerinden de gönder** (`umami.track()`)
  — Umami self-hosted sürümü custom event'leri destekliyor, bu ücretli/Cloud'a
  özel bir özellik değil.
- [ ] **B3. Aynı event'leri Kriptokeyfi backend'inde `analytics_events`
  tablosuna da yaz** (aşağıdaki şema) — Umami'nin dışında, tamamen kendi
  kontrolünde olan bir kopya. İki kaydın birbirinden bağımsız olması, Umami
  erişimini kaybetsen bile kendi verinin durmasını sağlar.

```sql
CREATE TABLE analytics_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_name VARCHAR(100) NOT NULL,
  user_id INT NULL,
  session_id VARCHAR(64) NULL,
  page_path VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_date (event_name, created_at),
  INDEX idx_user (user_id)
);
```

### Aşama C — Admin Panel Analytics Modülü

- [ ] **C1. Sidebar'a "Analytics" modülünü ekle** — daha önce kurduğumuz
  modüler yapı desenine uygun (tek sidebar satırı, kendi içinde tab'lar).
- [ ] **C2. Backend'de Umami proxy servisi oluştur**
  (`services/umamiApi.js`) — Umami API'sine login olup token alan, sonucu
  kısa süreli cache'leyen bir katman. Frontend bu servise değil, Kriptokeyfi
  backend'ine istek atar.
- [ ] **C3. Genel Bakış (KPI kartları)**: Bugünkü Ziyaretçi, Son 7 Gün, Son
  30 Gün, Sayfa Görüntüleme, Oturum, Kayıtlı Kullanıcı (son ikisi hariç hepsi
  Umami'den, "Kayıtlı Kullanıcı" Kriptokeyfi MySQL'den — bu ayrımı koru).
- [ ] **C4. Trafik grafikleri** — tarih seçici (Bugün/7 Gün/30 Gün/90 Gün/
  Özel), Günlük Tekil Ziyaretçi ve Günlük Page View grafikleri (Umami'den).
- [ ] **C5. En çok ziyaret edilen sayfalar tablosu** (Umami'den).
- [ ] **C6. Trafik kaynakları** (Direct/Google/X/YouTube/LinkedIn/Diğer —
  Umami'den).
- [ ] **C7. Cihaz ve ülke istatistikleri** (Desktop/Mobile/Tablet,
  tarayıcı, ülke — Umami'den, anonim/toplu veri olarak, kimlik çıkarma amaçlı
  kullanma).
- [ ] **C8. Kayıt/kullanıcı verisini Kriptokeyfi DB'den ayrı çek** — Toplam
  kullanıcı, bugün kayıt olan, son 30 gün kayıt (kendi `users` tablonuzdan,
  Umami'ye karıştırma).
- [ ] **C9. İki veriyi birleştirip conversion hesapla** — Umami ziyaretçi
  sayısı ÷ Kriptokeyfi kayıt sayısı = gerçek dönüşüm oranı.
- [ ] **C10. Kullanıcı edinme funnel'ı** — `analytics_events` tablosundaki
  event'lerden (`user_register`, `wallet_connect` vb.) ardışık benzersiz
  kullanıcı sayılarını hesaplayan basit bir funnel görünümü. (Umami OSS'nin
  kendi arayüzünde gelişmiş funnel/retention raporu YOK — bu yüzden funnel'ı
  kendi DB'imizden kuruyoruz, bu tasarım bilinçli.)
- [ ] **C11. İçerik Analytics** — en çok görüntülenen haber/coin/video/
  creator/makale (`analytics_events`'teki `coin_view`, `news_open`,
  `video_open`, `article_read` event'lerinden `metadata` alanındaki
  içerik ID'sine göre gruplanarak).
- [ ] **C12. Creator Analytics (ileride)** — YouTuber/creator sistemi
  büyüdükçe her creator için video görüntülenme, profil ziyareti, tıklama
  sayıları — bu veri ileride KOL/itibar puanı sistemine de girdi olabilir.

### Aşama D — Güvenlik ve Ayrım

- [ ] **D1. Umami admin hesabını Kriptokeyfi admin hesabından ayrı tut** —
  `analytics.kriptokeyfi.com` bağımsız bir yönetim paneli olarak kalsın,
  normal kullanıcılar ve Kriptokeyfi admin panelindeki diğer roller buraya
  erişmesin.
- [ ] **D2. Çerez onayı** — GA4 çerez kullanıyor, siteye bir çerez onay
  banner'ı eklenmesi gerekiyor (KVKK/GDPR). Umami çerezsiz çalıştığı için bu
  yükümlülüğe dahil değil. Bu ayrı bir iş olarak planlanmalı.

---

## Codex'e Verilecek Prompt

```text
Kriptokeyfi'ye GA4 + Umami (self-hosted) + kendi MySQL analytics_events
tablosundan oluşan üç katmanlı bir analitik sistemi kuracaksın. Admin panelde
bunları birleştiren bir "Analytics" modülü oluşturacaksın. 4 faz halinde
ilerle, HER FAZI AYRI COMMIT yap, her fazdan sonra durup özet ver, onay
almadan sonraki faza geçme.

[PROJE YAPISI BURAYA — doldurulacak]
- Sunucu/hosting ortamı (Umami'yi ayrı bir VPS servisi olarak Docker ile
  çalıştırabiliyor muyuz, subdomain DNS ayarı kimin elinde):
- Frontend'in ana layout dosya yolu (tracking scriptleri buraya eklenecek,
  admin panel route'larına EKLENMEYECEK):
- Admin panel modül yapısı (yeni "Analytics" sidebar kartının route'u):
- users tablosunun gerçek şeması (kayıt sayıları buradan çekilecek):
- Kayıt olma / cüzdan bağlama / video izleme / creator başvurusu gibi
  akışların kod içindeki dosya yolları (event çağrıları buraya eklenecek):
- .env dosyasının konumu

═══════════════════════════════════════════════════════════════
FAZ 1: GA4 + UMAMI KURULUMU VE TEST
═══════════════════════════════════════════════════════════════
- GA4 Measurement ID'yi .env'e ekle (GA4_MEASUREMENT_ID), gtag.js script'ini
  ana layout'a SADECE public sayfalarda ekle.
- Umami'yi Docker Compose ile ayrı bir servis olarak kur (resmi Umami image'ı,
  umami-software/umami), kendi PostgreSQL veritabanıyla. Ana Kriptokeyfi
  altyapısından bağımsız tut — migration'larını kendi yönetir.
- Umami website ID'sini ve script URL'ini .env'e ekle (UMAMI_WEBSITE_ID,
  UMAMI_SCRIPT_URL), tracking script'i ana layout'a SADECE public sayfalarda
  ekle.
- Her iki script de async/defer yüklensin, sayfa hızını etkilemesin.

TESLİM KRİTERİ: Public sayfalarda gezinti hem GA4 Realtime hem Umami Realtime'da
görünüyor, admin panel sayfaları hiçbirinde sayılmıyor.

═══════════════════════════════════════════════════════════════
FAZ 2: KENDİ EVENT SİSTEMİ (analytics_events)
═══════════════════════════════════════════════════════════════
- Migration: analytics_events tablosunu oluştur (yukarıdaki şema).
- Backend'de services/analyticsEvents.js oluştur:
  trackEvent(eventName, { userId, sessionId, pagePath, metadata }) →
  analytics_events'e INSERT eder. Bu fonksiyon HATA FIRLATMASIN (try/catch),
  başarısız olursa ana işlemi (kayıt, cüzdan bağlama vb.) ASLA engellemesin.
- Şu event'leri hem Umami tracker'a (umami.track()) hem backend'deki
  trackEvent()'e bağla (kayıt/cüzdan bağlama gibi akışların GERÇEKLEŞTİĞİ
  backend endpoint'lerinin İÇİNE ekle, frontend'den sadece UI etkileşimi
  event'lerini — video_open, news_open gibi — gönder):
  user_register, user_login, wallet_connect, coin_view, news_open, video_open,
  youtube_connect, creator_application, airdrop_view, article_read
- metadata alanına ilgili içerik ID'sini yaz (örn. video_open için
  { video_id: 123 }) — Faz 4'teki İçerik Analytics bunu kullanacak.

TESLİM KRİTERİ: Yukarıdaki event'ler tetiklendiğinde hem Umami'de hem
analytics_events tablosunda kayıt görünüyor.

═══════════════════════════════════════════════════════════════
FAZ 3: ADMİN PANEL — ANALYTICS MODÜLÜ (Genel Bakış + Trafik)
═══════════════════════════════════════════════════════════════
- services/umamiApi.js oluştur: Umami API'sine login olup token alan (token'ı
  cache'leyen, süresi dolunca yenileyen), aşağıdaki fonksiyonları sağlayan bir
  katman:
  - getVisitorStats(startDate, endDate) → ziyaretçi, sayfa görüntüleme, oturum
  - getTopPages(startDate, endDate)
  - getReferrers(startDate, endDate)
  - getDeviceAndCountryBreakdown(startDate, endDate)
- Endpoint: GET /admin/api/analytics/overview?range=today|7d|30d|90d
  - Umami verisini + Kriptokeyfi users tablosundan kayıt sayılarını
    BİRLEŞTİRİP döndürür (ziyaretçi, page view, oturum, kayıtlı kullanıcı,
    bugün/30 gün kayıt, conversion oranı = kayıt / ziyaretçi)
- Endpoint: GET /admin/api/analytics/top-pages, /referrers, /devices
  (Umami verisini olduğu gibi proxy'ler)
- Admin panelde Analytics modülünü aktif et (sidebar'a ekle):
  - Genel Bakış tab: KPI kartları (Bugünkü Ziyaretçi, 7 Gün, 30 Gün, Sayfa
    Görüntüleme, Oturum, Kayıtlı Kullanıcı) + tarih seçici + günlük ziyaretçi/
    page view çizgi grafiği
  - Sayfalar tab: en çok ziyaret edilen sayfalar tablosu
  - Kaynaklar tab: trafik kaynakları
  - Cihazlar tab: cihaz/tarayıcı/ülke dağılımı
  - GA4'e giden bir dış link/buton ("GA4 Dashboard'unu Aç") — tam API
    entegrasyonu bu fazda YAPILMIYOR

TESLİM KRİTERİ: Admin panelde gerçek Umami + Kriptokeyfi verisiyle beslenen
bir Analytics Genel Bakış ekranı var, tarih aralığı değiştirilebiliyor.

═══════════════════════════════════════════════════════════════
FAZ 4: FUNNEL + İÇERİK ANALİTİĞİ (kendi DB'den)
═══════════════════════════════════════════════════════════════
- Endpoint: GET /admin/api/analytics/funnel?steps=user_register,wallet_connect
  - analytics_events tablosundan her adımı gerçekleştiren BENZERSİZ user_id
    sayısını sırayla hesaplar (adım 1'i yapanların kaçı adım 2'yi de yaptı) —
    basit ardışık COUNT DISTINCT sorgusu yeterli, karmaşık bir funnel motoru
    yazma.
- Endpoint: GET /admin/api/analytics/content?event_name=video_open&range=30d
  - metadata->>'video_id' (veya ilgili alan) bazında GROUP BY yapıp en çok
    görüntülenen içerikleri sayısıyla birlikte döndürür. video_open, news_open,
    coin_view, article_read için ayrı ayrı çalışabilmeli (event_name parametreli).
- Admin panelde Analytics modülüne iki yeni tab:
  - "Funnel" tab: adım seçimi (checkbox/sıralı liste) + huni görünümü (her
    adımda kaç kullanıcı kaldığı, projede zaten kullanılan chart kütüphanesiyle)
  - "İçerikler" tab: en çok görüntülenen haber/coin/video/makale listeleri
    (her biri ayrı bir alt bölüm/tablo)

TESLİM KRİTERİ: Admin panelde kayıt→cüzdan bağlama gibi bir funnel görülebiliyor,
en çok izlenen video/en çok okunan haber gibi içerik metrikleri listeleniyor.

═══════════════════════════════════════════════════════════════
GENEL KURALLAR
═══════════════════════════════════════════════════════════════
- Umami API credential'ları (kullanıcı adı/şifre veya token) SADECE backend'de
  tutulur, .env'den okunur, frontend'e asla gönderilmez.
- trackEvent() çağrıları ana iş akışını (kayıt, ödeme, bağlama) asla
  bloklamasın veya hataya düşürmesin.
- Umami'nin kendi veritabanı/migration sistemi ana Kriptokeyfi migration
  sistemine karıştırılmaz.
- GA4/Umami tracking script'leri admin panel route'larına eklenmez.
- Tüm SQL sorguları parametreli olsun (SQL injection önleme).
- Migration dosyalarını projenin mevcut migration sistemine uygun oluştur.
```

---

## İleride Eklenebilecek (Bu MVP'nin Kapsamı Dışında)

- **PostHog**: session replay veya gelişmiş funnel/retention keşfi gerçekten
  ihtiyaç haline gelirse ayrı bir faz olarak eklenir.
- **GA4 Data API entegrasyonu**: GA4 verisini de admin panele native gömmek
  istenirse (Google Cloud service account + kota yönetimi gerektirir).
- **Creator Analytics**: YouTuber puanlama sistemiyle (daha önce tasarladığımız
  KOL Intelligence) birleştirilebilir — bir creator'ın Kriptokeyfi üzerinden
  aldığı gerçek trafiği itibar skoruna girdi olarak eklemek.
- **Çerez onay banner'ı**: GA4 için KVKK/GDPR uyumluluğu amacıyla ayrı bir
  proje olarak ele alınmalı.
