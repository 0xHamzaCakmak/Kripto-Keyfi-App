# AI Trading Pro — demo geçiş checklist'i

Son kod kontrolü: 9 Eylül 2026. Hedef ekran: `/admin/trading/ai-pro`.

Bu liste **yeni AI Trading Pro** ekranını değerlendirir. Eski `/admin/trading/ai/*` ekranında bir özelliğin çalışması, Pro'ya taşındığı anlamına gelmez. “Bağlı” kodda gerçek API kullanıldığı anlamına gelir; sunucuda gerçek demo hesabıyla doğrulama ayrıca yapılmalıdır.

## Kapsam ve kurallar

- Manuel İşlem ekranı gerçek tekli ve toplu emir akışlarına bağlandı. Toplu işlem botlardan bağımsızdır; tanımlı işlem evrenindeki varsayılan coinler seçilebilir, önizleme gerçek mark fiyatından miktar ve TP/SL seviyelerini üretir. Onayda 20 giriş emri aynı anda başlatılır; tüm giriş denemeleri bittikten sonra TP/SL emirleri eklenir. Binance USD-M tek `batchOrders` isteğinde en fazla 5 emir kabul ettiği için bu akış Go Trading Engine'in emir başına risk, denetim kaydı ve idempotency kontrollerini koruyan paralel istekler kullanır.

- [x] Pro'nun ortak hesap seçimi yalnızca aktif TESTNET/DEMO hesaplarını kullanır; LIVE geçişi şu aşamada kapalıdır.
- [x] Hesap seçimi Trading Bot başlığının yanında, tüm sekmelerden erişilebilir. Seçili hesabın adı ve ortamı gösterilir; ayrı alt satır ve “Borsa hesaplarını yönet” kısayolu kaldırıldı.
- [x] Pozisyon kaynağı borsadır. Bot emri, bot kaydı veya uygulamada emir geçmişi bulunması listeleme şartı değildir.
- [x] Bot operasyonları, seçili hesabın DEMO botlarına göre süzülür; başka hesabın aynı paritesine ait TP/SL ve işlem verileri karışmaz.
- [ ] Henüz bağlanmayan ekranların kendi örnek hesap/veri kaynakları ortak demo hesabına geçirilecek.
- [ ] LIVE ayrı bir çalışma olarak ele alınacak; açılmadan önce şifreli yetkilendirme ve tüm işlemlerde hesap/ortam ayrımı tamamlanacak. Şu checklist demo tamamlanmasına odaklanır.

## Bölüm durumu

