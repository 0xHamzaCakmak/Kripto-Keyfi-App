# Kripto Keyfi Games ve Bitcoin Up / Down Oyunu

Bu doküman, `Games.tsx` içinde geliştirilen Kripto Keyfi Games sayfası, ana sayfa oyun önizlemesi ve Bitcoin Up / Down tahmin oyunu için verilen iki geliştirme promptunun birleştirilmiş halidir.

## Genel Amaç

Kripto Keyfi projesine ayrı bir `Games / Eğlence` alanı eklenir. Ana sayfada daha önce yer alan `My Assets Preview` bölümü kaldırılır ve yerine Bitcoin Up / Down oyun önizlemesi konur. Kullanıcı bu önizleme kartından veya Games sayfasından `/games/up-down` rotasına geçerek 30 saniyelik Bitcoin fiyat yönü tahmin oyununu deneyebilir.

Bu sistem gerçek trade, yatırım, bahis veya finansal kazanç sistemi değildir. UI içinde uygun yerlerde şu uyarı gösterilmelidir:

> Bu oyun eğlence amaçlıdır. Gerçek yatırım işlemi veya finansal tavsiye değildir.

Metinlerde para kazanma, kesin kazanç, ödül kazanma veya trade yapma algısı oluşturulmamalıdır. `Tahmin oyunu`, `eğlence amaçlı` ve `sanal puan` dili tercih edilmelidir.

## Rotalar

- `/games`: Kripto Keyfi Games / Eğlence Merkezi sayfası.
- `/games/up-down`: Bitcoin Up / Down Tahmin Oyunu sayfası.

## Ana Sayfa Oyun Önizlemesi

Ana sayfada `My Assets Preview` yerine `Bitcoin Up / Down` mini grafik kartı bulunmalıdır.

Kart içeriği:

- Başlık: `Bitcoin Up / Down`
- Alt açıklama: `30 saniyelik fiyat tahmin oyununa katıl.`
- Anlık BTC fiyatı, 2 decimal USD formatında.
- Sürekli akan çizgi grafik.
- UP / DOWN küçük hareket göstergesi.
- `Eğlenceye Katıl` butonu.
- `Eğlence amaçlıdır` notu.

Kartın tamamına veya butona tıklandığında `/games/up-down` sayfasına gidilmelidir.

## Games Sayfası

`/games` sayfasında oyun kartları listelenmelidir:

- Bitcoin Up / Down: Aktif
- Ethereum Up / Down: Yakında
- Whale Guess: Yakında
- Market Sentiment Quiz: Yakında
- Gas Fee Challenge: Yakında
- Crypto Knowledge Quiz: Yakında

Aktif Bitcoin Up / Down kartı `/games/up-down` sayfasına yönlendirmelidir.

## Bitcoin Up / Down Oyun Sayfası

Sayfa başlığı:

`Bitcoin Up / Down Tahmin Oyunu`

Alt açıklama:

`30 saniye içinde fiyatın yukarı mı aşağı mı gideceğini tahmin et.`

Sayfada bulunması gereken alanlar:

- Büyük canlı BTC grafik alanı.
- Anlık BTC fiyatı.
- 30 saniyelik sayaç.
- UP butonu.
- DOWN butonu.
- Aktif tahmin bilgisi.
- Başlangıç fiyatı.
- Sonuç fiyatı.
- Başarılı / Başarısız / Berabere sonucu.
- Sağ tarafta veya mobilde altta `Son Tahminlerim`.
- Sanal puan özeti.
- Eğlence amaçlı uyarı.
- Giriş yapmamış kullanıcı için: `Sonuçlarını kalıcı kaydetmek için giriş yap.`
- Giriş yapmış kullanıcı için: `Sonuçlar ileride hesabına kaydedilecek.`

## Oyun Akışı

Kullanıcı UP veya DOWN seçer.

Seçim anında:

