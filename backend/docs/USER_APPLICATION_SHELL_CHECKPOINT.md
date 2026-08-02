# Kullanıcı ve Uygulama Kabuğu Checkpoint

## Authentication mimarisi

- Kısa ömürlü JWT access token bellekte tutulur.
- Dönen refresh token veritabanında hash olarak saklanır ve yalnızca HttpOnly cookie ile taşınır.
- Refresh işlemleri frontend API katmanında tek promise üzerinden birleştirilir.
- Uygulama açılışında refresh sonrasında `GET /api/auth/me` ile güncel kullanıcı okunur.
- Logout backend refresh oturumunu iptal eder, cookie'yi ve frontend access token/state bilgisini temizler.
- Admin erişimi hem frontend route guard hem backend `authenticate + authorize(ADMIN)` ile korunur.

## Kullanıcı modeli

Mevcut `name` alanı API'de `displayName` olarak sunulur. Ayrı first/last name kolonları eklenmedi; gereksiz veri çoğaltılması önlendi. Profile özel alanlar:

- `bio`
- `profileCompleted`
- `onboardingCompleted`
- `emailVerifiedAt` üzerinden türetilen `emailVerified`
- ayrı `UserCapability` tablosu

Ana erişim rolleri `USER` ve `ADMIN` olarak kalır. Creator/Author/Project Owner/Developer, ana rol değildir ve gelecekte `UserCapability` üzerinden onaylanabilir.

## Endpointler

- `GET /api/auth/me`: Oturum sahibinin güvenli, güncel profilini döndürür.
- `PATCH /api/users/me`: Yalnızca `displayName`, `username`, `bio`, `avatarUrl` alanlarını günceller.

Profil endpointi strict input validation ve rate limit kullanır. `role`, `status`, parola/hash ve başka kullanıcı kimliği kabul etmez.

## Bilinçli sınırlar

- Google Identity akışı bu aşamada değiştirilmedi.
- E-posta doğrulama gönderim servisi eklenmedi.
- Cüzdan bağlantısı geliştirilmedi.
- Capability başvuru/onay iş akışı eklenmedi.
- Dosya yükleme taklidi yapılmadı; avatar URL veya initials kullanılır.
- My Assets, Identity Center, profesyonel dashboard ve ayarlar kullanıcı menüsünde `Yakında` durumundadır.
- Ana sayfadaki platform sayıları veri bekleniyor; proje ve sohbet içerikleri örnek/demo olarak etiketlenir.
