# Bot kâr/zarar takvimi

> Bu belgenin bot-özel kaynak kapsamı 15 Eylül 2026 itibarıyla değişti. Güncel manuel/toplu/bot kapsamı ve geçmiş aktarımı: [Kripto Keyfi işlem kâr/zararı](PLATFORM_PNL_TR.md). Aşağıdaki kaynak açıklamaları önceki uygulamayı anlatır.

Mevcut koyu kart yapısı korunur. Varsayılan görünüm Türkiye saatine göre içinde bulunulan aydır. Pazartesi–pazar yedi sütun, ayın yerleşimine göre 4–6 hafta gösterilir. Komşu ay ve seçili tarih aralığının dışındaki günler soluktur. Ay seçimi ve en fazla 366 günlük özel tarih aralığı desteklenir; çok aylı aralıklar ayrı takvimler halinde listelenir.

Üst menüde seçili API hesabı bütün okuma ve sıfırlama isteklerinde gönderilir. Backend hesap sahipliğini doğrular. Hesap değiştiğinde önceki isteklerin sonuçları ekrana taşınmaz. Veriler dakikada bir yenilenir.

## Hesaplama

`net = pozitif sonuçların toplamı + negatif sonuçların toplamı`.

Pozitif gün yeşil, negatif gün kırmızı, işlem yapılıp neti sıfır olan gün başa baş gösterilir. Kayıt olmayan gün “İşlem kaydı yok” yazar. Kayıt sayısı gerçekleşme/fill sayısıdır; tek emir birden fazla gerçekleşme içerebilir.

Kaynaklar: bot kimliğiyle eşleştirilmiş kapanış `testnet_execution_fills` kayıtları ve grid worker'ının kapanış gerçekleşmeleri. PAPER, manuel emirler ve açık pozisyonlar dahil edilmez. Kâr/zarar endpointi borsayı veya Go motorunu çağırmaz; yalnızca kalıcı `bot_pnl_entries` tablosunu okur. Borsa geçmişini okuyup kapanışları veritabanına yazan operasyon akışı bundan ayrıdır.

Binance grid futures için borsanın gerçekleşmiş PnL değeri kullanılır. Grid spot ve Bybit için gerçekleşmiş giriş/çıkış fiyat ve miktarları eşleştirilir; giriş komisyonu kapanan miktara dağıtılır. Grid kısmi kapanışları gerçek gerçekleşme zamanına yazılır. Açık pozisyon sonucu ve funding dahil edilmez. Doğrulanamayan komisyon varsa günün ve dönemin net sonucu bilinmiyor olarak gösterilir.

## Sıfırlama

Ekrandaki “Kâr / zararı sıfırla” ayrı bir kalıcı silme onayı açar. Onay seçili hesabın `bot_pnl_entries` kayıtlarını siler ve `bot_pnl_periods.resetAt` değerini yeniler. Tüm tarih aralıkları sıfırlanır. Geç ulaşan eski borsa gerçekleşmeleri başlangıç sınırı nedeniyle yeniden içeri alınmaz. Hesap kilidi sıfırlama ile kayıt yazmayı sıralar; benzersiz gerçekleşme anahtarları çift sayımı engeller.

Borsanın geçmişi, bot emirleri, açık pozisyonlar ve operasyonun ihtiyaç duyduğu asıl fill kayıtları silinmez. Silinenler bu raporun kalıcı muhasebe kayıtlarıdır. Bu işlem diğer API hesaplarını etkilemez.

## Doğrulama

- Backend: ondalık net, Türkiye gece yarısı, eksik komisyon, tarih sınırları, kullanıcı/hesap kapsamı, sıfırlama ve eski kayıtların geri gelmemesi; grid kısmi kapanış günleri; geçmiş okumasının Go motorundan bağımsızlığı.
- Frontend: 7 günlük yerleşim, 6 haftalı ay, artık yıl, yıl geçişi, kart durumları ve hesap kimliği taşıyan API istekleri.
- Yerel veritabanında yeni iki tablo oluşturuldu. Geçmiş okumasının ihtiyaç duyduğu eksik `20260827010000_add_hedge_position_side_and_ai_outcomes` migration'ı da uygulandı. Diğer bekleyen migration'lar topluca uygulanmadı.
- İlk geçmiş aktarımının başlangıcı Türkiye saatine göre 1 Temmuz 2026'dır. Sonraki kapanışlar gerçekleştiği anda aynı kalıcı rapor tablosuna yazılır.
- Gerçek kullanıcı hesabında sıfırlama yapılmadı. Tarayıcı bağlantısı bulunamadığı için görsel kabul yapılmadı; üretime deploy yapılmadı.

Kontrol komutları: `npx vitest run tests/bot-pnl.test.ts tests/bot-pnl-history.test.ts`, `node --test tests/bot-pnl.test.mjs` (frontend), `npx tsx scripts/verify-bot-pnl-calendar.ts 2026-08-01 2026-09-30` (backend).
