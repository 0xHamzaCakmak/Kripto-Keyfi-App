Kripto Keyfi projemde mevcut “My Assets” sayfası ve sağ üstte cüzdan/profil alanına tıklayınca açılan kullanıcı profil ekranını geliştirmek istiyorum. Şu an My Assets daha çok portföy takibi gibi çalışıyor; profil ekranında ise cüzdan, KYC, 2FA, başarımlar ve güvenlik bilgileri var. Bu yapıyı Kripto Keyfi’nin yeni modülleriyle uyumlu, profesyonel bir “Kullanıcı Kimliği + Portföy + Creator Dashboard” merkezine dönüştür.

Genel amaç:
Kripto Keyfi artık sadece portföy takip sitesi değil. Platformda şu bölümler olacak:

* Blog / Haber Merkezi
* Akademi / Eğitim Merkezi
* Video Merkezi
* Chat / Topluluk
* Ecosystem / Web3 Araç Merkezi
* Token Launchpad
* Wallet / My Assets
* Creator Dashboard
* Public Profile

Bu yüzden kullanıcı sistemi sadece “normal kullanıcı” mantığında kalmamalı. Kullanıcılar farklı rollerle sisteme dahil olabilmeli:

* Normal User
* Creator / YouTuber
* Author / Akademi Yazarı
* Project Owner / Launchpad veya Ecosystem proje sahibi
* Developer
* Security Researcher
* Moderator
* Admin

Önemli:
Bu roller kullanıcıya kendiliğinden verilmemeli. Creator, Author, Project Owner, Developer gibi yetkiler admin onayı olmadan aktif olmamalı. Şimdilik frontend tarafında mock/onay bekliyor mantığı kurulabilir. Gerçek yetki sistemi backend tarafında sonra bağlanacak.

1. Sağ üst cüzdan/profil alanını geliştir

Mevcut sağ üstte görünen wallet butonuna tıklayınca açılan alan daha kapsamlı bir “Account Center” gibi çalışsın.

Açılır menüde şunlar olsun:

* Kullanıcı adı
* Kısa wallet adresi
* Avatar
* Trust Score
* Reputation Score
* Aktif roller
* Public Profile’a git
* My Assets
* Creator Dashboard
* Author Dashboard
* Project Dashboard
* Developer Dashboard
* Settings
* Security
* Sign Out

Ancak:
Creator Dashboard, Author Dashboard, Project Dashboard gibi menüler sadece ilgili rol onaylıysa aktif görünsün.
Onaylı değilse:
“Başvuru yap” veya “Onay bekleniyor” etiketi gösterilsin.

2. Profil ekranını “Identity Center” haline getir

Mevcut profil ekranını genişlet:
Başlık:
“Identity Center”

Alt açıklama:
“Kripto Keyfi üzerindeki kimliğini, rollerini, itibarını ve güvenlik ayarlarını yönet.”

Profil üst kartında:

* Avatar
* Ad soyad / kullanıcı adı
* Public username
* Bio
* Wallet adresi
* Email
* Trust Score
* Reputation Score
* Member Since
* Aktif roller
* Rozetler
* Public Profile URL

Örnek public profile:

* /u/hamzacakmak

3. Public Profile yapısı oluştur

Yeni public profil sayfası oluştur:
Route önerisi:

* /u/:username

Public Profile’da şunlar görünsün:

* Kapak görseli
* Avatar
* Ad soyad / kullanıcı adı
* Bio
* Lokasyon alanı opsiyonel
* Sosyal linkler:

  * YouTube
  * X / Twitter
  * LinkedIn
  * GitHub
  * Website
* Wallet adresi kısa hali
* Aktif roller
* Rozetler
* Trust Score / Reputation
* Katkılar
* Yayınladığı videolar
* Yazdığı makaleler
* Sahip olduğu projeler
* Chat reputation
* Topluluk puanı

Eğer kullanıcı sadece normal kullanıcıysa:

* Kaydedilen içerikler public gösterilmesin.
* Sadece public katkılar görünsün.

