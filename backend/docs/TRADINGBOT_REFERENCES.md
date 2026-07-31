# KriptoKeyfi Çok Borsalı Kaldıraçlı İşlem ve Bot Yönetim Modülü

KriptoKeyfi.com canlıda çalışan mevcut bir web uygulamasıdır. Projenin mevcut frontend, backend, veritabanı, authentication, rol sistemi, deployment ve klasör yapısını öncelikle eksiksiz incele.

Bu görevde mevcut projeyi baştan yazma. Mevcut çalışan özellikleri bozma. Mevcut kod standartlarına, tasarım sistemine, authentication yapısına ve deployment yöntemine uyumlu hareket et.

Amaç, KriptoKeyfi uygulamasının admin paneline çok borsalı, API bağlantılı, kaldıraçlı işlem ve otomatik bot yönetim modülü eklemektir.

İlk sürümde bu modüle yalnızca `admin` rolü erişebilecek. Ancak veri modeli, servis mimarisi ve yetkilendirme sistemi ileride normal kullanıcıların da kendi borsa API hesaplarını bağlayarak bot kullanabileceği çok kiracılı bir SaaS yapısına uygun hazırlanmalıdır.

Bu modül web uygulaması üzerinden yönetilecek ancak botlar tarayıcıda çalışmayacaktır. Kullanıcı bilgisayarını veya tarayıcıyı kapatsa bile bot sunucuda çalışmaya devam edecektir.

---

# 1. Temel Mimari Kararı

Mevcut React frontend korunacaktır.

React yalnızca aşağıdaki görevleri üstlenecektir:

* Bot yönetim ekranları
* API hesabı bağlama ekranları
* Bakiye ve pozisyon görüntüleme
* Emir listeleri
* Strateji ayarları
* Manuel işlem ekranı
* Grid bot yönetimi
* Kâr/zarar raporları
* Canlı bildirimler
* Acil durdurma kontrolleri

Borsa API secret bilgileri hiçbir koşulda frontend’e gönderilmemelidir.

Mevcut backend Node.js ve TypeScript ise şu görevler mevcut backend üzerinden yürütülebilir:

* Authentication
* Kullanıcı ve rol kontrolü
* Admin yetkilendirmesi
* API hesaplarının yönetimi
* Bot konfigürasyonları
* Abonelik altyapısına hazırlık
* Raporlama
* Audit log
* Bot servisi ile iletişim
* Frontend WebSocket veya SSE iletişimi

Botların sürekli çalışma, borsa bağlantıları, WebSocket yönetimi, pozisyon takibi ve emir yürütme işlemleri ayrı bir servis olarak hazırlanmalıdır.

Tercih edilen yapı:

```text
React Frontend
      ↓
Mevcut Node.js / TypeScript API
      ↓
Redis Queue / Internal API
      ↓
Go Bot Engine
      ↓
Binance / Bybit / Diğer Borsalar
```

Eğer proje içinde şu anda Go servisi bulunmuyorsa:

1. Proje monorepo yapısına uygunsa `services/trading-engine` veya eşdeğer bir klasörde Go servisi oluştur.
2. Mevcut deploy yapısını bozmadan Docker Compose veya ayrı PM2/systemd servisi ile çalıştırılabilir hale getir.
3. İlk geliştirme aşamasında tüm borsa işlemlerini Node.js servisinde hazırlamak daha güvenliyse, sistemi daha sonra Go servisine ayrılabilecek adapter ve service katmanlarıyla geliştir.
4. Borsa erişim kodlarını controller veya frontend kodlarının içine yerleştirme.
5. Domain katmanı, exchange adapter katmanı, risk engine ve order manager birbirinden ayrılmış olsun.

Bot motoru aşağıdaki bileşenlere ayrılmalıdır:

```text
Trading Engine
├── Exchange Adapter Manager
├── Market Data Manager
├── Account Stream Manager
├── Strategy Engine
├── Grid Bot Engine
├── Risk Engine
├── Order Manager
├── Position Manager
├── PnL Calculator
├── Reconciliation Worker
├── Bot Scheduler
├── Notification Manager
└── Emergency Control Manager
```

---

# 2. Admin Erişimi ve Görünürlük

İlk sürümde bu modül yalnızca admin panelinde yer alacak.

Sidebar veya admin menüsüne aşağıdaki ana menü eklenebilir:

```text
Trading Bot
├── Genel Bakış
├── Borsa Hesapları
├── Botlarım
├── Manuel İşlem
├── Grid Bot
├── Açık Pozisyonlar
├── Açık Emirler
├── İşlem Geçmişi
├── Kâr/Zarar
├── Risk Yönetimi
├── Bot Logları
└── Sistem Durumu
```

Yetki kuralları:

* Yalnızca `admin` rolü modülü görebilsin.
* Backend tarafında bütün endpointler rol kontrolünden geçsin.
* Frontend’de menüyü gizlemek tek başına güvenlik olarak kabul edilmesin.
* Admin olmayan kullanıcı endpoint adresini bilse bile erişemesin.
* Gelecekte `trading_bot_user`, `trading_bot_manager` gibi roller eklenebilecek yapıda olsun.
* Her kayıt mutlaka `userId`, `tenantId` veya mevcut projenin kullanıcı sahipliği modeline bağlansın.
* Kullanıcı sadece kendisine ait API hesaplarını, emirleri, pozisyonları ve botları görebilsin.

---

# 3. Borsa Hesabı ve API Bağlantısı

Bir kullanıcı birden fazla borsa ve aynı borsada birden fazla API hesabı bağlayabilmelidir.

Örnek:

```text
Binance Ana Hesap
Binance Test Hesabı
Bybit Vadeli Hesap
Bybit İkinci Hesap
```

Borsa hesabı ekleme formunda aşağıdaki alanlar bulunmalıdır:

* Hesap adı
* Borsa seçimi
* API Key
* API Secret
* Passphrase gerekiyorsa passphrase
* Testnet / Demo / Live seçimi
* Vadeli işlem tipi
* USDT-M
* Coin-M
* Spot
* Unified Trading Account
* Sub-account bilgisi gerekiyorsa sub-account
* Açıklama
* Aktif / pasif durumu
* IP whitelist bilgilendirmesi

İlk desteklenecek borsalar:

1. Binance Futures
2. Bybit V5

Mimari daha sonra aşağıdaki borsaların eklenebilmesine uygun olmalıdır:

* OKX
* Bitget
* Gate.io
* MEXC
* KuCoin Futures

Her borsa için ayrı adapter kullanılmalıdır.

Örnek interface:

```ts
interface ExchangeAdapter {
  validateCredentials(): Promise<CredentialValidationResult>;
  getAccountInfo(): Promise<AccountInfo>;
  getBalances(): Promise<Balance[]>;
  getSymbols(): Promise<ExchangeSymbol[]>;
  getTicker(symbol: string): Promise<Ticker>;
  getOrderBook(symbol: string): Promise<OrderBook>;
  getOpenOrders(): Promise<ExchangeOrder[]>;
  getOrder(orderId: string): Promise<ExchangeOrder>;
  placeOrder(input: PlaceOrderInput): Promise<ExchangeOrder>;
  cancelOrder(orderId: string): Promise<void>;
  cancelAllOrders(symbol?: string): Promise<void>;
  getOpenPositions(): Promise<ExchangePosition[]>;
  setLeverage(symbol: string, leverage: number): Promise<void>;
  setMarginMode(symbol: string, mode: MarginMode): Promise<void>;
  closePosition(input: ClosePositionInput): Promise<ExchangeOrder>;
  subscribeMarketData(): Promise<void>;
  subscribeAccountStream(): Promise<void>;
}
```

## Otomatik borsa tespiti

Kullanıcı isterse borsayı elle seçebilsin.

Ek olarak “Borsayı otomatik tespit et” seçeneği bulunabilir.

Ancak API key’in kendisinden borsa kesin şekilde anlaşılamayabileceği için şu yöntem kullanılmalıdır:

1. Desteklenen borsa adapterları sırayla güvenli bir kimlik doğrulama isteği göndersin.
2. İlk başarılı doğrulama sonucunda ilgili borsa önerilsin.
3. Aynı API bilgileri farklı servislerde geçerli olursa kullanıcıdan manuel seçim istensin.
4. Hiçbir borsada doğrulanamazsa anlaşılır hata gösterilsin.
5. Otomatik tespit sırasında hiçbir emir oluşturulmasın.
6. Yalnızca salt okunur hesap bilgisi veya doğrulama endpointi kullanılsın.
7. Başarısız denemelerde secret bilgi loglanmasın.

Kullanıcıya şu seçenekler sunulsun:

```text
Borsayı kendim seçeceğim
Borsayı otomatik tespit et
```

API bağlantısı kurulduktan sonra sistem aşağıdaki bilgileri göstermelidir:

* Borsa adı
* Hesap türü
* Kullanılabilir bakiye
* Toplam cüzdan bakiyesi
* Kullanılan teminat
* Kullanılabilir teminat
* Gerçekleşmemiş kâr/zarar
* Açık pozisyon sayısı
* Açık emir sayısı
* API işlem yetkisi var mı
* Vadeli işlem yetkisi var mı
* Para çekme yetkisi var mı
* Son bağlantı zamanı
* Son başarılı senkronizasyon
* API bağlantı durumu
* Testnet veya live bilgisi

Para çekme yetkisi aktif olan API hesabı için güçlü bir güvenlik uyarısı göster:

```text
Bu API anahtarında para çekme yetkisi açık görünüyor. Güvenlik nedeniyle yalnızca okuma ve işlem yetkisi bulunan, para çekme yetkisi kapalı bir API anahtarı kullanmanız önerilir.
```

Mümkünse para çekme yetkisi açık API hesaplarının sisteme eklenmesini engelle veya admin onayı gerektir.

---

# 4. API Bilgilerinin Güvenliği

API secret ve passphrase bilgileri veritabanında düz metin olarak saklanmamalıdır.

Minimum güvenlik gereksinimleri:

* AES-256-GCM veya güvenli eşdeğer şifreleme
* Her credential için ayrı IV/nonce
* Authentication tag saklanması
* Encryption key uygulama koduna yazılmamalı
* Encryption key Git reposuna eklenmemeli
* Secret frontend’e geri gönderilmemeli
* Secret API response içinde maskeli bile olsa tekrar taşınmamalı
* Güncelleme ekranında yalnızca “Kayıtlı API anahtarı mevcut” bilgisi gösterilmeli
* Secret değerler loglanmamalı
* Exception çıktılarında request body temizlenmeli
* Audit log içinde secret bulunmamalı
* API hesabı silindiğinde credential verileri de güvenli şekilde silinmeli
* API hesabının bağlantısı kesildiğinde çalışan botlar kontrollü şekilde durdurulmalı

Maskeli API key gösterimi:

```text
ABCD********WXYZ
```

Secret hiçbir zaman gösterilmemelidir.

---

# 5. Bakiye Seçimi ve Bot Sermayesi

Bot oluşturulurken kullanıcı bağladığı borsa hesabındaki varlıkları görebilmelidir.

Örnek:

```text
USDT: 1,250.45
USDC: 300.00
BTC: 0.032
ETH: 0.84
```

Kullanıcı bot için şu seçeneklerden birini seçebilsin:

* Sabit tutar
* Kullanılabilir bakiyenin yüzdesi
* Kullanılabilir bakiyenin tamamı
* Her işlem için sabit teminat
* Dinamik risk oranı

Örnek:

```text
Bot sermayesi: 250 USDT
İşlem başına maksimum teminat: 10 USDT
Aynı anda maksimum açık pozisyon: 5
Toplam maksimum kullanılan teminat: 50 USDT
```

“Tüm bakiyeyi kullan” seçeneği olsa bile güvenlik rezervi tanımlanmalıdır.

Örnek:

```text
Tüm bakiyeyi kullan
Güvenlik rezervi: %20
Bot tarafından kullanılabilir bakiye: %80
```

Kullanıcı varlığı ilgili borsa hesabının doğru bölümünde tutmalıdır.

Örneğin vadeli işlem yapılacaksa:

* Bakiye futures cüzdanında bulunmalı
* Borsa unified account kullanıyorsa ilgili hesap türü doğrulanmalı
* Yetersiz bakiye durumunda bot başlatılmamalı
* Kullanıcıya “Bakiye Spot cüzdanda olabilir” gibi açıklayıcı hata verilmeli
* Uygulama otomatik transfer yapmamalı
* İleride transfer özelliği eklenirse ayrı izin ve açık kullanıcı onayı gerektirmeli

---

# 6. Bot Türleri

Sistem yalnızca tek bir bot mantığına bağlı olmamalıdır.

Bot oluştururken aşağıdaki bot türleri sunulmalıdır:

## 6.1 Scalping Bot

Küçük fiyat hareketlerinden kâr almaya çalışan kısa vadeli bot.

Ayarları:

* Borsa hesabı
* Coin/parite
* Long
* Short
* İki yönlü
* Kaldıraç
* Margin türü
* Bot sermayesi
* İşlem başına teminat
* Maksimum açık işlem
* Kâr alma yüzdesi
* Zarar durdurma yüzdesi
* Trailing stop
* Minimum beklenen net kâr
* Maksimum spread
* Maksimum slippage
* Minimum hacim
* Minimum volatilite
* Maksimum volatilite
* İşlemler arası bekleme süresi
* Günlük maksimum işlem sayısı
* Günlük maksimum zarar
* Günlük hedef kâr
* Otomatik kapanma koşulları

Bot, yalnızca komisyon ve tahmini kayma sonrası beklenen net kazanç pozitifse emir oluşturmalıdır.