- `entryPrice` kaydedilir.
- Grafik üzerinde entry fiyat seviyesinde yatay kesikli çizgi çizilir.
- Çizginin sağında `Entry: $62,534.25` benzeri fiyat etiketi gösterilir.
- Kullanıcının seçimi `UP seçildi` veya `DOWN seçildi` olarak gösterilir.
- 30 saniyelik sayaç başlar.
- Kullanıcı süre bitene kadar tekrar seçim yapamaz.
- Grafik akmaya devam eder.

30 saniye sonunda:

- `currentPrice` alınır.
- Kullanıcı UP seçtiyse ve `currentPrice > entryPrice` ise sonuç `Başarılı`.
- Kullanıcı DOWN seçtiyse ve `currentPrice < entryPrice` ise sonuç `Başarılı`.
- Aksi durumda sonuç `Başarısız`.
- Fiyat eşitse sonuç `Berabere`.

## Geçici Oyun Geçmişi

`Son Tahminlerim` bölümü localStorage ile tutulmalıdır. Backend geldiğinde veritabanına taşınmaya hazır olmalıdır.

Her geçmiş kaydı şunları içermelidir:

- Seçim: UP / DOWN
- Entry Price
- Result Price
- Süre: 30s
- Sonuç: Başarılı / Başarısız / Berabere
- Zaman

Geçmiş limiti örnek olarak son 20 kayıtla sınırlandırılabilir.

## Sanal Puan Alanı

Gerçek puan sistemi backend aşamasına bırakılır. UI içinde mock/sanal puan özeti yer almalıdır:

- Bugünkü Puan
- Başarı Serisi
- Toplam Deneme
- Başarı Oranı

## BTC Fiyat Kaynağı

Oyun grafiği sabit mock başlangıç fiyatına bağlı kalmamalıdır. Projedeki alt market ticker bölümünde kullanılan canlı BTC fiyat kaynağıyla aynı servis altyapısını kullanmalıdır.

Beklenen servis yapısı:

- `priceService`
- `getLiveBtcPrice()`
- `getFallbackBtcPrice()`
- `getLiveMarketPrices()`
- `subscribeToBtcPriceMock()` veya mock/fallback hazırlığı

İlk yükleme davranışı:

- Canlı API fiyatı geldiyse `anchorPrice` ve `currentPrice` canlı BTC fiyatıyla başlatılır.
- API fiyatı henüz gelmediyse kısa süre loading bilgisi gösterilir veya fallback mock fiyat kullanılır.
- API hata verirse oyun bozulmadan fallback fiyatla çalışmaya devam eder.

## Canlı Fiyat Güncellemesi

API’den yeni BTC fiyatı geldiğinde:

- `targetAnchorPrice` güncellenir.
- Grafik aniden yeni fiyata zıplamaz.
- 2-3 saniyede yumuşak şekilde yeni fiyata yaklaşır.

Örnek doğru geçiş:

`62,525 -> 62,535 -> 62,548 -> 62,561 -> 62,572 -> 62,578`

Bu geçiş için smoothing / interpolation mantığı kullanılmalıdır.

## Mikro Fiyat Hareket Motoru

API’den yeni fiyat gelene kadar grafik durmamalıdır.

Beklenen hareket davranışı:

- Anchor fiyat çevresinde mikro hareket üretir.
- Genelde ±10 dolar aralığında kalır.
- Bazen 1 dolar, bazen 2 dolar hareket eder.
- Nadiren 3-4 dolarlık kısa hareket yapar.
- Fiyat her yerde 2 decimal gösterilir.
- Hareketler sert rastgele değil, hafif trendli ve doğal görünmelidir.
- Maksimum 100-120 fiyat noktası tutulur.
- Eski noktalar silinir, yeni noktalar eklenir.

## Grafik Davranışı

Grafik hafif ve performanslı olmalıdır. Mevcut chart kütüphanesi kullanılabilir; aksi halde SVG veya canvas ile custom chart uygulanabilir.

Beklenen özellikler:

- Düz, ince, kesiksiz çizgi.
- Smooth / curved line görünümü.
- Koyu tema uyumlu hafif alan dolgusu.
- Sürekli akan grafik hissi.
- Mobil uyumlu.
- Desktop’ta büyük grafik alanı.
- Mobilde taşma yapmayan okunabilir grafik.
- Component unmount olduğunda timer / interval temizliği.
- Gereksiz re-render azaltımı.

