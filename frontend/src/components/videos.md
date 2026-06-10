Kripto Keyfi projemde “Video İçerikler / Video Merkezi” sayfası şu an boş. Bu sayfayı gelişmiş, modern ve kullanıcıyı platformda tutan bir video merkezi haline getir.

Amaç:
Kullanıcı bu sayfaya girdiğinde YouTube’dan çekilen kripto, blockchain, Web3 ve yazılım içeriklerini keşfedebilsin, izleyebilsin, filtreleyebilsin, favorilere ekleyebilsin, daha sonra izleme listesine alabilsin ve video detayında yorum yapabilsin.

Bu bölüm YouTuber yönetim paneli olmayacak. YouTuber başvuru, kanal doğrulama, kanal bağlama gibi işlemler ayrı ayarlar/admin bölümünde yönetilecek. Bu sayfa sadece son kullanıcıya yönelik video izleme ve keşif sayfası olacak.

İstenen yapı:

1. Video Merkezi ana sayfası oluştur.
   Başlık:
   “Kripto Keyfi Video Merkezi”

Alt açıklama:
“Kripto, blockchain, Web3, DeFi, smart contract ve yazılım dünyasından seçilmiş video içerikleri tek yerde.”

2. Üst bölümde arama alanı olsun.
   Placeholder:
   “Video, kanal veya konu ara...”

3. Kategori filtreleri ekle:

* Tümü
* Haber
* Teknik Analiz
* Eğitim
* Web3
* Blockchain
* Smart Contract
* Güvenlik
* DeFi
* Airdrop
* Shorts

4. Sayfanın üst kısmında “Trend İçerikler” bölümü olsun.
   Son 24 saat veya son dönem öne çıkan videolar burada yatay kartlarla gösterilsin.

5. Ana video listesi grid yapıda olsun.
   Her video kartında şunlar görünsün:

* YouTube thumbnail
* Video süresi
* Başlık
* Kanal adı
* Kanal profil resmi
* Doğrulanmış içerik üreticisi rozeti
* Yayın tarihi
* Görüntülenme sayısı
* Kategori etiketi
* Shorts ise “Shorts” etiketi
* Favorilere ekle butonu
* Daha sonra izle butonu

6. Video kartına tıklayınca video detay sayfasına gidilsin.

7. Video detay sayfasında sol ana alanda:

* YouTube embed player
* Video başlığı
* Kanal bilgisi
* Doğrulanmış rozet
* Yayın tarihi
* Görüntülenme sayısı
* Video açıklaması
* “Devamını göster” / “Daha az göster” mantığı
* Etiketler
* Favorilere ekle
* Daha sonra izle

8. Video detay sayfasında sağ tarafta öneri alanı olsun:

* Benzer videolar
* Aynı kanalın diğer videoları
* Aynı kategorideki videolar

9. Kripto Keyfi yorum alanı ekle.
   YouTube yorumları çekilmesin. Platformun kendi yorum sistemi olsun.
   Yorum bölümünde:

* Yorum yazma alanı
* Yorum listesi
* Kullanıcı adı
* Tarih
* Beğen butonu
* Yanıtla butonu
* Boş yorum durumu
* Giriş yapmamış kullanıcıya “Yorum yapmak için giriş yapmalısınız” uyarısı

10. AI Video Özeti alanı ekle.
    Şimdilik mock data ile çalışabilir.
    Video detayında şu bloklar olsun:

* AI Özeti
* Ana başlıklar
* Önemli dakikalar

Örnek:
AI Özeti:
“Bu videoda Ethereum ETF gelişmeleri, kurumsal yatırımcı ilgisi ve piyasa beklentileri ele alınıyor.”

Ana başlıklar:

* Ethereum ETF etkisi
* Kurumsal yatırımcı ilgisi
* 2026 piyasa beklentileri

Önemli dakikalar:

* 00:45 ETF nedir?
* 05:22 BlackRock etkisi
* 12:10 Ethereum beklentileri

11. Kullanıcı özellikleri:

* Favorilere ekleme
* Daha sonra izle
* İzleme listem sayfası veya sekmesi
* Takip edilen kanallar sekmesi
* Shorts sekmesi

12. Kanal profil sayfası tasarla.
    Kanal sayfasında:

* Kanal kapak alanı
* Profil resmi
* Kanal adı
* Doğrulanmış içerik üreticisi rozeti
* Açıklama
* YouTube kanalına git butonu
* Abone sayısı
* Toplam video sayısı
* Son videolar
* Shorts
* Kategoriler
* Takip et butonu

13. Tasarım dili:
    Modern, koyu tema uyumlu, kripto/Web3 hissi veren, mobil uyumlu, kart tabanlı ve kullanıcı dostu olsun.
    Mevcut Kripto Keyfi tasarım yapısına uyumlu çalışsın.
    Responsive olsun:

* Desktop: sol ana alan + sağ öneriler
* Tablet: iki kolon
* Mobil: tek kolon, sticky olmayan sade yapı

14. Şimdilik backend yoksa mock data kullan.
    Ama kodu backend’e kolay bağlanacak şekilde hazırla.
    Mock data yapısı şu alanları içersin:

* id
* youtubeVideoId
* title
* description
* thumbnailUrl
* duration
* channelName
* channelAvatar
* channelVerified
* publishedAt
* viewCount
* category
* tags
* isShort
* aiSummary
* aiTopics
* aiTimestamps
* comments

15. Kod kalitesi:

* Component yapısı temiz olsun.
* Tekrarlayan kartlar component’e ayrılsın.
* VideoCard
* VideoGrid
* VideoFilters
* TrendingVideos
* VideoDetail
* RelatedVideos
* CommentSection
* AiSummaryBox
* ChannelProfile
* WatchLater/Favorites mantığı için localStorage kullanılabilir.
* Hata durumları ve boş liste durumları gösterilsin.
* Loading skeleton eklenebilirse ekle.

16. Rota yapısı:
    Mevcut projeye uygun şekilde oluştur.
    Önerilen rotalar:

* /videos
* /videos/:id
* /videos/category/:category
* /creators/:creatorSlug
* /watch-later
* /favorites

17. Ekstra UX detayları:

* Arama gerçek zamanlı filtreleme yapsın.
* Kategori seçilince aktif kategori belirginleşsin.
* Shorts içerikleri dikey thumbnail hissi versin.
* Favori ve daha sonra izle butonlarında aktif/pasif durum görünsün.
* Video detayından geri dön butonu olsun.
* Kullanıcı siteden çıkmadan embed üzerinden videoyu izleyebilsin.

18. Önemli:
    Bu sayfada YouTuber başvuru veya kanal bağlama işlemi olmayacak.
    Sadece kullanıcıya açık video keşif, izleme, yorum ve takip deneyimi olacak.
    Admin/creator yönetimi daha sonra ayrı modül olarak yapılacak.

Lütfen bu özellikleri mevcut proje yapısını bozmadan uygula. Varsa mevcut routing, layout, theme ve component yapısına uygun geliştir. Eksik paket gerekiyorsa önce belirt, mümkünse mevcut yapıyla çöz.