## 6.2 Grid Bot

Belirlenen fiyat aralığında otomatik alım ve satım emirleri oluşturan grid bot.

Ayarları:

* Alt fiyat
* Üst fiyat
* Grid sayısı
* Aritmetik grid
* Geometrik grid
* Long grid
* Short grid
* Neutral grid
* Toplam ayrılan sermaye
* Grid başına tutar
* Kaldıraç
* Margin modu
* Başlangıç emri
* Stop-loss fiyatı
* Take-profit fiyatı
* Fiyat aralık dışına çıkınca:

  * Botu durdur
  * Pozisyonları kapat
  * Bekle
  * Yeni aralık oluşturma önerisi göster
* Gerçekleşen grid emrinden sonra karşı emri otomatik oluştur
* Maksimum aktif emir
* Minimum grid kârlılığı
* Komisyon sonrası tahmini grid kârı

Grid bot oluşturma ekranında grid seviyeleri görsel olarak gösterilsin.

Örneğin:

```text
Üst sınır: 70,000
Alt sınır: 65,000
Grid sayısı: 10
Grid aralığı: 500
```

Bot başlatılmadan önce önizleme göster:

* Oluşturulacak emir sayısı
* Her emir büyüklüğü
* Kullanılacak toplam teminat
* Tahmini likidasyon seviyesi
* Grid başına brüt kâr
* Tahmini komisyon
* Grid başına tahmini net kâr
* Risk uyarıları

## 6.3 Manuel Kontrollü Bot

Kullanıcının manuel sinyal verdiği ancak emir yönetimini sistemin yaptığı yapı.

Kullanıcı:

* Long aç
* Short aç
* Pozisyonu kapat
* Kısmi kapat
* TP ekle
* SL ekle
* Trailing stop ekle
* Kaldıraç değiştir
* Bekleyen emri iptal et
* Tüm emirleri iptal et

işlemlerini panelden yapabilmelidir.

## 6.4 Fiyat Tetiklemeli Emir Botu

Kullanıcı seçili coin için fiyat seviyesi belirleyebilsin.

Örnek:

```text
BTCUSDT fiyatı 64,500 seviyesine düşerse:
- Long aç
- 3x kaldıraç
- 50 USDT teminat
- TP: %0.80
- SL: %0.40
```

Aşağıdaki koşullar desteklensin:

* Fiyat büyükse
* Fiyat küçükse
* Fiyat seviyesini yukarı kırarsa
* Fiyat seviyesini aşağı kırarsa
* Belirli yüzde yükselirse
* Belirli yüzde düşerse
* Belirli saatte
* Belirli tarih ve saatte

## 6.5 Daha Sonra Eklenebilecek Stratejiler

Mimaride aşağıdaki stratejiler için genişleme alanı bırak:

* DCA bot
* Martingale olmayan kontrollü pozisyon artırma
* EMA crossover
* RSI tabanlı strateji
* MACD
* Bollinger Bands
* Order book imbalance
* Volume breakout
* Trailing entry
* Copy strategy
* AI sinyal destekli bot
* TradingView webhook botu

İlk sürümde martingale ve zarar ettikçe pozisyon miktarını kontrolsüz artıran özellikler eklenmesin.

---

# 7. Manuel İşlem Ekranı

Admin, bağlı borsa hesapları üzerinden manuel işlem açabilmelidir.

Form alanları:

* Borsa hesabı
* Piyasa türü
* Coin/parite
* Güncel fiyat
* Long / Short
* Market / Limit / Stop Market / Stop Limit
* Emir fiyatı
* Tetikleme fiyatı
* Miktar
* Teminat miktarı
* Bakiye yüzdesi
* Kaldıraç
* Isolated / Cross
* Reduce-only
* Post-only
* Take-profit
* Stop-loss
* Trailing stop
* Emir geçerlilik türü
* GTC
* IOC
* FOK
* Onay ekranı

Emir gönderilmeden önce özet modalı göster:

```text
Borsa: Binance Futures
Parite: BTCUSDT
Yön: Long
Emir tipi: Limit
Fiyat: 65,000
Teminat: 25 USDT
Kaldıraç: 3x
Pozisyon büyüklüğü: 75 USDT
Tahmini likidasyon: ...
Take Profit: ...
Stop Loss: ...
Tahmini açılış komisyonu: ...
```

Kullanıcı açıkça onaylamadan emir gönderilmemelidir.

---

# 8. Kaldıraç Yönetimi

Kullanıcı kaldıraç oranını seçebilsin ancak sadece borsanın ilgili parite için izin verdiği sınırlar gösterilsin.

Sistem:

1. Parite bilgilerini borsadan alsın.
2. Minimum ve maksimum kaldıraç değerlerini öğrensin.
3. Risk limitine göre kullanılabilir maksimum kaldıraç değerini belirlesin.
4. Kullanıcının izin verilen değerden daha yüksek kaldıraç seçmesini engellesin.
5. Kaldıraç değişmeden önce açık pozisyon durumunu kontrol etsin.
6. Borsanın döndürdüğü gerçek kaldıraç değerini kaydetsin.
7. Frontend tahminine güvenmesin.
8. Borsa cevabını esas alsın.

Yüksek kaldıraçlarda uyarı seviyeleri:

* 1x–3x: Normal
* 4x–5x: Dikkat
* 6x–10x: Yüksek risk
* 10x üzeri: Çok yüksek risk

Bu seviyeler sadece bilgilendirme amaçlıdır. Asıl limit borsa ve sistem risk motoru tarafından uygulanmalıdır.

---

# 9. Açık Pozisyonlar Ekranı

Pozisyonlar canlı liste halinde takip edilebilmelidir.

Kolonlar:

* Borsa
* Hesap
* Bot adı
* Parite
* Yön
* Pozisyon büyüklüğü
* Teminat
* Kaldıraç
* Giriş fiyatı
* Mark price
* Likidasyon fiyatı
* Gerçekleşmemiş PnL
* PnL yüzdesi
* Take-profit
* Stop-loss
* Açılış zamanı
* Pozisyon kaynağı
* Bot
* Manuel
* Grid
* Durum
* İşlemler

Satır işlemleri:

* Pozisyonu kapat
* Kısmi kapat
* TP düzenle
* SL düzenle
* Trailing stop ekle
* Bot yönetimini durdur
* Bot yönetimine devret
* Detayları aç

Kısmi kapatma seçenekleri:

* %25
* %50
* %75
* Tamamı
* Özel miktar

Pozisyon kapatma sırasında:

* Reduce-only kullanılmalı
* Pozisyon yönü doğrulanmalı
* Mevcut pozisyon büyüklüğünden fazla kapatma yapılmamalı
* İşlem sonrası borsa ile mutabakat yapılmalı

---

# 10. Açık Emirler Ekranı

Açık emirler gerçek zamanlı listelenmelidir.

Kolonlar:

* Borsa
* Hesap
* Bot
* Parite
* Yön
* Emir tipi
* Fiyat
* Tetikleme fiyatı
* Miktar
* Gerçekleşen miktar
* Kalan miktar
* Reduce-only
* Post-only
* Durum
* Oluşturulma zamanı
* Son güncelleme
* İşlemler

İşlemler:

* Emri iptal et
* Fiyatı değiştir
* Miktarı değiştir
* TP/SL ilişkisini görüntüle
* Aynı semboldeki tüm emirleri iptal et
* Hesaptaki tüm açık emirleri iptal et

Toplu iptal işlemleri için güçlü onay modalı göster.

---

# 11. İşlem Geçmişi ve Canlı Emir Takibi

Kullanıcı bütün emirlerini liste halinde canlı takip edebilmelidir.

Emir yaşam döngüsü:

```text
CREATED
QUEUED
SENDING
SUBMITTED
ACKNOWLEDGED
PARTIALLY_FILLED
FILLED
CANCEL_PENDING
CANCELED
REJECTED
EXPIRED
FAILED
RECONCILIATION_REQUIRED
```

Her emir için aşağıdaki bilgiler kaydedilmelidir:

* Yerel order ID
* Borsa order ID
* Client order ID
* Kullanıcı
* API hesabı
* Bot
* Strateji
* Parite
* Yön
* Emir türü
* Miktar
* Fiyat
* Ortalama gerçekleşme fiyatı
* Gerçekleşen miktar
* Komisyon
* Komisyon varlığı
* Reduce-only
* Post-only
* Durum
* Hata kodu
* Borsa hata mesajı
* Oluşturulma zamanı
* Borsaya gönderilme zamanı
* İlk gerçekleşme zamanı
* Tamamlanma zamanı
* Son güncelleme
* Kaynak

Kaynak değerleri:

```text
MANUAL
SCALPING_BOT
GRID_BOT
PRICE_TRIGGER
API
SYSTEM
RISK_ENGINE
```

Emir detay sayfasında olay zaman çizelgesi göster:

```text
21:10:02 Emir oluşturuldu
21:10:02 Risk kontrolünden geçti
21:10:03 Borsaya gönderildi
21:10:03 Borsa tarafından kabul edildi
21:10:05 %40 gerçekleşti
21:10:06 Tamamen gerçekleşti
21:10:06 TP ve SL emirleri oluşturuldu
```

---

# 12. Kâr/Zarar Hesaplama

PnL hesaplama yalnızca fiyat farkına göre yapılmamalıdır.

Aşağıdaki kalemler hesaba katılmalıdır:

* Gerçekleşen brüt PnL
* Açılış komisyonu
* Kapanış komisyonu
* Funding
* Rebate
* Slippage
* Diğer borsa ücretleri
* Net PnL

Formül:

```text
Net PnL =
Gerçekleşen Brüt PnL
- Açılış Komisyonu
- Kapanış Komisyonu
- Funding
- Diğer Maliyetler
+ Rebate
```

Rapor filtreleri:

* Bugün
* Dün
* Son 7 gün
* Son 30 gün
* Özel tarih aralığı
* Borsa
* Hesap
* Bot
* Strateji
* Parite
* Long / Short
* Kârlı / Zararlı

Gösterilecek metrikler:

* Toplam net PnL
* Toplam brüt PnL
* Toplam komisyon
* Toplam funding
* Kazanan işlem sayısı
* Kaybeden işlem sayısı
* Kazanma oranı
* Ortalama kâr
* Ortalama zarar
* Profit factor
* Maksimum drawdown
* En iyi işlem
* En kötü işlem
* Ortalama işlem süresi
* Günlük işlem sayısı
* Long performansı
* Short performansı
* Parite bazlı performans
* Bot bazlı performans

Grafikler:

* Günlük net PnL
* Kümülatif PnL
* Bakiye eğrisi
* Drawdown
* Komisyon maliyeti
* Botlara göre performans
* Coinlere göre performans

---

# 13. Risk Yönetimi

Risk motoru bütün emirlerin önünde çalışmalıdır.

Hiçbir bot veya manuel emir risk motorunu atlayamamalıdır.

Risk kuralları:

* İşlem başına maksimum teminat
* İşlem başına maksimum pozisyon büyüklüğü
* Hesap başına maksimum kullanılan teminat
* Aynı anda maksimum açık pozisyon
* Parite başına maksimum açık pozisyon
* Günlük maksimum zarar
* Haftalık maksimum zarar
* Günlük hedef kâr
* Maksimum kaldıraç
* Minimum bakiye rezervi
* Maksimum spread
* Maksimum slippage
* Maksimum emir sıklığı
* Maksimum günlük işlem sayısı
* Art arda maksimum zararlı işlem
* Cooldown süresi
* Minimum likidite
* Minimum 24 saatlik hacim
* Yasaklı coin listesi
* İzin verilen coin listesi
* Haber veya aşırı volatilite durdurma alanı
* API bağlantısı bozuksa yeni emir engeli
* Account stream bozuksa yeni emir engeli
* Veri gecikmesi varsa yeni emir engeli

Risk kontrol sonucu:

```text
APPROVED
REJECTED
REQUIRES_CONFIRMATION
RISK_BLOCKED
SYSTEM_BLOCKED
```

Risk reddi durumunda sebep açıkça gösterilmelidir:

```text
Emir reddedildi:
Günlük maksimum zarar limitine ulaşıldı.
```

```text
Emir reddedildi:
BTCUSDT için seçilen 20x kaldıraç sistem maksimumu olan 5x değerini aşıyor.
```

---

# 14. Acil Durdurma ve Kill Switch

Sistemde global acil durdurma mekanizması bulunmalıdır.

Seviyeler:

## Bot seviyesinde

* Botu durdur
* Yeni emir oluşturmayı durdur
* Açık emirleri iptal et
* Pozisyonları açık bırak
* Pozisyonları kontrollü kapat

## Hesap seviyesinde

* Hesaptaki bütün botları durdur
* Hesaptaki açık emirleri iptal et
* Hesaptaki pozisyonları kapat

## Sistem seviyesinde

* Bütün yeni emirleri durdur
* Bütün botları durdur
* Sadece izleme moduna geç
* Borsalara emir gönderimini tamamen engelle

Kill switch kullanıldığında:

* Audit log oluştur
* İşlemi yapan kullanıcıyı kaydet
* Tarih ve saat kaydet
* Sebep alanı iste
* Sisteme bildirim gönder
* Aktif botların durumunu `EMERGENCY_STOPPED` yap
* Aynı botların otomatik tekrar başlamasını engelle

---

# 15. Bağlantı Kopması ve Mutabakat

Botların en kritik kısmı borsa ile yerel kayıtların uyumlu kalmasıdır.

Şu senaryo mutlaka ele alınmalıdır:

```text
Bot emir gönderdi.
Borsada emir gerçekleşti.
Sunucu cevap alamadı.
Bot emrin gerçekleşmediğini düşündü.
Aynı emri tekrar gönderdi.
```

Bunu önlemek için:

* Her emirde benzersiz `clientOrderId` kullan
* Idempotency key oluştur
* Aynı clientOrderId ile ikinci emir gönderme
* Timeout sonrası doğrudan tekrar emir gönderme
* Önce borsadan emir durumunu sorgula
* Açık emirleri kontrol et
* Açık pozisyonları kontrol et
* Gerekirse reconciliation kuyruğuna al
* Sonuç kesinleşmeden yeni ilişkili emir oluşturma

Reconciliation worker düzenli olarak:

* Yerel açık emirlerle borsa açık emirlerini karşılaştırsın
* Yerel pozisyonlarla borsa pozisyonlarını karşılaştırsın
* Eksik fill kayıtlarını tamamlasın
* İptal olmuş emirleri güncellesin
* Sistemde bulunmayan borsa emirlerini `EXTERNAL_ORDER` olarak kaydetsin
* Manuel olarak borsa panelinden yapılan işlemleri algılasın
* Fark bulunduğunda botu risk durumuna alsın

Reconciliation aralıkları borsa rate limitlerini aşmamalıdır.

---

# 16. WebSocket ve Gerçek Zamanlı Veri

Borsa WebSocket bağlantıları kullanılmalıdır.

İki farklı stream yönetilmelidir:

## Market data stream

* Ticker
* Mark price
* Order book
* Kline
* Trade stream
* Funding rate

## Account stream

* Emir güncellemeleri
* Fill güncellemeleri
* Pozisyon güncellemeleri
* Bakiye güncellemeleri
* Margin güncellemeleri

Bağlantı yönetimi:

* Otomatik reconnect
* Exponential backoff
* Ping/pong
* Listen key yenileme
* Subscription restore
* Son event timestamp kontrolü
* Stale connection tespiti
* Duplicate event engelleme
* Event sequence kontrolü
* Bağlantı durumu loglama

Frontend’e canlı veri:

* WebSocket
* Socket.IO
* Server-Sent Events

mevcut projeye en uygun yöntemle iletilebilir.

Frontend her fiyat değişiminde tüm tabloyu yeniden render etmemelidir. Performanslı state yönetimi kullanılmalıdır.

---

# 17. Bot Durumları

Bot durum modeli:

```text
DRAFT
CREATED
VALIDATING
STARTING
RUNNING
PAUSING
PAUSED
STOPPING
STOPPED
ERROR
RISK_BLOCKED
CONNECTION_LOST
RECONCILING
EMERGENCY_STOPPED
ARCHIVED
```

Durum geçişleri kontrollü olmalıdır.

Örnek:

```text
DRAFT → CREATED → VALIDATING → STARTING → RUNNING
RUNNING → PAUSING → PAUSED
PAUSED → STARTING → RUNNING
RUNNING → STOPPING → STOPPED
RUNNING → RISK_BLOCKED
RUNNING → CONNECTION_LOST
```

Hatalı durum geçişlerini backend engellemelidir.

---

# 18. Bot Oluşturma Sihirbazı

Bot oluşturma ekranı adım adım hazırlanmalıdır.

## Adım 1: Borsa hesabı

* Borsa hesabını seç
* Bağlantıyı kontrol et
* Hesap türünü göster
* Bakiye göster

## Adım 2: Bot türü

* Scalping
* Grid
* Manuel kontrollü
* Fiyat tetiklemeli

## Adım 3: Piyasa ve parite

* Spot veya futures
* Parite
* Long / Short / Neutral
* Güncel fiyat
* 24 saatlik hacim
* Funding rate
* Maksimum kaldıraç

## Adım 4: Sermaye

* Sabit tutar
* Yüzde
* Tüm kullanılabilir bakiye
* Güvenlik rezervi
* İşlem başına maksimum teminat

## Adım 5: Strateji

Bot türüne göre ilgili ayarlar.

## Adım 6: Risk

* Maksimum kaldıraç
* Maksimum zarar
* Maksimum pozisyon
* Günlük limit
* Stop-loss
* Take-profit

## Adım 7: Önizleme

* Tüm ayarlar
* Tahmini komisyon
* Tahmini pozisyon büyüklüğü
* Tahmini likidasyon riski
* Oluşturulacak emirler
* Risk uyarıları

## Adım 8: Başlatma

* Ayarları kaydet
* Test bağlantısı
* Bakiye kontrolü
* Risk kontrolü
* Botu başlat

Live bot başlatılırken kullanıcıdan açık onay alınmalıdır.

---

# 19. Testnet, Demo ve Live Ayrımı

İlk geliştirme ve doğrulama testnet veya demo hesaplarında yapılmalıdır.

Her API hesabı ve bot için ortam bilgisi saklanmalıdır:

```text
TESTNET
DEMO
LIVE
```

Testnet ve live verileri birbirine karışmamalıdır.

UI üzerinde testnet botları açıkça işaretlenmelidir:

```text
TESTNET
Gerçek para kullanılmıyor
```

Live moda geçiş için:

* API hesabı live olmalı
* Risk ayarları tamamlanmış olmalı
* Kullanıcı onayı alınmalı
* “Gerçek para ile işlem yapılacaktır” uyarısı gösterilmeli
* Onay kutusu işaretlenmeli
* Admin şifresi veya ikinci onay mekanizması düşünülebilir

Live özelliğini ilk aşamada feature flag ile kapalı tut.

Örnek:

```env
TRADING_LIVE_MODE_ENABLED=false
```

Testler tamamlanmadan live emir gönderimine izin verme.

---

# 20. Veritabanı Modeli

Mevcut ORM ve veritabanı yapısına uygun migration oluştur.

Önerilen tablolar:

## exchange_accounts

* id
* user_id
* tenant_id
* display_name
* exchange
* environment
* account_type
* api_key_masked
* encrypted_api_key
* encrypted_api_secret
* encrypted_passphrase
* encryption_iv
* encryption_tag
* permissions
* is_active
* connection_status
* last_connected_at
* last_sync_at
* created_at
* updated_at
* deleted_at

## bot_instances

* id
* user_id
* exchange_account_id
* name
* bot_type
* symbol
* market_type
* position_mode
* margin_mode
* leverage
* allocated_asset
* allocated_amount
* allocated_percentage
* status
* environment
* started_at
* stopped_at
* last_heartbeat_at
* error_message
* created_at
* updated_at

## bot_configs

* id
* bot_id
* config_version
* strategy_config_json
* risk_config_json
* created_at

Konfigürasyon JSON kullanılabilir ancak raporlama ve sorgulama gereken önemli alanlar normal kolonlarda tutulmalıdır.

## orders

* id
* user_id
* exchange_account_id
* bot_id
* exchange_order_id
* client_order_id
* symbol
* side
* position_side
* order_type
* time_in_force
* quantity
* price
* stop_price
* average_fill_price
* filled_quantity
* remaining_quantity
* reduce_only
* post_only
* status
* source
* environment
* submitted_at
* completed_at
* created_at
* updated_at

