Kripto Keyfi projemde mevcut Chat ekranını geliştirmeni istiyorum. Şu an tasarım olarak modern, koyu temalı, Discord/Telegram tarzı bir chat ekranı var. Ancak bu ekranı sıradan bir sohbet alanı olmaktan çıkarıp Kripto Keyfi ekosistemine bağlı, kripto odaklı akıllı topluluk merkezi haline getirmek istiyorum.

Amaç:
Chat ekranı sadece mesajlaşma alanı olmasın. Kullanıcılar burada coin konuşabilsin, haberleri görebilsin, video/akademi içeriklerine yönlenebilsin, faydalı mesajlar öne çıkabilsin ve kriptoya özel akıllı kartlar oluşsun.

Mevcut tasarım dilini bozma:

* Koyu tema korunsun
* Sol kanal listesi kalsın
* Orta chat alanı kalsın
* Sağ bilgi paneli kalsın
* Alt market ticker varsa bozulmasın
* Responsive yapı korunmalı
* Mevcut navbar korunmalı

1. Coin Mention Sistemi ekle

Kullanıcı mesaj içinde şu formatları yazınca:

* $BTC
* $ETH
* $SOL
* $ARB
* $AVAX

Mesaj altında otomatik küçük coin kartı oluşsun.

Coin kartında:

* Coin sembolü
* Coin adı
* Fiyat
* 24s değişim
* Mini trend durumu
* “Detaya git” butonu

Şimdilik mock data kullanılabilir. Daha sonra gerçek coin API bağlanacak şekilde service yapısı hazır olsun.

Örnek dosya:
coinService.js

Fonksiyonlar:

* getCoinBySymbol(symbol)
* getMentionedCoins(messageText)

2. Sağ paneli geliştir

Mevcut Active Users alanı sade kalabilir ama sağ panel daha değerli hale gelsin.

Sağ panelde şu kutular olsun:

* Market Highlights
* Son Dakika Haberleri
* Whale Feed
* Trend Etiketler
* AI Asistan kısa kutusu

3. Son Dakika Haberleri kutusu

Blog/Haber Merkezi ile bağlantılı çalışacak şekilde tasarla.

Şimdilik mock data kullan:

* Başlık
* Kategori
* Zaman
* Habere git butonu

Örnek:
“Bitcoin ETF girişlerinde artış”
“Ethereum Layer-2 işlem hacmi yükseldi”
“Büyük borsadan yeni listeleme duyurusu”

Tıklanınca ileride /blog/:slug sayfasına gidecek şekilde yapı hazır olsun.

4. Whale Feed kutusu

Sağ panelde “Whale Feed” alanı oluştur.

Mock örnekler:

* 500 BTC Binance’e aktarıldı
* 2M USDT yeni cüzdana taşındı
* 1200 ETH stake edildi
* 8M USDC Arbitrum’a bridge edildi

Alanlar:

* İşlem tipi
* Coin
* Miktar
* Ağ
* Zaman
* Risk/önem etiketi

Şimdilik tamamen mock çalışabilir.

5. YouTube link preview sistemi

Kullanıcı chat içinde YouTube linki paylaşırsa mesaj altında video önizleme kartı oluşsun.

Kartta:

* Thumbnail
* Video başlığı
* Kanal adı
* Süre
* “Video Merkezi’nde İzle” butonu

Şimdilik YouTube linkini regex ile yakala.
Gerçek API yoksa mock preview üret.
Daha sonra Video Merkezi ile entegre edilecek şekilde yapı kur.

6. Akademi içerik önerisi

Kullanıcı mesajda bazı anahtar kelimeleri yazınca akademi içerik öneri kartı göster.

Örnek anahtar kelimeler:

* ERC4337
* Account Abstraction
* Smart Contract
* Solidity
* Reentrancy
* tx.origin
* Layer-2
* Rollup
* DeFi
* Wallet Security

Mesaj altında küçük “Akademi Önerisi” kartı göster.

Kartta:

* İçerik başlığı
* Kısa açıklama
* Okuma süresi
* “Oku” butonu

Tıklanınca ileride /academy/articles/:slug sayfasına gidecek.

7. AI Asistan kutusu

Sağ panelde küçük AI Asistan alanı olsun.

Başlık:
“Kripto Keyfi AI”

Alt açıklama:
“Piyasa, Web3, smart contract ve güvenlik hakkında hızlı soru sor.”

Input placeholder:
“ERC-4337 nedir?”

Buton:
“Sor”

Şimdilik mock cevap gösterilebilir.
Backend/AI entegrasyonu sonra yapılacak şekilde component hazır olsun.

8. Mesaj reaksiyonları ekle

Her mesajda hover durumunda şu reaksiyonlar görünsün:

* 👍 Faydalı
* 🔥 Kaliteli analiz
* 💎 Alpha
* 🛡️ Güvenlik uyarısı

Kullanıcı tıklayınca mesaj altında küçük reaction count görünsün.
Şimdilik local state veya localStorage kullanılabilir.

9. Kullanıcı rozetleri ve seviyeleri

Kullanıcı adının yanında seviye/rol etiketi göster.

Örnek roller:

* Yeni Üye
* Trader
* Analist
* Whale
* Blockchain Developer
* Güvenlik Uzmanı
* Akademi Eğitmeni
* Moderator

Mesajlarda ve sağ aktif kullanıcı listesinde görünsün.

10. Kanal yapısını geliştir

Sol panelde kanal grupları olsun.

Önerilen yapı:

Piyasalar:

* Global Stream
* Bitcoin
* Ethereum
* Altcoin
* DeFi

Teknik:

* Solidity
* Smart Contract Security
* Layer-2
* Developer Hub

Akademi:

* Yeni Başlayanlar
* Web3 Kariyer
* Eğitim Soruları

Topluluk:

* Proje Tanıtımı
* Airdrop
* Güvenlik Uyarıları

Mevcut kanallar bozulmadan bu yapı mock olarak eklenebilir.

11. Wallet adresi algılama

Kullanıcı mesajda EVM wallet adresi paylaşırsa sistem bunu yakalasın.

Regex:
0x ile başlayan 42 karakterlik adresler.

Mesaj altında “Wallet Analizi” kartı oluşsun.

Kartta:

* Kısaltılmış adres
* Ağ: Ethereum / EVM
* İlk işlem: mock
* Toplam işlem: mock
* Risk puanı: mock
* “Detaylı Analiz” butonu

Şimdilik mock data.
İleride Wallet Intelligence modülüne bağlanacak.

12. Link preview yapısı

Sadece YouTube değil, genel linkler için de basit preview component oluştur.

Alanlar:

* Başlık
* Domain
* Açıklama
* Görsel varsa görsel

Şimdilik mock veya basit domain parse yeterli.

13. Mesaj oluşturma alanını geliştir

Alt input alanında:

* Mesaj yaz
* Emoji butonu
* Görsel ekle ikonu
* Link ekle
* Kod bloğu ekle
* Coin sembolü önerisi

Kod bloğu paylaşımı korunmalı.

14. Coin autocomplete

Kullanıcı $ yazınca basit öneri dropdown göster:

* BTC
* ETH
* SOL
* AVAX
* ARB
* BNB
* XRP

Seçince mesaja $BTC gibi eklensin.

15. Empty state ve loading state

Her bölüm için boş durum hazırla:

* Henüz mesaj yok
* Haber bulunamadı
* Whale feed şu an boş
* Kullanıcı bulunamadı

Loading skeleton mümkünse ekle.

16. Component yapısı temiz olsun

Önerilen componentler:

* ChatPage
* ChatSidebar
* ChatChannelList
* ChatMessageList
* ChatMessage
* MessageInput
* CoinMentionCard
* YouTubePreviewCard
* AcademySuggestionCard
* WalletPreviewCard
* LinkPreviewCard
* MessageReactions
* ChatRightPanel
* MarketHighlights
* BreakingNewsWidget
* WhaleFeedWidget
* TrendingTagsWidget
* AiAssistantBox
* ActiveUsersList
* UserBadge
* EmptyState

17. Mock data yapısı oluştur

Mock user:

* id
* name
* avatar
* role
* badge
* isOnline
* reputation

Mock message:

* id
* userId
* channelId
* text
* createdAt
* reactions
* attachments
* detectedCoins
* detectedLinks
* detectedWallets
* academySuggestions

Mock coin:

* symbol
* name
* price
* change24h
* marketCap
* trend

Mock news:

* id
* title
* slug
* category
* publishedAt

Mock whale:

* id
* type
* asset
* amount
* network
* time
* importance

18. Rota veya mevcut sayfa

Mevcut Chat sayfası hangi rotadaysa onu geliştir.
Muhtemelen:
/chat

Ek rota açmaya gerek yok.
Ama kartlardaki butonlar ileride şu sayfalara yönlenebilecek şekilde hazırlanmalı:

* /blog/:slug
* /videos/:id
* /academy/articles/:slug
* /wallet/:address
* /coins/:symbol

19. API hazırlığı

Şimdilik frontend mock data ile çalışabilir.
Ama servis yapısı gerçek API’ye bağlanmaya hazır olsun.

Önerilen service dosyaları:

* chatService.js
* coinService.js
* newsService.js
* whaleService.js
* academyService.js
* aiService.js

API key gerektiren hiçbir şeyi frontend’e gömme.
Backend hazır olunca bu servisler backend endpointlerine bağlanacak.

20. Önemli notlar

* Bu aşamada gerçek socket.io entegrasyonu zorunlu değil.
* Gerçek zamanlı yapı yoksa mock mesajlar ve local state yeterli.
* Tasarım mevcut ekranla uyumlu olmalı.
* Mevcut çalışan yapıyı bozma.
* Kod tekrarını azalt.
* Mobil uyumluluğu unutma.
* Sağ panel mobilde alta insin.
* Sol kanal paneli mobilde drawer/menü mantığıyla açılabilir.

Bu geliştirme sonucunda Chat ekranı sıradan sohbet alanı olmaktan çıkıp Kripto Keyfi’nin haber, akademi, video, coin ve wallet intelligence modülleriyle bağlantılı akıllı topluluk merkezine dönüşmeli.
