Kripto Keyfi projem için giriş, kayıt ve onboarding ekranlarını frontend tarafında oluşturmanı istiyorum. Şimdilik backend bağlantısı yapılmayacak. Sayfalar mock/local state ile çalışsın. Backend aşamasında DB, auth, JWT, Google OAuth, wallet doğrulama ve role approval işlemlerini bağlayacağız.

Amaç:
Kullanıcıyı ilk girişte cüzdan bağlamaya zorlamayan, güven veren, modern bir auth yapısı oluşturmak. Kullanıcı ister e-posta ile, ister Google ile, ister cüzdan ile kayıt/giriş yapabilsin. Ancak cüzdan bağlamak isteğe bağlı olsun. Creator, Author, Project Owner, Developer gibi profesyonel roller için ayrıca başvuru ve onay akışı olacak.

Mevcut tasarım dilini koru:

* Koyu tema
* Web3 / kripto hissi
* Kart tabanlı modern UI
* Navbar yapısını bozma
* Responsive tasarım
* Mevcut route/layout yapısına uygun ilerle

1. Giriş yapmamış kullanıcı için sağ üst navbar alanını değiştir

Şu an sağ üstte cüzdan adresi görünüyor.
Giriş yapmamış kullanıcıda burada şunlar görünsün:

* “Giriş Yap” butonu
* “Ücretsiz Katıl” primary butonu

Cüzdan adresi sadece kullanıcı giriş yaptıysa ve cüzdan bağladıysa görünsün.

Durumlar:
A) Guest:

* Giriş Yap
* Ücretsiz Katıl

B) Logged in, wallet not connected:

* Avatar / kullanıcı adı
* Küçük “Cüzdan Bağla” butonu

C) Logged in, wallet connected:

* Kısa wallet adresi: 0x7a25...88D
* Avatar / Account Center butonu

2. Auth sayfaları oluştur

Route önerileri:

* /login
* /register
* /forgot-password
* /onboarding
* /connect-wallet

3. Login sayfası

Başlık:
“Kripto Keyfi’ne Giriş Yap”

Alt açıklama:
“Haberleri takip et, akademi içeriklerini kaydet, videoları izle ve Web3 kimliğini oluştur.”

Login seçenekleri:

* Google ile devam et
* E-posta ile giriş yap
* Cüzdan ile devam et

Form alanları:

* E-posta
* Şifre
* Beni hatırla
* Şifremi unuttum
* Giriş Yap

Alt link:
“Hesabın yok mu? Ücretsiz katıl.”

Cüzdan ile giriş seçeneği en üstte değil, daha düşük öncelikte gösterilsin. Kullanıcıyı cüzdan bağlamaya zorlayan bir tasarım yapılmasın.

4. Register sayfası

Başlık:
“Ücretsiz Kripto Keyfi hesabı oluştur”

Alt açıklama:
“Kripto, Web3, akademi, video ve topluluk içeriklerini kişiselleştirilmiş şekilde takip et.”

Kayıt seçenekleri:

* Google ile devam et
* E-posta ile kayıt ol
* Cüzdan ile kayıt ol

Form alanları:

* Ad soyad
* Kullanıcı adı
* E-posta
* Şifre
* Şifre tekrar
* Kullanım şartlarını kabul checkbox
* KVKK / gizlilik metni checkbox mock
* Ücretsiz Katıl butonu

Alt not:
“Cüzdan bağlamak zorunlu değildir. İstersen daha sonra profilinden bağlayabilirsin.”

5. Forgot Password sayfası

Başlık:
“Şifreni sıfırla”

Alan:

* E-posta adresi

Buton:
“Sıfırlama bağlantısı gönder”

Mock başarı mesajı:
“Şifre sıfırlama bağlantısı e-posta adresine gönderildi.”

6. Onboarding ekranı oluştur

Kullanıcı kayıt olduktan sonra /onboarding sayfasına yönlendirilecek.

Başlık:
“Kripto Keyfi’ni nasıl kullanmak istiyorsun?”

Alt açıklama:
“Deneyimini sana göre kişiselleştirelim.”

Seçenek kartları:

* Kripto haberlerini takip etmek istiyorum
* Akademi içerikleriyle öğrenmek istiyorum
* Video içerikleri izlemek istiyorum
* Topluluğa katılmak istiyorum
* Portföyümü takip etmek istiyorum
* İçerik üreticisi olmak istiyorum
* Akademi yazarı olmak istiyorum
* Projemi tanıtmak istiyorum
* Developer araçlarını kullanmak istiyorum

Kullanıcı birden fazla seçim yapabilsin.

Devam butonu:
“Deneyimimi Oluştur”

Sonraki adımda önerilen aksiyonlar göster:

* Haberleri keşfet
* Akademiye git
* Video Merkezi’ne git
* Cüzdanını bağla
* Creator başvurusu yap
* Public profilini tamamla

7. Connect Wallet sayfası

Route:

* /connect-wallet

Başlık:
“Cüzdanını Bağla”

Alt açıklama:
“Portföyünü takip etmek, wallet intelligence kullanmak ve Web3 kimliğini güçlendirmek için cüzdanını bağlayabilirsin.”

Önemli güven mesajı:
“Kripto Keyfi senden private key veya seed phrase istemez. Cüzdan bağlama işlemi sadece adresini doğrulamak içindir.”

Cüzdan seçenekleri:

* MetaMask
* WalletConnect
* Coinbase Wallet
* Rabby Wallet
* Trust Wallet

Şimdilik mock çalışsın.
Butona tıklayınca:

* Bağlanıyor
* İmza isteği mock
* Başarılı
  durumları gösterilsin.

Cüzdan bağlamak istemeyen kullanıcı için:
“Şimdilik geç” butonu olsun.

8. Account Center davranışı