## order_events

* id
* order_id
* event_type
* old_status
* new_status
* exchange_payload_json
* message
* occurred_at

Exchange payload saklanırken secret veya hassas veri temizlenmelidir.

## trades

* id
* order_id
* exchange_trade_id
* symbol
* side
* quantity
* price
* commission
* commission_asset
* realized_pnl
* traded_at

## positions

* id
* user_id
* exchange_account_id
* bot_id
* symbol
* position_side
* quantity
* entry_price
* mark_price
* liquidation_price
* leverage
* margin_mode
* isolated_margin
* unrealized_pnl
* realized_pnl
* status
* opened_at
* closed_at
* updated_at

## pnl_snapshots

* id
* user_id
* exchange_account_id
* bot_id
* balance
* wallet_balance
* available_balance
* realized_pnl
* unrealized_pnl
* commission
* funding
* captured_at

## risk_rules

* id
* user_id
* exchange_account_id
* bot_id
* rule_type
* value
* is_active
* created_at
* updated_at

## risk_events

* id
* user_id
* exchange_account_id
* bot_id
* order_id
* event_type
* severity
* message
* payload_json
* created_at

## bot_logs

* id
* bot_id
* level
* category
* message
* metadata_json
* created_at

## audit_logs

* id
* user_id
* action
* entity_type
* entity_id
* before_json
* after_json
* ip_address
* user_agent
* created_at

---

# 21. API Endpointleri

Mevcut backend yapısına uygun REST API veya mevcut standart kullanılmalıdır.

Örnek endpointler:

## Borsa hesapları

```text
GET    /api/admin/trading/exchange-accounts
POST   /api/admin/trading/exchange-accounts
GET    /api/admin/trading/exchange-accounts/:id
PATCH  /api/admin/trading/exchange-accounts/:id
DELETE /api/admin/trading/exchange-accounts/:id
POST   /api/admin/trading/exchange-accounts/detect
POST   /api/admin/trading/exchange-accounts/:id/test
POST   /api/admin/trading/exchange-accounts/:id/sync
GET    /api/admin/trading/exchange-accounts/:id/balances
GET    /api/admin/trading/exchange-accounts/:id/positions
GET    /api/admin/trading/exchange-accounts/:id/orders
```

## Botlar

```text
GET    /api/admin/trading/bots
POST   /api/admin/trading/bots
GET    /api/admin/trading/bots/:id
PATCH  /api/admin/trading/bots/:id
DELETE /api/admin/trading/bots/:id
POST   /api/admin/trading/bots/:id/start
POST   /api/admin/trading/bots/:id/pause
POST   /api/admin/trading/bots/:id/resume
POST   /api/admin/trading/bots/:id/stop
POST   /api/admin/trading/bots/:id/emergency-stop
GET    /api/admin/trading/bots/:id/logs
GET    /api/admin/trading/bots/:id/performance
```

## Manuel emirler

```text
POST   /api/admin/trading/orders/preview
POST   /api/admin/trading/orders
GET    /api/admin/trading/orders
GET    /api/admin/trading/orders/:id
POST   /api/admin/trading/orders/:id/cancel
POST   /api/admin/trading/orders/cancel-all
```

## Pozisyonlar

```text
GET    /api/admin/trading/positions
GET    /api/admin/trading/positions/:id
POST   /api/admin/trading/positions/:id/close
POST   /api/admin/trading/positions/:id/partial-close
POST   /api/admin/trading/positions/:id/take-profit
POST   /api/admin/trading/positions/:id/stop-loss
POST   /api/admin/trading/positions/:id/trailing-stop
```

## Raporlama

```text
GET /api/admin/trading/reports/overview
GET /api/admin/trading/reports/pnl
GET /api/admin/trading/reports/trades
GET /api/admin/trading/reports/fees
GET /api/admin/trading/reports/drawdown
```

Bütün inputlar backend tarafında validation’dan geçirilmelidir.

Para ve miktar hesaplarında JavaScript floating point kullanımından kaçınılmalıdır. Decimal kütüphanesi veya veritabanı decimal alanları kullanılmalıdır.

---

# 22. Exchange Symbol Kuralları

Her parite için borsadan aşağıdaki bilgiler alınmalıdır:

* Symbol
* Base asset
* Quote asset
* Minimum miktar
* Maksimum miktar
* Quantity step
* Tick size
* Minimum notional
* Maksimum kaldıraç
* Risk limitleri
* Emir türleri
* Parite aktif mi
* Reduce-only desteği
* Hedge mode desteği

Emir göndermeden önce:

* Fiyat tick size’a yuvarlanmalı
* Miktar step size’a yuvarlanmalı
* Minimum notional kontrol edilmeli
* Maksimum miktar kontrol edilmeli
* Paritenin işlem açık olduğu doğrulanmalı

Bu değerler hard-code edilmemelidir.

---

# 23. UI/UX Tasarım Gereksinimleri

Mevcut KriptoKeyfi admin panelinin stilini koru.

Yeni modül:

* Kurumsal
* Okunaklı
* Koyu ve açık temaya uyumlu
* Responsive
* Mobilde kullanılabilir
* Tablo yoğunluğunu yönetebilen
* Kritik işlemleri açıkça ayıran
* Renkleri yalnızca anlamlı durumlarda kullanan

olmalıdır.

Durum renkleri:

* Çalışıyor: yeşil
* Bekliyor: mavi
* Duraklatıldı: sarı
* Risk engeli: turuncu
* Hata: kırmızı
* Durduruldu: gri
* Testnet: mor veya belirgin etiket

Kâr ve zarar gösteriminde:

* Pozitif değerler yeşil
* Negatif değerler kırmızı
* Sıfır nötr
* Yalnızca renge güvenme
* `+` ve `-` işaretleri de kullan

Tablolar:

* Arama
* Filtreleme
* Sıralama
* Sayfalama
* Kolon gizleme
* CSV dışa aktarma
* Yenileme
* Canlı güncelleme
* Mobil kart görünümü

desteklemelidir.

---

# 24. Bildirim Sistemi

Aşağıdaki olaylarda uygulama içi bildirim oluştur:

* API bağlantısı kesildi
* API bağlantısı yeniden kuruldu
* Bot başladı
* Bot durdu
* Bot risk nedeniyle durdu
* Emir reddedildi
* Pozisyon açıldı
* Pozisyon kapandı
* Stop-loss çalıştı
* Take-profit çalıştı
* Günlük zarar limitine ulaşıldı
* Günlük hedef kâra ulaşıldı
* Likidasyon fiyatına yaklaşım
* Reconciliation farkı bulundu
* API anahtarının süresi veya yetkisi bozuldu

İleride e-posta, Telegram ve push notification eklenebilecek interface yapısı oluştur.

