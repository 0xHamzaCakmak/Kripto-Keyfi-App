# Kimlik Doğrulama Modülü

## Hesap ve roller

- Yeni kayıtlar dahili erişim seviyesi olarak `USER` ile oluşturulur.
- Mevcut `ADMIN` erişim seviyesi yönetim paneli yetkisini korur.
- Youtuber, akademisyen ve benzeri profil rolleri `ProfileRole` ile tanımlanır.
- Bir kullanıcıya `UserProfileRole` üzerinden birden fazla profil rolü atanabilir.
- Yeni kullanıcının profil rolü listesi boş başlar. Rol atama arayüzü ayrı bir admin fazıdır.

## Google ile giriş kurulumu

1. Google Cloud Console'da bir **Web application OAuth client** oluşturun.
2. Yerel geliştirme için Authorized JavaScript origin alanına `http://localhost:3000` ekleyin.
3. Client ID'yi backend `.env` dosyasında `GOOGLE_CLIENT_ID` olarak ayarlayın.
4. Aynı Client ID'yi frontend `.env` dosyasında `VITE_GOOGLE_CLIENT_ID` olarak ayarlayın.
5. Backend ve frontend geliştirme süreçlerini yeniden başlatın.

Frontend Google Identity Services düğmesini gösterir. Backend Google ID token imzasını, issuer, audience ve süre sonunu doğrular; veritabanında kalıcı kimlik anahtarı olarak Google `sub` değeri tutulur.

Google ile ilk kez hesap oluşturan kullanıcı kayıt sayfasında kullanım şartlarını ve gizlilik metnini kabul etmelidir. Giriş sayfası yalnızca mevcut Google hesabının oturumunu açar.