| Sıra | Bölüm | Pro'daki durum | Eksik / sonraki iş | Eski bölüm |
| --- | --- | --- | --- | --- |
| 1 | Borsa hesapları | **Bağlı** | Gerçek demo hesabıyla ekleme, doğrulama, anahtar yenileme, silme ve hata senaryolarının kabul kontrolü | Eski ekran/menü kaldırıldı; eski adres Pro'ya yönleniyor |
| 2 | Pozisyonlar | **Bağlı** | Market/limit/kısmi kapatma, merkezi işlem ayarları, seçili Binance TESTNET hesap özeti ve SSE yenileme taşındı. Gerçek demo oturumu kabul kontrolü bekliyor | Eski ekran/menü kaldırıldı; eski adres Pro’ya yönleniyor |
| 3 | Bot Arena | **Kısmen bağlı** | Gerçek bot listesi, skor, TESTNET operasyonları, dinamik durum/strateji/nesil filtreleri ve hesap bazlı otomatik işlem durdur/devam et bağlı. Bot detayları, rejim filtresi, bot bazlı sermaye ve aktivasyon akışları sırada | Eski Arena detay işlevleri tamamlanana kadar mevcut |
| 4 | Ana ekran / karar akışı | **Kısmen bağlı** | Bakiye, arena-status, karar akışı, pozisyonlar ve bazı özet kartları API kullanıyor. Üst otomatik işlem kontrolü gerçek hesap profiline bağlı; rastgele sinyal tetikleme kaldırıldı | Eski genel bakış mevcut |
| 5 | Botlarım | **Gerçek liste ve bot kontrolü bağlı** | Seçili hesabın arşivlenmemiş DEMO botları, gerçek motor/hedef/lifecycle durumları ve bot bazlı başlat/duraklat/devam et bağlı. Hesap parametreleri Risk'e gider. Örnek PnL, başarı oranı ve çalışmayan oluşturma düğmesi kaldırıldı; yeni bot oluşturma/strateji düzenleme akışı ayrıca taşınacak | Eski bot yönetimi bu kalan işlevler için mevcut |
| 6 | Emirler | **Bağlı** | Seçili hesabın açık borsa emirleri, 10 saniyelik/SSE yenileme, tekli/toplu iptal bağlı. Hesap değişiminde eski yanıtlar kullanılmaz; okuma hatasında iptal kapatılır. Gerçek demo oturumu kabul kontrolü bekliyor | Eski ekran/menü kaldırıldı; eski adres Pro Emirler sekmesine yönleniyor |
| 7 | Manuel işlem | **Bağlı** | Gerçek semboller, tek emir önizleme/gönderme; botlardan bağımsız toplu manuel emir önizleme/onay/sonuç ve borsa TP/SL akışı | Eski manuel işlem ekranı karşılaştırma için mevcut |
| 8 | Risk yönetimi | **Bağlı; demo kabul kontrolü bekliyor** | Pozisyonlar'daki işlem ayarları buraya taşındı. Ortak seçili hesabın işlem/SL/TP ayarları ve ayrıntılı risk profili sunucudan okunup kaydedilir; hesap/global kill switch ve son risk olayları bağlı. Örnek hesaplar, localStorage kaydı ve sahte senkronizasyon/telemetri kaldırıldı | Eski risk ekranlarının kapsam karşılaştırması ve kabul kontrolü bekliyor |
| 9 | Trade Memory | **Örnek veri** | TESTNET işlem hafızası, filtreler, istatistikler ve işlem detayları | Eski Memory backend'e bağlı ve mevcut |
| 10 | Performans | **Örnek veri** | Detaylı performans sekmesini gerçek TESTNET işlemlerine bağlama. Ana ekrandaki küçük performans kartı ayrı; fills/veri kapsamı doğrulanmalı | Eski performans ekranı mevcut |
| 11 | Kâr/Zarar analizi | **Örnek veri** | Gerçekleşen/gerçekleşmemiş PnL, komisyon, funding, dönem ve hesap ayrımı | Eski kâr/zarar ekranı mevcut |
| 12 | Şampiyonlar | **Gerçek veriye bağlı** | Seçili hesabın arşivlenmemiş tüm DEMO botları; son kayıtlı performans skoru, işlem sayısı, ROI, kazanma, risk ölçümleri ve ölçüm tarihi. Üstte ilk üç, tabloda tüm botlar; 30 saniyede yenileme | Ölçümler tüm kayıtlı döneme aittir; 30 günlük getiri değildir. Yetersiz veriye puan üretilmez; eşit skorlar aynı sırayı paylaşır. Değerlendirme/terfi aksiyonları eklenmedi |
| 13 | Grid Bot | **Örnek veri** | Demo hesapla listeleme, oluşturma, detay ve durum aksiyonları | Eski Grid ekranı mevcut |
| 14 | Sistem durumu | **Örnek veri** | Backend/Go engine sağlığı, hata ve gecikme metrikleri, bot heartbeat ve olaylar | Eski sistem durumu mevcut |
| 15 | Bot rehberi | **Birleştirildi ve güncellendi** | Klasik Scalping/Grid rehberi ile AI bot aileleri, modlar, ortak hesap kontrolü, Risk, karar sözlüğü ve sorun giderme tek Pro rehberinde. Arama ve içindekiler eklendi; tanımlı aile ile çalışan bot ayrımı açıklandı | Eski ekran/menü kaldırıldı; iki eski rehber adresi Pro Bot Rehberi'ne yönleniyor |
| 16 | Ayarlar / entegrasyon penceresi | **Örnek entegrasyon anlatımı** | Örnek token/WebSocket/snippet ve kaydetme davranışını gerçek ürün ayarlarından ayırma veya uygun backend'e bağlama | Yeni Pro içindeki pencere |
| Sonraki faz | Live hazırlık / Demo-Live ayrımı | **Örnek görünüm; tamamlanmadı** | Demo tamamlandıktan sonra ayrı kapsam, hesap ayrımı ve gerçek yetkilendirme akışı | Eski Shadow/Live hazırlık ekranı mevcut |

