# Pro borsa emirleri

Pro Emirler ekranı `/admin/trading/exchange-orders` uç noktasını kullanır. Tekli/toplu manuel emir açma servisleri değiştirilmedi. Seçili hesap kimliği her okuma, iptal ve düzenleme isteğinde gönderilir; sahiplik backend ve Go katmanında kontrol edilir.

Liste seçili hesabın piyasa türüne aittir: SPOT için spot açık emirler, USDT_M için vadeli açık emirler ve koşullu TP/SL emirleri. Kısmen gerçekleşenler dahildir; tamamen gerçekleşenler açık emir listesine dahil değildir. Piyasa türleri birleştirilmez. Son okuma zamanı gösterilir; okuma hatası varsa son liste eski olarak işaretlenir ve işlem düğmeleri kapanır.

Go'ya salt-okunur `/internal/v1/shadow/accounts/{accountId}/orders` eklendi. Bu okuma bakiye, pozisyon ve parite listesinin başarıyla yüklenmesine bağlı değildir. Eski Go sürümü bu yolu 404 döndürürse backend mevcut snapshot okumasına döner. Yeni bağımsız yolu kullanmak için Go Engine yeniden başlatılmalıdır.

## Düzenleme kapsamı

- Uygulamada kayıtlı MANUAL kaynaklı, OPEN ve gerçekleşen miktarı sıfır olan LIMIT, STOP_MARKET ve TAKE_PROFIT_MARKET emirleri.
- LIMIT için fiyat, TP/SL için tetik fiyatı düzenlenir. Yön, miktar, pozisyon tarafı ve reduce-only bilgisi korunur. Fiyat/adım kontrolü eski emir iptal edilmeden önce yapılır.
- Düzenleme iptal-yeniden gönderme işlemidir; atomik borsa değişikliği değildir. Onay ekranı koruma boşluğu ve yeni emrin reddedilmesi ihtimalini belirtir. İptal doğrulanmadan yeni emir gönderilmez. LIMIT iptalinde gerçekleşen miktar sıfır değilse yerine emir açılmaz.
- Emir başına kalıcı düzenleme kimliği eşzamanlı/tekrarlanan değişikliği engeller. Belirsiz sonuç yeniden gönderilmez ve dikkat gerektiren sonuç olarak döner.
- Toplu manuel koruma düzenlemesinde kampanya lease'i alınır; yeni emrin yerel kimliği TP/SL takip kaydına yazılır. Yeni emir veya takip kaydı güncellenemezse kampanya ATTENTION olur.
- Bot/SYSTEM/GRID_BOT kaynaklı korumalar doğrudan düzenlemeye kapalıdır; bot ayarları üzerinden yönetilir. Dışarıdan açılmış emirlerin fiyatını düzenlemek ve kısmi gerçekleşmiş emri düzenlemek bu sürümün kapsamı dışındadır.

## İptal kapsamı

Go hesabında vadeli LIMIT/MARKET/STOP_MARKET/STOP_LIMIT/TAKE_PROFIT_MARKET ve spot LIMIT/MARKET emirleri tekli veya toplu iptal edilebilir. Dış emir iptalinde Go'nun izlenebilir iptal kaydı için yerel kimlik oluşturulur. Spot OCO ve diğer desteklenmeyen emir türleri listede kalır; iptal düğmesi kapalıdır. Desteklenmeyen işlemler borsa uygulamasından yapılmalıdır.

## Doğrulama — 14 Eylül 2026

Seçili Binance Test USDT_M hesabına salt-okunur servis çağrısı 38 açık emir (19 TP ve 19 SL), 38 düzenlenebilir kayıt döndürdü. Borsaya doğrulama amacıyla emir/iptal gönderilmedi. Backend testleri iptal zaman aşımı, kısmi dolum yarışı, bot koruması, kampanya lease'i, takip kimliği güncelleme ve tekrarlanan isteği kapsar. Frontend testleri seçili hesap ve ayrı uç noktaları; Go testi salt-okunur sahiplik ve bağımsız okumayı doğrular.

Binance'ın yerel LIMIT değişikliği desteği ayrıca vardır; bu sürüm genel düzenleme için yukarıdaki açık onaylı iptal-yeniden gönderme yöntemini kullanır. [Binance emir belgeleri](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade).
