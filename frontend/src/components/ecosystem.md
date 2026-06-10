Kripto Keyfi projemde mevcut “Ecosystem” sayfasını geliştirmek istiyorum. Şu an sayfada proje keşif kartları, kategori menüsü ve Token Launchpad adında token oluşturma wizard yapısı var. Tasarım modern ve koyu temalı; bunu bozmadan sayfayı daha güçlü bir “Web3 Araç Merkezi + Ekosistem Keşif Merkezi” haline getir.

Amaç:
Ecosystem sayfası sadece proje listeleme alanı olmasın. Kullanıcı burada Web3 projelerini keşfedebilsin, token oluşturabilsin, geliştirici araçlarına erişebilsin, wallet/on-chain analiz araçlarını kullanabilsin ve güvenlik/risk tarafında fikir alabilsin.

Mevcut tasarım dilini koru:

* Koyu tema
* Kart tabanlı yapı
* Sol kategori menüsü
* Navbar
* Alt market ticker
* Responsive yapı
* Mevcut route/layout yapısı

1. Ecosystem ana sayfasını 4 ana sekmeye böl:

A) Discover
Proje keşif alanı.

B) Build
Token Launchpad ve geliştirici araçları.

C) Monitor
On-chain analiz, wallet intelligence, whale tracker alanı.

D) Security
Audit scanner, rug pull risk analizi, güvenlik kontrolleri.

2. Sol menüyü geliştir.
   Mevcut kategoriler korunsun ama daha düzenli hale getirilsin:

Discover:

* All Ecosystems
* DeFi
* NFT Marketplace
* Tools & Infrastructure
* Web3 Social
* AI & Data
* Gaming
* DAO
* Launchpads

Build:

* Token Launchpad
* Contract Generator
* ABI Decoder
* Gas Estimator
* Contract Verifier

Monitor:

* Wallet Intelligence
* Whale Tracker
* New Tokens
* Bridge Activity
* Stablecoin Flows

Security:

* Rug Pull Scanner
* Smart Contract Audit
* Honeypot Checker
* Permission Checker

3. Ecosystem proje kartlarını geliştir.
   Her proje kartında şu bilgiler olsun:

* Logo
* Proje adı
* Kısa açıklama
* Kategori
* Network rozetleri: Ethereum, Arbitrum, Base, Solana, Polygon vb.
* Status: Active / Beta / Testnet / Risky
* TVL
* Kullanıcı sayısı
* Audit durumu
* Risk skoru
* Website butonu
* Twitter/X butonu
* GitHub butonu
* Detay butonu
* Topluluk puanı

4. Proje detay modalı veya detay sayfası oluştur.
   Detayda:

* Proje adı
* Açıklama
* Kategori
* Network bilgisi
* TVL
* Kullanıcı sayısı
* Audit bilgisi
* Risk skoru
* Sosyal linkler
* Website
* GitHub
* Community rating
* Kullanıcı yorumları
* “Scam bildir” butonu
* “Kullanıyorum” butonu
* “Favorilere ekle” butonu

5. Community Verified sistemi ekle.
   Kullanıcılar projeleri değerlendirebilsin:

* Güvenilir
* Kullanıyorum
* Şüpheli
* Scam bildir

Şimdilik localStorage/mock state kullanılabilir.

6. Ecosystem arama ve filtreleme ekle.
   Arama placeholder:
   “Proje, kategori, ağ veya araç ara...”

Filtreler:

* Kategori
* Network
* Status
* Risk seviyesi
* Audit var/yok
* En popüler
* Yeni eklenenler

7. Token Launchpad wizard yapısını geliştir.
   Mevcut 4 adımlı yapıyı koru:
8. Network
9. Details
10. Options
11. Deploy

Ama içeriği güçlendir.

8. Token Launchpad - Network adımı:
   Network seçenekleri:

* Ethereum
* Arbitrum
* Base
* Polygon
* BNB Chain
* Sepolia Testnet
* Solana şimdilik “Coming Soon” olabilir

Her network kartında:

* Network adı
* Logo/ikon
* Ortalama gas bilgisi mock
* Mainnet/Testnet etiketi
* Destek durumu

9. Token Launchpad - Details adımı:
   Alanlar:

* Token Name
* Symbol
* Total Supply
* Decimals
* Token description
* Website optional
* Logo upload mock

Sağ tarafta canlı Token Preview olsun.
Kullanıcı yazdıkça güncellensin:

* Token adı
* Sembol
* Supply
* Decimals
* Network
* Açıklama

10. Token Launchpad - Options adımı:
    ERC20 özellikleri seçilebilsin:

* Mintable
* Burnable
* Pausable
* Ownable
* Permit
* Capped Supply
* Tax / Fee özelliği “Advanced / dikkatli kullan” etiketiyle

OpenZeppelin tabanlı güvenli contract üretilecekmiş gibi yapı kur. OpenZeppelin güvenli smart contract kütüphaneleri ve tooling tarafında yaygın kullanılıyor; bu yüzden UI metinlerinde “OpenZeppelin tabanlı güvenli şablon” ifadesi kullanılabilir.

11. Tokenomics bölümü ekle.
    Kullanıcı supply dağılımı yapabilsin:

* Community
* Team
* Treasury
* Liquidity
* Airdrop
* Marketing

Toplam yüzde 100 olmalı.
Toplam 100 değilse uyarı göster.

12. Vesting bölümü ekle.
    Özellikle Team ve Treasury için:

* Cliff süresi
* Vesting süresi
* Başlangıç tarihi
* Kilitli token oranı

Şimdilik sadece UI/mock hesaplama yeterli.

13. Token Launchpad - Deploy adımı:
    Deploy öncesi özet ekranı olsun:

* Network
* Token adı
* Sembol
* Supply
* Decimals
* Seçilen özellikler
* Tokenomics dağılımı
* Vesting ayarları
* Güvenlik kontrolleri

Butonlar:

* Contract kodunu görüntüle
* Testnet’e deploy et
* Mainnet deploy hazırlığı

Gerçek deploy yoksa mock çalışsın.
Wallet bağlı değilse “Wallet bağla” uyarısı göster.

14. Contract Code Preview alanı ekle.
    Deploy adımında kullanıcı üretilen Solidity kodunu görebilsin.
    Şimdilik mock Solidity kodu gösterilebilir.
    Kod bloğu modern görünsün.

15. Security Checks panelini geliştir.
    Launchpad sağ panelinde:

* ERC20 uyumluluğu
* Supply validasyonu
* Network seçimi
* Owner yetkileri uyarısı
* Mint özelliği açıksa risk uyarısı
* Tax/Fee açıksa yüksek risk etiketi
* Tokenomics toplamı 100 kontrolü
* Vesting önerisi

16. Recent Tokens alanını geliştir.
    Kullanıcının oluşturduğu tokenlar localStorage ile tutulabilir.
    Kartta:

* Token adı
* Sembol
* Network
* Supply
* Tarih
* Status
* Contract address mock
* Explorer link mock

17. Build araçları ana kartları oluştur.
    Build sekmesinde şu araç kartları olsun:

* Token Launchpad
* Contract Generator
* ABI Decoder
* Gas Estimator
* Contract Verifier

Şimdilik Token Launchpad aktif olsun.
Diğerleri “Coming Soon” veya mock UI olabilir.

18. Monitor sekmesini oluştur.
    Şimdilik mock data ile:

* Wallet Intelligence
* Whale Tracker
* New Tokens
* Bridge Activity
* Stablecoin Flows

Wallet Intelligence kartında:

* Cüzdan adresi gir
* Analiz et
* Mock sonuç:

  * İlk işlem tarihi
  * Toplam işlem
  * Aktif ağlar
  * Risk skoru
  * DeFi/NFT aktivitesi

Wallet adresi regex:
0x ile başlayan 42 karakter.

19. Whale Tracker alanı:
    Mock feed:

* 500 BTC Binance’e aktarıldı
* 1200 ETH stake edildi
* 8M USDC Arbitrum’a bridge edildi
* 2M USDT yeni cüzdana taşındı

20. Security sekmesini oluştur.
    Araç kartları:

* Rug Pull Scanner
* Smart Contract Audit
* Honeypot Checker
* Permission Checker

Rug Pull Scanner mock:
Kullanıcı token contract adresi girer.
Sistem mock risk raporu gösterir:

* Owner yetkisi
* Mint fonksiyonu
* Blacklist fonksiyonu
* Liquidity durumu
* Honeypot riski
* Risk skoru