---

# 25. Sistem Sağlığı ve İzleme

“Sistem Durumu” ekranında aşağıdaki bilgiler gösterilsin:

* Bot engine çalışıyor mu
* Son heartbeat
* Redis bağlantısı
* Veritabanı bağlantısı
* Binance WebSocket durumu
* Bybit WebSocket durumu
* Aktif bot sayısı
* Aktif account stream sayısı
* Kuyrukta bekleyen işlem sayısı
* Reconciliation bekleyen emir sayısı
* Son kritik hata
* Son deploy sürümü
* Live trading açık mı
* Global kill switch aktif mi

Bot heartbeat kaybolursa:

* Bot durumu `CONNECTION_LOST` veya `ERROR` olsun
* Yeni emirler engellensin
* Bildirim oluşturulsun
* Reconciliation başlatılsın

---

# 26. Loglama ve Audit

Bot logları ve audit logları birbirinden ayrılmalıdır.

Bot log kategorileri:

```text
SYSTEM
CONNECTION
STRATEGY
RISK
ORDER
POSITION
RECONCILIATION
ERROR
```

Loglarda şunlar bulunabilir:

* Bot ID
* Kullanıcı ID
* Borsa
* Hesap ID
* Symbol
* Order ID
* Event
* Mesaj
* Timestamp

Loglarda şunlar bulunmamalıdır:

* API secret
* Tam API key
* Passphrase
* Encryption key
* Authorization header
* Kullanıcı şifresi

Audit log tutulması gereken işlemler:

* API hesabı ekleme
* API hesabı güncelleme
* API hesabı silme
* Bot oluşturma
* Bot ayarı değiştirme
* Bot başlatma
* Bot durdurma
* Manuel emir
* Pozisyon kapatma
* Risk ayarı değiştirme
* Kill switch kullanma
* Live trading açma

---

# 27. Hata Yönetimi

Kullanıcıya borsanın ham hata mesajını doğrudan göstermek yerine anlaşılır mesaj göster.

Örnek:

```text
Borsa hatası: -2019
```

yerine:

```text
Emir oluşturulamadı. Kullanılabilir teminat yetersiz.
```

Ancak teknik detay loglarda saklanabilir.

Hata sınıfları:

* Validation error
* Authentication error
* Exchange permission error
* Insufficient balance
* Rate limit
* Network timeout
* WebSocket disconnected
* Order rejected
* Risk rejected
* Symbol unavailable
* Reconciliation required
* Internal error

Retry uygulanabilecek hatalar ile uygulanamayacak hataları ayır.

Emir reddinde kontrolsüz otomatik retry yapma.

---

# 28. Rate Limit Yönetimi

Her borsanın rate limit kuralları adapter seviyesinde yönetilmelidir.

* Ortak rate-limit manager oluştur
* Request ağırlıklarını hesaba kat
* Gereksiz polling yapma
* Mümkün olduğunda WebSocket kullan
* Retry-After değerine uy
* Exponential backoff uygula
* Kullanıcı veya hesap bazında kuyruk oluştur
* Emir işlemlerine raporlama sorgularından daha yüksek öncelik ver
* Rate limit yaklaşırken sistem sağlığı ekranına uyarı yaz

---

# 29. Güvenli Varsayılan Ayarlar

Yeni bot oluştururken güvenli varsayılanlar kullan:

* Testnet varsayılan
* Isolated margin varsayılan
* Düşük kaldıraç varsayılan
* Maksimum 3 açık pozisyon
* Günlük zarar limiti zorunlu
* Stop-loss zorunlu
* Bakiye rezervi minimum %20
* Martingale kapalı
* Otomatik pozisyon artırma kapalı
* Live işlem feature flag ile kapalı
* Açık onay olmadan live bot başlatılamaz

Sistemin hiçbir yerinde kâr garantisi, risksiz kazanç veya sürekli kazanç gibi ifadeler kullanılmamalıdır.

---

# 30. Geliştirme Aşamaları

Çalışmayı tek seferde kontrolsüz şekilde tamamlamaya çalışma. Aşağıdaki fazlara böl.

## Faz 1: Analiz ve temel altyapı

* Mevcut proje analizi
* Authentication ve rol analizi
* Veritabanı analizi
* Trading modülü klasör yapısı
* Exchange adapter interface
* Feature flag
* Admin route koruması

## Faz 2: API hesapları

* Binance testnet
* Bybit demo
* Credential encryption
* Hesap ekleme
* Bağlantı testi
* Bakiye listeleme
* Çoklu API hesabı

## Faz 3: Manuel emirler

* Symbol listesi
* Kaldıraç
* Margin modu
* Emir önizleme
* Manuel emir
* Açık emirler
* Açık pozisyonlar
* İptal ve kapatma

## Faz 4: Gerçek zamanlı sistem

* Market WebSocket
* Account WebSocket
* Emir güncellemeleri
* Pozisyon güncellemeleri
* Frontend canlı tablolar
* Reconnect sistemi

## Faz 5: Risk motoru

* Günlük zarar
* Pozisyon limiti
* Kaldıraç limiti
* Bakiye rezervi
* Kill switch
* Risk eventleri

## Faz 6: Grid bot

* Grid oluşturma
* Önizleme
* Emir yönetimi
* Grid fill sonrası karşı emir
* Grid durdurma
* Aralık dışı davranış

## Faz 7: Scalping bot

* Strategy interface
* Sinyal sistemi
* Komisyon sonrası beklenen net kâr
* TP/SL
* Cooldown
* Günlük limitler

## Faz 8: Raporlama

* PnL
* Komisyon
* Funding
* Bot performansı
* Grafikler
* CSV export

## Faz 9: Live güvenlik

* Live feature flag
* Güçlü onay
* Audit
* Yetki kontrolü
* Failure testleri
* Testnet doğrulama

Her faz sonunda:

* Değiştirilen dosyaları listele
* Migration bilgisini ver
* Environment değişkenlerini belirt
* Çalıştırma komutlarını ver
* Test sonuçlarını paylaş
* Sonraki fazı belirt

---

# 31. Test Gereksinimleri

Aşağıdaki testleri ekle:

## Unit test

* Risk hesaplama
* PnL hesaplama
* Quantity rounding
* Price rounding
* Grid oluşturma
* Kaldıraç validasyonu
* Bakiye rezervi
* Günlük zarar limiti
* Encryption/decryption
* Bot state transition

## Integration test

* Binance testnet bağlantısı
* Bybit demo bağlantısı
* Emir oluşturma
* Emir iptal
* Pozisyon okuma
* WebSocket event işleme
* Reconciliation
* API rol kontrolü

## Failure test

* Borsa cevap vermiyor
* WebSocket kopuyor
* Emir gönderiliyor ancak response kayboluyor
* Duplicate event geliyor
* Rate limit oluşuyor
* Bakiye yetersiz
* API yetkisi yok
* API secret yanlış
* Bot servisi yeniden başlıyor
* Redis bağlantısı kesiliyor
* Veritabanı geçici olarak erişilemiyor

