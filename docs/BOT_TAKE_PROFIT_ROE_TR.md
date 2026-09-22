# Bot kâr hedefi: ROE

AI Trading Pro bot işlem ayarlarındaki `takeProfitBps`, TESTNET profili kullanan otonom botlarda komisyon/funding öncesi teminat getirisidir. 300 bps = %3 ROE. Fiyat hareketi hedefi = ROE / gerçek kaldıraç; 10x'te %0,3, 20x'te %0,15.

Strateji planı, güvenlik nedeniyle düşürülmüş olabilen nihai kaldıracı kullanır. Açık pozisyonun koruması ve ek giriş sonrası hesaplama borsadan okunan gerçek kaldıraç ve ortalama giriş fiyatını kullanır. Önceden dönüştürülmüş plan yüzdesi ikinci kez bölünmez. ROE hedefine eski net fiyat hedefinin maliyet tamponu eklenmez. Fiyat adımı, kayma ve ücretler gerçekleşen sonucu etkileyebilir.

Stop-loss fiyat hareketi olarak kalır. Tekli/toplu manuel emir akışları değiştirilmedi; manuel pozisyon talimatları fiyat hedefini korur. PAPER eğitim hedefleri değişmedi.

Değişiklik Go Trading Engine yeniden başlatıldığında etkinleşir. Motorun yönettiği mevcut bot pozisyonlarının kâr hedefleri de sonraki koruma kontrolünde yeni hesaba geçer; aşılmış hedeflerde kapatma gerçekleşebilir. Bu çalışma sırasında motor yeniden başlatılmadı veya borsaya emir gönderilmedi.

Mevcut hesap hedefi 200 bps idi; sayı otomatik değiştirilmedi. %3 ROE isteyen kullanıcı ayarı 300 bps olarak kaydetmelidir.