Giriş yapan kullanıcı sağ üstten Account Center açabilsin.

Account Center’da:

* Avatar
* Kullanıcı adı
* E-posta
* Wallet bağlıysa kısa wallet adresi
* Wallet bağlı değilse “Cüzdan Bağla” CTA
* Trust Score
* Reputation Score
* Aktif roller
* Identity Center
* My Assets
* Creator Dashboard
* Author Dashboard
* Project Dashboard
* Developer Dashboard
* Security Settings
* Sign Out

Rol bazlı durumlar:

* Rol onaylıysa dashboard aktif
* Başvuru bekliyorsa “Onay bekleniyor”
* Başvuru yoksa “Başvur” linki

9. Kimlik katmanlarını UI’da göster

Identity Center veya Account Center içinde kullanıcı kimliği 3 katmanlı gösterilsin:

A) Hesap Kimliği

* E-posta
* Google
* Kullanıcı adı
* Profil bilgileri

B) Web3 Kimliği

* Cüzdan
* Wallet signature
* Network bilgileri

C) Profesyonel Kimlik

* Creator
* Author
* Project Owner
* Developer

Her katmanda:

* Tamamlandı
* Eksik
* Onay bekleniyor
  gibi durum etiketleri olsun.

10. Role başvuru girişleri

Onboarding ve Account Center’dan şu başvurulara yönlendirme hazırla:

* /creator/apply
* /author/apply
* /project/apply
* /developer/apply

Bu sayfalar şimdilik basit placeholder olabilir:
Başlık:
“Başvuru ekranı hazırlanıyor”
veya önceki oluşturulan Creator Apply sayfası varsa ona bağla.

11. Mock auth state oluştur

Backend olmadığı için mock auth state kullan.
LocalStorage kullanılabilir.

Mock user alanları:

* id
* fullName
* username
* email
* avatar
* walletAddress
* isLoggedIn
* isEmailVerified
* isGoogleConnected
* isWalletConnected
* trustScore
* reputationScore
* roles
* pendingRoles
* onboardingCompleted

Fonksiyonlar:

* loginWithEmail()
* registerWithEmail()
* loginWithGoogleMock()
* connectWalletMock()
* disconnectWalletMock()
* logout()
* completeOnboarding()

12. Auth service yapısı oluştur

Backend’e hazır olması için service dosyası kullan.

Önerilen dosyalar:

* authService.js
* walletService.js
* onboardingService.js
* userService.js

Şimdilik mock/localStorage döndürsün.
İleride backend API endpointlerine bağlanacak şekilde fonksiyonlar düzenli olsun.

13. Protected route mantığı

Basit frontend guard oluştur.

Guest kullanıcı:

* /my-assets
* /identity
* /creator/dashboard
  gibi sayfalara giderse login sayfasına yönlendirilsin veya “Giriş yapmalısın” ekranı gösterilsin.

Wallet gerektiren sayfalar:

* My Assets
* Wallet Intelligence
* Token Launchpad deploy
  gibi alanlarda kullanıcı giriş yaptıysa ama cüzdan bağlı değilse “Cüzdan bağla veya şimdilik görüntüle” uyarısı gösterilsin.

14. UX metinleri

Kullanıcıyı korkutmayan dil kullan:
Yanlış:
“Wallet bağlamadan devam edemezsin.”

Doğru:
“Cüzdan bağlamak zorunlu değildir. Ancak portföy takibi ve Web3 araçları için önerilir.”

Yanlış:
“Seed phrase gir.”

Doğru:
“Kripto Keyfi asla seed phrase veya private key istemez.”

15. Tasarım detayları

Login/Register sayfalarında:

* Sol tarafta marka anlatımı olabilir
* Sağ tarafta form kartı
* Mobilde tek kolon
* Kripto Keyfi logosu/ismi
* Güven mesajları
* “Private key istemeyiz” notu
* “Cüzdanı sonra bağlayabilirsin” bilgisi

16. Empty/loading/success state

Ekle:

* Giriş yapılıyor
* Kayıt oluşturuluyor
* Cüzdan bağlanıyor
* Başarılı
* Hata mesajı mock
* Form validasyonları

17. Form validasyonları

Frontend basit validasyon:

* E-posta formatı
* Şifre minimum 8 karakter
* Şifreler eşleşmeli
* Kullanıcı adı boş olamaz
* Şartlar kabul edilmeli

18. Responsive yapı

Desktop:

* Auth sayfaları iki kolon olabilir

Mobil:

* Tek kolon
* Butonlar tam genişlik
* Account Center drawer gibi açılabilir

19. Önemli güvenlik notu

Bu aşamada gerçek auth, gerçek Google OAuth, gerçek wallet signature, gerçek JWT veya backend DB işlemi yapılmayacak.
Sadece frontend akışları, sayfalar, mock state ve UI hazırlanacak.
Backend aşamasında bu yapılar gerçek endpointlere bağlanacak.

20. Hedef sonuç

Bu geliştirme sonunda:

* Giriş yapmamış kullanıcı sağ üstte cüzdan adresi görmeyecek.
* Kullanıcı e-posta, Google veya cüzdan ile kayıt/giriş yapabilecek.
* Cüzdan bağlamak zorunlu olmayacak.
* Kayıt sonrası onboarding ile kullanıcı amacı öğrenilecek.
* Creator/Author/Project Owner/Developer gibi profesyonel roller için başvuru girişleri hazırlanacak.
* Account Center, Identity Center ve My Assets sayfaları auth durumuna göre doğru çalışacak.
* Sistem ileride backend auth ve DB entegrasyonuna hazır olacak.

Lütfen mevcut çalışan yapıyı bozmadan, component bazlı, mock/localStorage destekli, responsive ve backend entegrasyonuna hazır şekilde uygula.