4. My Assets sayfasını geliştir

Mevcut portföy alanı korunsun:

* Allocation
* Portfolio Performance
* Performance
* Assets table
* Quick actions
* Tax Reports

Ama sayfayı tab yapısına dönüştür.

My Assets içinde sekmeler:
A) Portfolio
B) Watchlist
C) Saved Content
D) Activity
E) Wallets
F) Reports

Portfolio:
Mevcut portföy kartları burada kalsın.

Watchlist:
Favori coinler ve takip edilen assetler.

Saved Content:
Kullanıcının kaydettiği:

* Haberler
* Akademi makaleleri
* Videolar
* Ecosystem projeleri

Activity:
Kullanıcının:

* Yorumları
* Beğenileri
* Chat mesajları
* İzlediği videolar
* Okuduğu makaleler
* Takip ettiği creatorlar

Wallets:
Bağlı cüzdanlar:

* Main Wallet
* Secondary Wallet
* Network
* Kopyala
* Explorer’da aç
* Wallet disconnect mock

Reports:

* Tax Reports
* Portfolio Export CSV
* Activity Export
* Wallet Summary

5. Creator Dashboard giriş mantığı

Creator Dashboard’a giriş şu yerlerden olmalı:

* Sağ üst Account Center menüsü
* Identity Center içindeki Roles bölümü
* Video Merkezi sayfasında “Creator Başvurusu” CTA alanı
* Public profile içinde creator rolü varsa creator içerikleri linki

Creator onayı yoksa:
Kullanıcı Creator Dashboard’a girmeye çalışınca “Creator başvurusu gerekli” ekranı görsün.

Bu ekranda:
Başlık:
“Kripto Keyfi Creator Network’e Katıl”

Açıklama:
“YouTube kanalını doğrula, videolarını Kripto Keyfi Video Merkezi’nde yayınla ve Web3 topluluğunda kendi içerik kimliğini oluştur.”

Buton:
“Creator Başvurusu Yap”

6. Creator Başvuru Akışı oluştur

Route önerisi:

* /creator/apply

Form alanları:

* Ad soyad
* Public username
* Bio
* YouTube kanal linki
* Kanal adı
* İçerik kategorileri:

  * Kripto
  * Bitcoin
  * Ethereum
  * DeFi
  * Web3
  * Blockchain
  * Solidity
  * Güvenlik
  * Trading
  * Eğitim
* Sosyal linkler
* Neden Kripto Keyfi Creator olmak istiyorsun?
* Onay checkbox:
  “Paylaştığım kanalın bana ait olduğunu ve doğrulama sürecini tamamlayacağımı kabul ediyorum.”

Başvuru gönderilince durum:

* Pending Review

7. YouTube kanal doğrulama sistemi UI’ı oluştur

Başvuru sonrası kullanıcıya özel doğrulama kodu ve link üret.

Örnek:
Verification Code:
KRIPTOKEYFI-84291

Verification Link:
https://kriptokeyfi.com/creator/hamzacakmak

Kullanıcıdan istenecek:
“Bu doğrulama kodunu veya profil linkini YouTube kanal açıklamana ya da son videonun açıklama/sabit yorum alanına ekle.”

Panelde:

* Kod kopyala
* Linki kopyala
* Doğrulamayı kontrol et
* Doğrulama bekleniyor
* Admin onayı bekleniyor
* Onaylandı
* Reddedildi

Şimdilik kontrol işlemi mock olabilir.

8. Creator Dashboard yapısı

Route önerisi:

* /creator/dashboard

Dashboard sadece creator rolü onaylıysa erişilebilir olsun.
Mock role kontrolü yapılabilir.

Creator Dashboard ana bölümleri:

A) Overview

* Toplam video
* Yayınlanan video
* Onay bekleyen video
* Toplam izlenme
* Toplam yorum
* Takipçi sayısı
* Ortalama etkileşim
* Creator Trust Score

B) My Channel

