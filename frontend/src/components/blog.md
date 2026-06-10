Kripto Keyfi projemde mevcut Blog sayfasını geliştirmeni istiyorum. Şu an Blog sayfasında sade bir hero alanı, kategori filtreleri ve örnek blog kartları var. Bu yapıyı haber odaklı, modern, güncel kripto haberlerini öne çıkaran gelişmiş bir “Kripto Haber Merkezi”ne dönüştür.

Amaç:
Bu sayfa klasik blog sayfası değil, kullanıcıların kripto piyasasındaki güncel haberleri, piyasa gelişmelerini, analizleri, güvenlik uyarılarını ve önemli ekosistem haberlerini takip edeceği haber merkezi olacak.

Sayfa adı:
“Kripto Keyfi Haber Merkezi”

Alt açıklama:
“Bitcoin, Ethereum, altcoinler, DeFi, Web3, regülasyonlar ve piyasa gelişmelerinden en güncel haberler.”

Mevcut tasarım dilini bozma:

* Koyu tema
* Modern Web3 görünüm
* Kart yapısı
* Responsive tasarım
* Üst navbar ve genel layout korunmalı
* Mevcut ticker / piyasa şeridi varsa bozulmamalı

1. Üst kategori filtrelerini geliştir:

* Tümü
* Bitcoin
* Ethereum
* Altcoin
* DeFi
* Web3
* Borsa Haberleri
* Regülasyon
* Güvenlik
* Analiz
* Eğitim
* NFT
* Yapay Zeka

2. Sayfanın en üstünde güçlü bir haber hero alanı olsun.
   Hero bölümünde:

* Günün öne çıkan haberi
* Büyük kapak görseli
* Kategori etiketi
* Okuma süresi
* Başlık
* Kısa açıklama
* Yayın tarihi
* Kaynak / yazar bilgisi
* “Haberi Oku” butonu

3. Hero alanının yanında veya altında “Son Dakika” / “Breaking News” şeridi olsun.
   Bu alanda kısa haber başlıkları yatay kayan şekilde gösterilebilir.
   Örnek:

* Bitcoin ETF girişlerinde artış
* Ethereum Layer-2 ağlarında işlem hacmi yükseldi
* Büyük borsadan yeni listeleme duyurusu

4. Ana içerik bölümleri:
   A) Son Haberler
   B) Öne Çıkan Haberler
   C) Piyasa Analizleri
   D) Güvenlik Uyarıları
   E) Regülasyon Haberleri
   F) Web3 & Blockchain Gelişmeleri
   G) Editörün Seçtikleri

5. Haber kartlarında şu bilgiler yer alsın:

* Kapak görseli
* Kategori
* Başlık
* Kısa açıklama
* Yayın tarihi
* Okuma süresi
* Kaynak / yazar
* Görüntülenme sayısı
* Etiketler
* Kaydet butonu
* Paylaş butonu

6. Haber detay sayfası oluştur veya mevcut detay sayfasını geliştir.
   Haber detayında:

* Başlık
* Alt açıklama
* Kapak görseli
* Kategori
* Yayın tarihi
* Güncellenme tarihi
* Kaynak / yazar bilgisi
* Okuma süresi
* İçerik
* Etiketler
* Paylaş butonları
* Kaydet butonu
* İlgili haberler
* Aynı kategoriden haberler
* Yorum alanı

7. Haber detayında kullanıcı deneyimi:

* Okuma ilerleme çubuğu
* Sağ tarafta ilgili haberler
* Mobilde tek kolon
* İçerik okunabilir font ve satır aralığıyla gösterilsin
* Uzun metinlerde başlık ayrımları net olsun

8. Yorum alanı:
   Kendi yorum sistemimiz olacak.
   YouTube veya dış yorum sistemi kullanılmayacak.
   Şimdilik mock/local yorum yapısı olabilir.

Yorum alanında:

* Yorum yazma kutusu
* Yorum listesi
* Kullanıcı adı
* Tarih
* Beğen
* Yanıtla
* Giriş yapılmamışsa “Yorum yapmak için giriş yapmalısınız” mesajı

9. Arama alanı ekle:
   Placeholder:
   “Haber, coin, konu veya etiket ara...”

Arama şu alanlarda filtreleme yapsın:

* Başlık
* Açıklama
* Kategori
* Etiketler
* Kaynak / yazar

10. Etiket sistemi:
    Örnek etiketler:

* Bitcoin
* Ethereum
* ETF
* DeFi
* Layer-2
* Binance
* Coinbase
* SEC
* Hack
* Rug Pull
* Airdrop
* Solana
* XRP
* Tokenomics
* Web3
* AI

Etikete tıklanınca ilgili haberler filtrelensin.

11. Sağ sidebar alanı ekle.
    Desktop görünümde sağ tarafta şu kutular olabilir:

* En Çok Okunan Haberler
* Son Dakika
* Popüler Etiketler
* Editörün Seçtikleri
* Haftalık Bültene Katıl

Mobilde bu alanlar ana içerik altına insin.

12. Newsletter / bülten kutusu ekle:
    Başlık:
    “Haftalık Kripto Özeti”

Açıklama:
“Haftanın en önemli kripto haberlerini, analizlerini ve güvenlik uyarılarını e-posta kutuna al.”

Alan:
E-posta adresi

Buton:
“Abone Ol”

Şimdilik frontend mock çalışabilir.

13. Güncel haber API yapısı için hazırlık yap.
    Şu an backend hazır değilse mock data kullan.
    Ama kod yapısı gerçek API’ye bağlanmaya uygun olsun.

Frontend tarafında mümkünse service/helper dosyası oluştur:

* newsService.js veya newsApi.js

İçinde şimdilik mock data döndür.
İleride backend bağlandığında aynı fonksiyon gerçek API’den veri çeksin.

Örnek fonksiyonlar:

* getLatestNews()
* getFeaturedNews()
* getNewsBySlug(slug)
* getNewsByCategory(category)
* searchNews(query)
* getTrendingNews()

14. Eğer frontend tarafında doğrudan haber API bağlantısı güvenli ve mantıklıysa yapı buna hazır olabilir ama API key gerektiren servislerde API key frontend’e gömülmesin.
    API key gerekiyorsa bunu backend tarafına bırak.
    Şimdilik mock data ile geliştir.
    Backend aşamasında gerçek haber API entegrasyonu yapılacak şekilde yapı kur.

15. Mock haber verisi oluştur.
    Mock data gerçekçi ve kripto odaklı olsun.

Alanlar:

* id
* slug
* title
* excerpt
* content
* coverImage
* category
* tags
* authorName
* authorAvatar
* sourceName
* sourceUrl
* publishedAt
* updatedAt
* readingTime
* viewCount
* isFeatured
* isBreaking
* isEditorPick
* comments

16. Mock haber kategorileri:

* Bitcoin
* Ethereum
* Altcoin
* DeFi
* Web3
* Regülasyon
* Güvenlik
* Analiz
* Borsa Haberleri
* NFT
* Yapay Zeka

17. Örnek haber başlıkları üret:

* Bitcoin ETF Girişleri Piyasada Yeni Beklenti Oluşturdu
* Ethereum Layer-2 Ağlarında İşlem Hacmi Artıyor
* DeFi Protokollerinde Güvenlik Riskleri Yeniden Gündemde
* SEC Kararı Sonrası Kripto Piyasasında Volatilite Arttı
* Büyük Borsadan Yeni Altcoin Listeleme Duyurusu
* Web3 Oyun Projelerinde Yeni Fonlama Dalgası
* Cüzdan Güvenliği: Phishing Saldırıları Neden Artıyor?

18. Kullanıcı özellikleri:

* Haberi kaydet
* Daha sonra oku
* Paylaş
* Okundu olarak işaretle
* Kaydedilen haberler için localStorage kullanılabilir

19. Component yapısı:
    Kod temiz ve component bazlı olsun.

Önerilen componentler:

* BlogPage veya NewsPage
* NewsHero
* CategoryTabs
* BreakingNewsTicker
* NewsSearch
* FeaturedNews
* LatestNewsGrid
* NewsCard
* NewsSidebar
* TrendingNews
* PopularTags
* NewsletterBox
* NewsDetail
* RelatedNews
* CommentSection
* EmptyState
* LoadingSkeleton

20. Rota yapısı:
    Mevcut routing sistemine uygun ilerle.
    Önerilen rotalar:

* /blog
* /blog/:slug
* /blog/category/:category
* /blog/tag/:tag
* /saved-news

21. SEO yapısı:
    Her haber detay sayfası ayrı slug ile açılmalı.
    Title ve description yapısı ileride backend/SEO için uygun olmalı.

22. Responsive tasarım:
    Desktop:

* Ana haber alanı + sağ sidebar

Tablet:

* İki kolon

Mobil:

* Tek kolon
* Kategori filtreleri yatay kaydırmalı
* Haber kartları sade ve okunabilir

23. Önemli:
    Bu sayfa Akademi sayfası değil.
    Akademi daha çok eğitim, rehber ve uzun okuma içerikleri için olacak.
    Blog sayfası ise haber, gündem, piyasa gelişmeleri ve kısa/orta analiz içerikleri için kullanılacak.

24. Admin panel veya haber ekleme paneli yapma.
    Bu sayfa sadece son kullanıcıya açık haber okuma ve keşif sayfası olacak.

Lütfen mevcut proje yapısını bozmadan, var olan tema ve layout ile uyumlu şekilde bu Blog sayfasını gelişmiş Kripto Haber Merkezi’ne dönüştür.