## TradingView Benzeri Geliştirmeler

Grafik profesyonel görünmeli ve şu özellikleri içermelidir:

- Sağ tarafta dinamik fiyat skalası.
- Son fiyat etiketi.
- Canlı fiyat yatay çizgisi.
- Entry fiyat çizgisi.
- Auto-scale sistemi.
- Dinamik tick aralıkları.

### Sağ Fiyat Ekseni

Grafiğin sağ tarafında fiyat skalası bulunmalıdır.

Örnek:

- 62,680
- 62,660
- 62,640
- 62,620
- 62,600

Bu fiyatlar grafikte görünen fiyat aralığına göre otomatik üretilmelidir.

### Auto Scale

Grafikte görünen son 80-120 fiyat noktası analiz edilir:

- `minPrice`
- `maxPrice`
- `range = maxPrice - minPrice`

Grafik bu aralığa göre kendini ölçekler.

Düşük volatilitede eksen daralır, yüksek volatilitede genişler.

### Dinamik Tick Aralıkları

Range’e göre tick aralığı otomatik belirlenir:

- `range < 20`: 2 dolar
- `range 20-100`: 5 dolar
- `range 100-300`: 10 dolar
- `range > 300`: 25 dolar

Fiyat etiketleri üst üste binmemeli, grafik yüksekliğine göre yaklaşık 5-7 adet fiyat etiketi gösterilmelidir.

### Son Fiyat Etiketi

Grafiğin en sağında son fiyat etiketi gösterilmelidir.

Örnek:

`$62,651.34`

Etiket son noktanın hizasında hareket eder.

- Son hareket yukarıysa yeşil.
- Son hareket aşağıysa kırmızı.

### Canlı Fiyat Çizgisi

Son fiyat seviyesinde TradingView benzeri yatay ince bir çizgi gösterilmelidir.

- Düz çizgi olmalıdır.
- Son fiyat etiketiyle aynı seviyede olmalıdır.
- Fiyat hareket ettikçe yukarı/aşağı kaymalıdır.

### Entry Çizgisi

Kullanıcı tahmin yaptığında entry çizgisi korunur ve iyileştirilir:

- Yatay kesikli çizgi.
- Entry fiyat seviyesinde.
- Sağda `Entry: $62,534.25` etiketi.
- Canlı fiyat çizgisinden farklı görünüm.

Canlı fiyat çizgisi düz, entry çizgisi kesikli olmalıdır.

## Grafik Renk Mantığı

Tahmin yokken:

- Son harekete göre yeşil/kırmızı veya nötr renk kullanılabilir.

Tahmin varken:

- Kullanıcı UP seçtiyse ve canlı fiyat entry fiyatın üstündeyse grafik yeşil.
- Kullanıcı UP seçtiyse ve canlı fiyat entry fiyatın altındaysa grafik kırmızı.
- Kullanıcı DOWN seçtiyse ve canlı fiyat entry fiyatın altındaysa grafik yeşil.
- Kullanıcı DOWN seçtiyse ve canlı fiyat entry fiyatın üstündeyse grafik kırmızı.

## Responsive Tasarım

Desktop:

- Büyük grafik sol tarafta.
- Sağda skor ve geçmiş paneli.
- Sağ fiyat ekseni net okunur.

Mobil:

- Grafik üstte.
- UP / DOWN butonları büyük ve tam genişlik.
- Geçmiş altta.
- Fiyat ve sayaç net görünür.
- Sağ fiyat ekseni çok yer kaplamaz.
- Son fiyat etiketi okunabilir kalır.

## Backend Hazırlığı

Şimdilik frontend tarafında mock/local state ve localStorage ile çalışır.

Backend aşamasında taşınması beklenen alanlar:

- Gerçek fiyat servisi.
- Kalıcı sonuç kayıtları.
- Gerçek puan sistemi.
- Kullanıcı bazlı geçmiş.
- Oyun istatistikleri.

Mevcut yapı component bazlı, responsive, mock data destekli ve backend’e bağlanmaya hazır olmalıdır.