* YouTube kanal bilgisi
* Kanal adı
* Kanal avatarı
* Kanal açıklaması
* Kanal linki
* Doğrulama durumu
* Son senkronizasyon tarihi
* Manuel senkronize et butonu

C) My Videos

* YouTube’dan çekilen videolar listesi
* Başlık
* Thumbnail
* Yayın tarihi
* Süre
* Kategori
* Status:

  * Pending Approval
  * Published
  * Hidden
  * Rejected
* Admin onayı gerekiyorsa kullanıcı sadece durumu görsün.
* Creator videoyu siteden silemesin ama “Yayından kaldırma talebi” gönderebilsin.

D) Content Insights

* En çok izlenen videolar
* En çok yorum alan videolar
* En çok kaydedilen videolar
* Kategori bazlı performans
* Son 30 gün mock grafik/kartlar

E) Profile & Branding
Creator kendi public profilini düzenleyebilsin:

* Bio
* Kapak görseli
* Avatar
* Sosyal linkler
* Website
* Uzmanlık alanları
* Görünen rozetler

F) Verification

* Doğrulama kodu
* YouTube kanal doğrulama durumu
* Admin onay durumu
* Yeniden doğrulama talebi

G) Settings

* Yeni videolar otomatik çekilsin mi?
* Yeni videolar admin onayına düşsün mü?
* Shorts gösterilsin mi?
* Yorumlara izin verilsin mi?
* Bildirim tercihleri

9. Author Dashboard yapısı için temel hazırlık

Şimdilik tam panel yapma ama Identity Center’da Author rolü için alan hazırla.

Author onaylıysa:

* /author/dashboard linki aktif olabilir.

Author başvurusu yoksa:

* “Akademi Yazarı Başvurusu Yap” butonu göster.

Author mock kartlarında:

* Yazılan makale sayısı
* Toplam okunma
* Ortalama okuma süresi
* Toplam yorum
* Onay bekleyen makale

10. Project Owner Dashboard hazırlığı

Ecosystem ve Launchpad sahipleri için temel yapı hazırla.

Onaylı Project Owner ise:

* /project/dashboard linki aktif olsun.

Bu dashboard daha sonra detaylandırılacak.
Şimdilik Identity Center içinde:

* Projelerim
* Tokenlarım
* Başvuru durumlarım
* Community rating
* Güvenlik skoru

gibi kartlar mock olabilir.

11. Developer Dashboard hazırlığı

Developer rolü için temel yapı:

* Smart contracts
* Audit reports
* GitHub linki
* Open source katkıları
* Developer reputation
* Wallet intelligence kullanım geçmişi

Şimdilik Identity Center’da bölüm olarak gösterilebilir.

12. Rol ve yetki sistemi mock yapısı

Mock user yapısı oluştur:

* id
* username
* fullName
* email
* avatar
* coverImage
* walletAddress
* bio
* trustScore
* reputationScore
* memberSince
* roles: array
* pendingRoles: array
* badges: array
* socialLinks
* creatorProfile
* authorProfile
* projectOwnerProfile
* developerProfile

Role status:

* not_applied
* pending
* verified
* rejected
* suspended

13. Account Center’da role durumları

Örnek gösterim:
Creator: Verified
Author: Pending
Project Owner: Not Applied
Developer: Verified

Onaylı rol butonları aktif.
Bekleyen rol butonları pasif ve “Onay bekleniyor”.
Başvuru yapılmamış rol için “Başvur” butonu.

14. Admin onayı notu

Frontend içinde admin panel yapma.
Ama data modelde şu alanlar hazır olsun:

* submittedAt
* reviewedAt
* reviewedBy
* rejectionReason
* verificationStatus
* approvalStatus

15. Bildirim sistemi için temel yapı

Creator başvurusu sonrası kullanıcıya mock notification göster:

* Başvurun alındı
* Doğrulama bekleniyor
* Admin incelemesinde
* Creator rolün onaylandı
* Başvurun reddedildi

Account Center’da küçük notification icon olabilir.

