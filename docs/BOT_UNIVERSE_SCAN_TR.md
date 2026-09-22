# Her botun tüm coinleri değerlendirmesi

DEMO modundaki otonom botlar, kullanıcıya ait etkin `trading_universe_assets` listesini bağımsız olarak tarar. Her değerlendirmede bir parite seçilir; botun stratejisi, kimliği ve performans hesabı korunur. 20 bot × 20 parite = tam turda 400 bot–parite değerlendirmesi.

- Sıra `lastAnalyzedUniverseSymbol` alanıyla bot bazında saklanır. Yeniden başlatmada devam eder; silinen/devre dışı bırakılan coinler sonraki seçimde dikkate alınır.
- Mevcut 24 saniyelik bot aralığında tam tur teorik olarak yaklaşık 8 dakikadır. Ağ, çalışma kuyruğu veya veri hataları süreyi uzatabilir. Sıra, değerlendirme hatasında da ilerler; diğer pariteler engellenmez.
- Önceki fiyat bot ve pariteyle birlikte sorgulanır. BTC fiyatı ETH için referans olarak kullanılmaz. Karar ve sinyal kayıtları değerlendirilen paritenin gerçek sembolünü taşır.
- Botun eski `symbol` alanı kilit kontrolü ve eski entegrasyonlar için korunur; artık analizin tek paritesi değildir. Ekranda bu eski alanı gösteren bot adı/parite etiketi tarama kapsamını temsil etmez.
- Backend universe worker DEMO botları durdurup tek pariteye döndürmez. Yapılandırma güncellemesi sürüm kontrolüyle yapılır; Go'nun tarama imleci eski bir yapılandırmayla ezilmez.
- Emirler mevcut giriş izni ve risk kontrollerinden geçer. Takip açıkken botun koruma emirleriyle sahipliği doğrulanan diğer coin pozisyonları da korunur. Botun diğer pozisyonlarına ayrılmış bütçe yeni giriş hesabından düşülür. Başka botların veya manuel işlemlerin pozisyonlarına otomatik ekleme yapılmaz.
- Tek seferlik eski manuel bot talimatı/manuel pozisyon kontrolü varsa onun paritesi korunur. Yeni tekli/toplu manuel işlem akışları değiştirilmez. PAPER muhasebesi bu değişikliğin dışındadır.

Uygulama için backend ve Go Trading Engine yeni kodla yeniden başlatılmalıdır. Bu çalışma motoru yeniden başlatmaz, otomatik girişleri açmaz ve borsaya test emri göndermez. Coin için borsadan gerekli mum verisi alınamıyorsa karar uydurulmaz; hata kaydedilir ve sıra ilerler.