## Bu adımda tamamlanan pozisyon düzeltmeleri

- [x] `/admin/trading/positions?exchangeAccountId=...` isteği bot/performans/risk isteklerinden bağımsız çalışır.
- [x] 10 saniyelik yenileme ve manuel Yenile düğmesi vardır; aynı okuma döngüsünde istekler üst üste binmez.
- [x] Hesap değiştirilince önceki hesabın pozisyonları hemen gizlenir; eski hesabın geç gelen yanıtı yeni hesabı ezmez.
- [x] Okuma hatası “pozisyon yok” olarak gösterilmez. Son başarılı veri varsa güncel olmayabileceği belirtilir.
- [x] Ana ekran ve Pozisyonlar sekmesi aynı borsa verisini kullanır; üst menü sayacı da gerçek listeye bağlıdır.
- [x] LONG ve SHORT hedge pozisyonları ayrı positionKey ile korunur; bot kaydı olmayan pozisyonlar listelenir.
- [x] Okuma hatası veya ilk yükleme sırasında kapatma düğmeleri devre dışıdır.
- [x] Kapatma isteğinin kabulü “pozisyon kapandı” olarak sunulmaz; borsa listesi yeniden okunur.
- [x] Pozisyon listeleme/hesap ayrımı/hata görünümü/market kapatma sözleşmesi için otomatik regresyon testleri eklendi.
- [ ] Demo borsada uygulama dışından açılan pozisyonun gerçek oturumda görünmesi doğrulanacak.
- [x] Limit/kısmi kapatma, execution ayarları, seçili hesaba ait bakiye/teminat/PnL özeti ve SSE yenileme taşındı. Varsayılan 10.000 USD başlangıca dayalı tahmini toplam kâr yerine gerçek bakiye/teminat/açık PnL gösteriliyor.
- [x] Eski Pozisyonlar ekranı ve menüsü kaldırıldı; eski adres Pro Pozisyonlar sekmesine yönleniyor.

## Risk ayarlarını tek yerde toplama

Risk düzenlemesi: Pozisyonlar ekranında hesap özeti, açık pozisyonlar ve kapatma işlemleri kaldı. Teminat, kaldıraç, SL/TP ve emir limitleri yalnızca Risk ekranında düzenlenir; parite/pozisyon limitleri, korunacak bakiye, kayıp oranları, marjin politikası ve parite izinleri de buradadır. Global acil durdurma tüm hesapları etkilediğinden kapsamı açıkça gösterilir; hesap acil durdurması ortak seçili hesabı kullanır. Bu adımda gerçek borsa üzerinde emir veya kill-switch işlemi yapılmadı.

Doğrulama: 15 frontend regresyon testi, TypeScript kontrolü ve üretim derlemesi başarılı. Yeni testler Risk/Pozisyonlar ayrımını, seçili hesaba kayıt, sayısal/parite doğrulaması ve global/hesap kill-switch istek kapsamını sahte API ile kontrol eder. VPS deploy ve gerçek oturum kabul kontrolü yapılmadı.

## Arena için sıradaki çalışma

Arena listesi artık backend verisini kullanıyor; sabit 20 bot ve rastgele PnL yenilemesi kaldırıldı. Bot sayısı seçili hesaptan geliyor. Detay ve bazı yönetim işlevleri henüz tamamlanmadı; eski Arena bu nedenle korunuyor.

