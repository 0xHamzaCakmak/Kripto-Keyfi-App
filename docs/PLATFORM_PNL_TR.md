# Kripto Keyfi işlem kâr/zararı

15 Eylül 2026 güncellemesi, eski bot-özel rapor kapsamının yerini alır.

- Seçili Binance USDT-M hesabında Kripto Keyfi üzerinden gönderilmiş manuel, toplu manuel ve otomatik bot emirlerinin borsa gerçekleşmeleri rapora alınır. Bot bulunması veya çalışması gerekmez. Doğrudan borsadan verilmiş ve yerel emirle eşleşmeyen emirler dahil değildir.
- Takvim ve günlük detay istekleri yalnızca yerel veritabanını okur; sayfa açılışı borsa isteği başlatmaz veya beklemez. Ayrı sunucu işçisi, aktif Binance USDT-M hesaplarının bugün ve dün gerçekleşmelerini açılıştan beş saniye sonra ve ardından dakikada bir günceller. Aynı işçi çalışırken ikinci tur başlamaz. Arayüz kayıtlı raporu dakikada bir yeniler.
- Yerel emirler kullanıcı + hesap + parite + borsa emir kimliğiyle eşleştirilir. TP/SL algoritmik kimliği gerçekleşmiş emir kimliğine çevrilir; zaten çevrilmiş kayıtlar yeniden algoritmik emir sayılmaz.
- Futures net sonucu: borsanın gerçekleşmiş PnL değeri eksi USDT/USDC komisyonu. Giriş komisyonu giriş gününe, çıkış komisyonu çıkış gününe yazılır. Kısmi gerçekleşmeler ayrı kayıttır. Komisyon para birimi doğrulanamıyorsa net sonuç bilinmiyor gösterilir.
- Açık pozisyonun gerçekleşmemiş sonucu ve funding dahil değildir. Grid worker mevcut kapanış muhasebesini sürdürür; grid emirleri ikinci kez aktarılmaz. Spot/Bybit manuel geçmiş aktarımı henüz desteklenmez; ilgili hesaplarda bu sınır açıkça gösterilir.
- `fill:SYMBOL:tradeId` benzersiz anahtarı eski bot kayıtlarıyla da ortak olduğundan tekrar aktarım çift saymaz. Mevcut rapor tabloları korunur; yeni migration gerekmez.
- Yedi günlük sorgu pencereleri 1000 kayda dolarsa bölünerek okunur. Borsanın saklama süresi dışındaki veya erişilemeyen geçmiş için eksiklik uyarısı kalır. Tarih alanları Türkiye saatine göredir.
- İşlem bulunan takvim kartları günlük detay görünümünü açar. Üst yönetim başlığı ve menüsü değişmez. Sol sütunda pozitif, sağ sütunda negatif gerçekleşmeler; her satırda parite, kaldıraç, gerçekleşen işlem tutarı ve net sonuç gösterilir. Alttaki özet toplam gerçekleşme, toplam işlem tutarı, toplam kâr, toplam zarar ve net sonucu verir. “Geri” düğmesi takvime döner.
- Mevcut hesap sahipliği, 1 Temmuz 2026 başlangıcı ve rapor sıfırlama sınırı korunur. Geçmiş aktarımı sıfırlama öncesi kayıtları geri getirmez. İşlem açma/kapama akışında değişiklik yoktur.

Salt okunur borsa aktarımı ve yerel rapor doğrulaması:

```powershell
cd backend
npm.cmd exec -- tsx scripts/verify-bot-pnl-calendar.ts 2026-09-14 2026-09-15 --sync
```

Yerel doğrulama: 14 Eylül 2026, 287 gerçekleşme, net -274.55821548 USDT. Tekrar aktarımda sayı ve net değişmedi; senkronizasyon `ready` döndü. Bu sayı emir/pozisyon sayısı değildir.

API referansı: [Binance Futures işlem geçmişi ve algoritmik emir sorguları](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade).