21. Academy ve Blog bağlantıları ekle.
    Ecosystem sayfasında bazı alanlarda kullanıcıya içerik öner:

* ERC20 nedir?
* Tokenomics nasıl tasarlanır?
* Rug pull nasıl anlaşılır?
* Wallet güvenliği nedir?

Bu kartlar ileride /academy/articles/:slug veya /blog/:slug sayfasına gidecek şekilde route hazır olsun.

22. Mock data oluştur.
    Dosya yapısı mevcut projeye uygun olsun.

Mock project alanları:

* id
* slug
* name
* description
* logo
* category
* networks
* status
* tvl
* users
* auditStatus
* riskScore
* website
* twitter
* github
* communityRating
* isFeatured
* createdAt

Mock tool alanları:

* id
* name
* description
* category
* status
* route
* icon

Mock token alanları:

* id
* name
* symbol
* network
* supply
* decimals
* features
* tokenomics
* vesting
* createdAt
* contractAddress
* status

23. Component yapısı temiz olsun.
    Önerilen componentler:

* EcosystemPage
* EcosystemSidebar
* EcosystemTabs
* EcosystemSearch
* EcosystemFilters
* ProjectCard
* ProjectGrid
* ProjectDetailModal
* CommunityRating
* ToolCard
* BuildTools
* TokenLaunchpad
* LaunchpadStepper
* NetworkStep
* TokenDetailsStep
* TokenOptionsStep
* TokenDeployStep
* TokenPreview
* TokenomicsBuilder
* VestingBuilder
* SecurityChecksPanel
* RecentTokens
* ContractCodePreview
* MonitorDashboard
* WalletIntelligence
* WhaleTracker
* SecurityDashboard
* RugPullScanner
* EmptyState
* LoadingSkeleton

24. Service yapısı hazırla.
    Gerçek API yoksa mock döndür.
    İleride backend bağlamak kolay olsun.

Önerilen servisler:

* ecosystemService.js
* tokenLaunchpadService.js
* walletIntelligenceService.js
* securityScannerService.js
* whaleService.js

25. Rota yapısı:
    Mevcut route yapısına uygun ilerle.

Önerilen rotalar:

* /ecosystem
* /ecosystem/discover
* /ecosystem/build
* /ecosystem/build/token-launchpad
* /ecosystem/monitor
* /ecosystem/security
* /ecosystem/project/:slug

Eğer mevcut projede tek sayfa state ile yönetiliyorsa route eklemeden tab mantığıyla da yapılabilir. Mevcut yapıyı bozma.

26. Responsive davranış:
    Desktop:

* Sol menü + ana içerik + sağ destek panelleri

Tablet:

* Sol menü daralabilir

Mobil:

* Sol menü drawer veya yatay kategori tablarına dönüşsün
* Kartlar tek kolon olsun
* Token Launchpad adımları mobil uyumlu olsun
* Sağ paneller alta insin

27. Önemli güvenlik notu:
    Bu aşamada gerçek mainnet deploy işlemi yapma.
    Gerçek contract deploy, wallet transaction, private key veya API key işlemi ekleme.
    Sadece frontend UI/mock akış hazırla.
    Gerçek deploy daha sonra backend/wallet entegrasyonu ile yapılacak.

28. Hata ve boş durumları:

* Proje bulunamadı
* Bu kategoride proje yok
* Wallet adresi geçersiz
* Contract adresi geçersiz
* Tokenomics toplamı 100 olmalı
* Wallet bağlı değil
* Recent token yok
* Araç yakında aktif olacak

29. Hedef sonuç:
    Ecosystem sayfası proje listeleme ekranından çıkıp Kripto Keyfi’nin “Web3 Araç Merkezi” haline gelmeli.
    Kullanıcı burada:

* Proje keşfetmeli
* Token oluşturma akışını deneyimlemeli
* Cüzdan analizi yapabilmeli
* Whale feed görebilmeli
* Rug pull risk analizi yapabilmeli
* Güvenlik ve akademi içeriklerine yönlenebilmeli

Lütfen mevcut tasarımı ve çalışan yapıyı bozmadan, component bazlı, mock data destekli, backend’e bağlanmaya hazır şekilde geliştir.