- [x] `/bot-factory/bots` listesi ortak seçili demo hesabına göre süzülüyor; PAPER ve ARCHIVED botlar dışarıda.
- [x] Skor ve TESTNET operasyonları bot ID ile eşleşiyor; eksik skor/PnL/ROI/işlem sayısı “—” gösteriliyor. Profit factor hesaplaması ve ayrıntılı fill geçmişi henüz taşınmadı.
- [x] TESTNET operasyon ve hesap özeti API’leri exchangeAccountId kabul ediyor. Veritabanı sorgusu, cache ve bot detay hesabı kullanıcı/hesap bazında ayrıldı. Bu operasyon servisi Binance TESTNET içindir; Bybit operasyon desteği ayrıca tamamlanmalı.
- [ ] Filtre/sıralamayı gerçek lifecycle, strateji, nesil ve rejim değerlerine bağla.
- [ ] Eski Arena'nın detay, sermaye/işlem ayarı, otomatik execution durdur/devam et ve TESTNET aktivasyon akışlarını yeni tasarıma taşı.
- [x] Üst menüdeki yerel bot kontrolü ortak risk-profile entryPaused API'sine bağlandı. Rastgele “Sinyal Tetikle” kaldırıldı. Durum ve demo bot sayısı backend'den okunur; hata/yükleme sırasında kontrol kapalıdır. Risk/Arena kayıtları diğer kontrolleri yeniler.
- [ ] Gerçek demo hesabıyla kontrol et; sonra eski Arena ekranı/menüsünü kaldır ve eski adresi yönlendir.

## Her bölüm için tamamlanma ölçütü

Botlarım/üst kontrol adımı: 17 frontend regresyon testi ve üretim derlemesi başarılı. Üst düğme `/exchange-accounts/:id/risk-profile` üzerinden yalnızca `entryPaused` değişikliğini gönderir. Backend'deki mevcut kapsam, seçili hesaptaki arşivlenmemiş PAPER/DEMO AUTONOMOUS botlarıdır; tek bot başlat/duraklat ayrı bot ID endpoint'ini kullanır. Gerçek borsaya emir veya kontrol isteği gönderilmedi; VPS deploy yapılmadı.

1. Örnek veriler kaldırılmış, gerçek backend okuma/yazma bağlantıları tamamlanmış olmalı.
2. Seçili demo hesabı, boş veri, yükleme, hata, yenileme ve hesap değiştirme davranışı doğru olmalı.
3. Sunucunun henüz tamamlamadığı işlem arayüzde başarılı/tamamlanmış gösterilmemeli.
4. Eski bölümün gerekli işlevleri yeni tasarımda karşılanmalı; ardından eski arayüz kaldırılmalı ve eski bağlantılar yönlendirilmeli.
5. İlgili regresyon testleri, TypeScript ve build geçmeli; gerçek demo oturumuyla kabul kontrolü ayrıca kaydedilmeli.

## Doğrulama

```bash
npm --prefix frontend run test:ai-trading-pro
npm --prefix frontend run lint
npm --prefix frontend run build
```

Pozisyon regresyon testleri sahte API yanıtları ve React HTML çıktısıyla çalışır; gerçek borsaya emir göndermez. Bu oturumda tarayıcı/gerçek demo hesabı üzerinden uçtan uca doğrulama ve deploy yapılmadı.

9 Eylül ikinci adım: 9 frontend ve 7 backend regresyon testi başarılı. Pozisyon ve Arena bağlantıları için frontend/backend tür ve derleme kontrolleri uygulanır. Gerçek demo borsasına test emri gönderilmedi.

9 Eylül hesap seçimi/emirler adımı: 11 frontend regresyon testi, TypeScript (`lint`) ve üretim derlemesi başarılı. Emir okuma/iptal isteklerinin seçili hesap kimliğini taşıması ve geçiş durumundaki emirlerin tekrar iptale kapalı olması test edildi. Gerçek demo borsasında ve tarayıcıda kabul testi/deploy yapılmadı.

Kod izleri: `frontend/src/features/ai-trading-pro/App.tsx`, `src/components/Dashboard/*`, `src/services/backendDashboard.ts`, `src/services/useTradeProPositions.ts`; kalan eski AI ekranları `frontend/src/components/ai-trading/*`. Eski `TradingActivity.tsx` kaldırıldı. Borsa pozisyon kaynağı: `backend/src/modules/trading/manual-trading.service.ts` içindeki `listPositions`.