Live hesap üzerinde otomatik test çalıştırma.

---

# 32. Deployment

KriptoKeyfi canlıda çalıştığı için mevcut deployment sürecini bozma.

Yeni servis eklenirse:

* Dockerfile
* Docker Compose servisi
* Healthcheck
* Restart policy
* Environment variables
* Internal network
* Log rotation
* Graceful shutdown

hazırlanmalıdır.

Bot engine kapanırken:

1. Yeni emir kabulünü durdursun.
2. Kuyruktaki işlemleri güvenli şekilde işlesin veya iptal etsin.
3. Açık borsa pozisyonlarını otomatik kapatmasın.
4. Son durumları veritabanına yazsın.
5. WebSocket bağlantılarını kapatsın.
6. Graceful shutdown tamamlasın.

Sunucu yeniden başladığında:

* Önceden çalışan botları bul
* Borsa ile mutabakat yap
* Açık pozisyonları kontrol et
* Açık emirleri kontrol et
* Risk durumunu kontrol et
* Otomatik devam ayarı açıksa devam et
* Aksi durumda `PAUSED` durumuna getir

---

# 33. Environment Değişkenleri

Örnek:

```env
TRADING_MODULE_ENABLED=true
TRADING_LIVE_MODE_ENABLED=false
TRADING_ENGINE_URL=http://trading-engine:8080
TRADING_ENGINE_TOKEN=
TRADING_CREDENTIALS_MASTER_KEY=
TRADING_GLOBAL_KILL_SWITCH=false

BINANCE_TESTNET_BASE_URL=
BINANCE_TESTNET_WS_URL=
BINANCE_LIVE_BASE_URL=
BINANCE_LIVE_WS_URL=

BYBIT_DEMO_BASE_URL=
BYBIT_DEMO_WS_URL=
BYBIT_LIVE_BASE_URL=
BYBIT_LIVE_WS_URL=

REDIS_URL=
```

Gerçek secret değerleri örnek dosyaya yazılmamalıdır.

`.env.example` içinde sadece değişken adları ve açıklamalar bulunmalıdır.

---

# 34. Kod Kalitesi Kuralları

* TypeScript strict mode kullan
* `any` kullanımını minimumda tut
* Controller içinde iş mantığı yazma
* Exchange özel kodlarını ortak servislere karıştırma
* Domain modellerini borsa response modellerinden ayır
* Validation kullan
* Decimal hesaplama kullan
* Transaction gereken işlemlerde DB transaction kullan
* Idempotency uygula
* Unit test ekle
* Anlamlı hata sınıfları kullan
* Secret sanitization ekle
* SOLID prensiplerine uygun hareket et
* Tek bir dosyada devasa servis oluşturma
* Mevcut proje standardını bozma
* Kullanılmayan kod bırakma
* Fake veya hard-coded borsa verisi bırakma
* Testnet ve live kodlarını birbirine karıştırma

---

# 35. İlk Uygulanacak Kapsam

İlk çalışmada doğrudan bütün bot stratejilerini canlıya alma.

Öncelikli olarak aşağıdaki temel altyapıyı tamamla:

1. Admin-only Trading Bot menüsü
2. Borsa hesapları ekranı
3. Birden fazla API hesabı ekleme
4. Binance Futures testnet adapter
5. Bybit demo adapter
6. API credential şifreleme
7. API bağlantı testi
8. Bakiye görüntüleme
9. Futures parite listesi
10. Borsanın izin verdiği kaldıraçları görüntüleme
11. Manuel emir önizleme
12. Testnet manuel emir
13. Açık emirler
14. Açık pozisyonlar
15. Emir iptal
16. Pozisyon kapatma
17. Audit log
18. Risk motorunun temel sürümü
19. Global kill switch
20. WebSocket canlı güncelleme

Bu temel yapı güvenli ve stabil hale geldikten sonra Grid Bot ve Scalping Bot modüllerine geç.

---

# 36. Kabul Kriterleri

Çalışma aşağıdaki kriterler sağlanmadan tamamlanmış sayılmayacaktır:

* Admin olmayan kullanıcı modüle erişemiyor.
* API secret frontend’e hiçbir endpoint üzerinden dönmüyor.
* Birden fazla borsa hesabı eklenebiliyor.
* Binance testnet bağlantısı doğrulanabiliyor.
* Bybit demo bağlantısı doğrulanabiliyor.
* Bağlı hesapların bakiyeleri görüntülenebiliyor.
* İlgili borsanın sembol ve kaldıraç limitleri dinamik geliyor.
* Manuel test emri açılabiliyor.
* Açık emir canlı listeleniyor.
* Açık pozisyon canlı listeleniyor.
* Emir iptal edilebiliyor.
* Pozisyon reduce-only ile kapatılabiliyor.
* Duplicate emir koruması çalışıyor.
* WebSocket kopunca reconnect oluyor.
* Sunucu yeniden başlayınca reconciliation çalışıyor.
* Günlük zarar limiti yeni emirleri engelliyor.
* Kill switch yeni emirleri tamamen durduruyor.
* Bütün kritik işlemler audit loga yazılıyor.
* Testnet ve live işlemler birbirinden ayrılıyor.
* Live emir özelliği varsayılan olarak kapalı geliyor.
* Mevcut KriptoKeyfi özellikleri bozulmuyor.
* Mevcut frontend tasarım dili korunuyor.
* Masaüstü ve mobil görünüm düzgün çalışıyor.
* Migration ve deployment dokümantasyonu hazırlanıyor.

---

# Son Talimat

Öncelikle mevcut repository’yi analiz et ve aşağıdakileri raporla:

1. Mevcut frontend teknolojileri
2. Mevcut backend teknolojileri
3. Authentication ve rol sistemi
4. Veritabanı ve ORM
5. WebSocket altyapısı
6. Deployment yapısı
7. Yeni trading modülü için önerilen klasör yapısı
8. Değiştirilecek ve oluşturulacak dosyalar
9. Güvenlik riskleri
10. Uygulama fazları

Ardından Faz 1’den başlayarak kodlamaya geç.

Mevcut çalışan yapıyı silme veya gereksiz yere yeniden oluşturma. Her değişiklikten önce ilgili mevcut dosyayı incele. Tahmin ederek dosya veya endpoint üretme. Projedeki gerçek yapıya göre entegrasyon yap.

Gerçek para ile işlem özelliğini hemen açma. Önce testnet ve demo ortamında bütün emir, risk, WebSocket, reconnect ve reconciliation işlemlerini doğrula.

Bu modülün temel prensibi “sürekli emir göndermek” değil; güvenli, denetlenebilir, maliyetleri hesaba katan, kullanıcı müdahalesine açık ve borsa ile her zaman mutabakat sağlayan bir işlem altyapısı kurmaktır.

