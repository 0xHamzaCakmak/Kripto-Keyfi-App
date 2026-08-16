# Kullanıcı profil bölümleri

Yeni bir domain, `UserProfileSectionDefinition` tipinde benzersiz `key`, kullanıcıya gösterilecek `title` ve `fetch(userId)` fonksiyonu tanımlar. Tanımları kendi modülünde dışa aktarır ve `backend/src/modules/users/user-profile-sections.ts` dosyasındaki registry'ye kaydeder. `fetch` sonucu nesne veya nesne dizisi olabilir; admin arayüzü alanları otomatik olarak genel bir kartta gösterir. Bir bölüm hata verirse registry o bölümü atlar ve diğerlerini döndürmeye devam eder. Hassas bilgi, parola veya credential değerleri bölüm verisine kesinlikle eklenmemelidir.

```ts
export const exampleSections: UserProfileSectionDefinition[] = [{
  key: 'campaigns',
  title: 'Kampanya Başvuruları',
  fetch: (userId) => prisma.campaignApplication.findMany({ where: { userId } }),
}];

userProfileSectionRegistry.register(...exampleSections);
```

Bir bölüm satır bazlı admin işlemi sunacaksa `actions` metadata'sı ekler. Endpoint şablonundaki `:userId` otomatik olarak sayfadaki kullanıcıdan, `:id` gibi diğer alanlar ilgili satır verisinden alınır; generic kart butonu ve yükleme durumunu kendisi üretir.

```ts
actions: [{
  key: 'remove',
  label: 'Listeden çıkar',
  method: 'DELETE',
  endpoint: '/admin/users/:userId/example/:id',
  confirm: 'Bu kayıt kaldırılsın mı?',
  tone: 'danger',
}]
```