16. Component yapısı temiz olsun

Önerilen componentler:

* AccountCenterMenu
* IdentityCenter
* ProfileHeaderCard
* RoleStatusCard
* PublicProfile
* PublicProfileTabs
* MyAssetsPage
* PortfolioTab
* WatchlistTab
* SavedContentTab
* ActivityTab
* WalletsTab
* ReportsTab
* CreatorApplyPage
* CreatorVerificationPage
* CreatorDashboard
* CreatorOverview
* CreatorChannelCard
* CreatorVideosTable
* CreatorInsights
* CreatorBrandingSettings
* CreatorVerificationPanel
* CreatorSettings
* AuthorRolePreview
* ProjectOwnerRolePreview
* DeveloperRolePreview
* UserBadges
* ReputationCard
* EmptyState
* LoadingSkeleton

17. Service/mock data yapısı

Şimdilik backend yoksa mock data kullan.
Ama ileride backend’e bağlanmaya hazır service dosyaları oluştur.

Önerilen servisler:

* userService.js
* identityService.js
* creatorService.js
* portfolioService.js
* roleService.js

Fonksiyon örnekleri:

* getCurrentUser()
* getPublicProfile(username)
* updateIdentityProfile(data)
* applyForCreator(data)
* getCreatorApplicationStatus()
* getCreatorDashboard()
* getUserPortfolio()
* getSavedContent()
* getUserActivity()
* getUserRoles()

18. Rota yapısı

Mevcut route yapısına uygun ilerle.

Önerilen rotalar:

* /my-assets
* /identity
* /u/:username
* /creator/apply
* /creator/verify
* /creator/dashboard
* /author/dashboard
* /project/dashboard
* /developer/dashboard
* /settings/security
* /settings/wallets

Eğer mevcut yapıda tek route varsa bozmadan ekle.

19. Responsive yapı

Desktop:

* My Assets dashboard grid yapısı korunsun.
* Identity Center iki kolon olabilir.
* Creator Dashboard sol menü + ana içerik olabilir.

Mobil:

* Sekmeler yatay scroll olsun.
* Kartlar tek kolon.
* Account Center tam ekran drawer gibi açılabilir.
* Creator dashboard mobilde sade kart yapısına dönüşsün.

20. Tasarım dili

Mevcut koyu tema ve Web3 premium hissi korunsun.
Profil sistemi ciddi, güven veren, profesyonel bir platform hissi vermeli.
Creator Dashboard ise YouTube Studio + Medium dashboard + Web3 identity karışımı bir deneyim sunmalı.

21. Güvenlik ve yetki notu

Bu aşamada gerçek KYC, gerçek OAuth, gerçek YouTube API, gerçek wallet signing veya gerçek admin approval zorunlu değil.
Frontend mock akış yapılabilir.
Ama yapı backend’e bağlandığında gerçek role approval, YouTube doğrulama, wallet verification ve içerik onay sistemine hazır olmalı.

22. Hedef sonuç

Bu geliştirme sonunda:

* My Assets sadece portföy sayfası değil, kullanıcının finansal ve içerik aktivitelerini yönettiği kişisel merkez olacak.
* Sağ üst profil menüsü basit dropdown değil, Account Center olacak.
* Profil ekranı Identity Center’a dönüşecek.
* Kullanıcı Kripto Keyfi üzerinde public kimlik oluşturabilecek.
* Creator başvurusu, doğrulama ve dashboard akışı hazır olacak.
* Author, Project Owner ve Developer rolleri için temel altyapı hazırlanmış olacak.
* Admin onayı olmadan creator/author/project owner/developer yetkileri aktif olmayacak.
* Kripto Keyfi ileride içerik üreticileri, yazarlar, proje sahipleri ve developerlar için profesyonel bir Web3 kimlik ve katkı platformuna dönüşebilecek.

Lütfen mevcut çalışan yapıyı bozmadan, component bazlı, mock data destekli, backend entegrasyonuna hazır ve responsive şekilde uygula.
