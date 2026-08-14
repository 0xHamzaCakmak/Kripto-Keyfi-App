# KriptoKeyfi KOL Veri Toplama ve Doğrulama Altyapısı

> Durum: Uygulama dokümanı  
> Son güncelleme: 15 Ağustos 2026  
> Sahip: KriptoKeyfi KOL Intelligence

## 1. Amaç

Bu doküman; kripto KOL adaylarının bulunması, dış kaynaklardan sinyal toplanması, aynı kişiye ait hesapların eşleştirilmesi, verinin doğrulanması ve KriptoKeyfi Güven & İtibar Skoru'na kontrollü biçimde aktarılması için teknik yol haritasıdır.

Sistem üç prensiple çalışır:

1. Kaynağı ve ölçüm zamanı bilinmeyen veri skora girmez.
2. Bir sağlayıcının kendi skoru, KriptoKeyfi toplam skoruna doğrudan kopyalanmaz.
3. API bulunmayan veya ticari kullanım hakkı teyit edilmemiş ürünler otomatik crawler gibi kullanılmaz.

## 2. Doğrulanmış kaynak matrisi

| Kaynak | Kullanım | Erişim | Alınabilecek sinyaller | KriptoKeyfi kararı |
|---|---|---|---|---|
| [OKX OnchainOS Top KOLs](https://web3.okx.com/tr/onchainos/dev-docs/market/market-social-vibe-top-kols) | Token bazlı KOL keşfi | İmzalı sunucu API'si | Handle, takipçi, etkileşim, bahsedilme, gösterim, ilk paylaşım URL'si | Otomatik keşif sağlayıcısı |
| [Sorsa API](https://docs.sorsa.io/api-reference-guide) | X profil ve içerik zenginleştirme | `ApiKey` başlığı ile sunucu API'si | Profil, tweet, arama, mention, takipçi analizi, Sorsa Score | Otomatik zenginleştirme sağlayıcısı |
| [Growing3](https://growing3.ai/product/influencer_insight_browser_extension) | Editör profil araştırması | Tarayıcı eklentisi / ürün arayüzü | Kitle büyüklüğü, etkileşim oranı, görüntülenme oranı, anahtar kelimeler | Editör destekli kontrol; API teyidine kadar otomatik kaynak değil |
| [BitMart X Insight](https://www.bitmart.com/en-US/ai/xinsight/landing) | Sosyal duygu ve KOL görüş araştırması | Ürün arayüzü | KOL görüş takibi, SSI, piyasa reaksiyonu, tweet analizi | Benchmark; lisanslı API teyidine kadar ingestion kaynağı değil |

### OKX çağrı kapsamı

`GET /api/v6/dex/market/social/vibe/top-kols`

- Zorunlu: `chainIndex`, `tokenAddress`
- Zincirler: Ethereum `1`, BNB Chain `56`, Solana `501`
- Sıralama: engagement `1`, mentions `2`, impressions `3`
- Zaman: 24 saat `1`, 72 saat `2`, 7 gün `3`, 30 gün `4`
- Limit: 1–50
- Kimlik doğrulama: `OK-ACCESS-KEY`, `OK-ACCESS-SIGN`, `OK-ACCESS-PASSPHRASE`, `OK-ACCESS-TIMESTAMP`

Bu endpoint genel “Türkiye KOL listesi” üretmez. Önce token/ekosistem sepeti hazırlanır, dönen hesaplar ülke ve dil sınıflandırmasından geçirilir.

### Sorsa çağrı kapsamı

Temel URL: `https://api.sorsa.io/v3`

- Profil: `/info`, `/info-batch`, `/about`
- İçerik: `/user-tweets`, `/tweet-info`, `/comments`, `/quotes`, `/retweets`
- Keşif: `/search-tweets`, `/mentions`, `/search-users`
- Kitle: `/followers`, `/verified-followers`, `/followers-stats`, `/top-followers`
- Skor sinyali: `/score`, `/score-changes`
- Belgelenen hız sınırı: saniyede 20 istek
- Sayfalama: cursor tabanlıdır

Sorsa kendisini X'ten bağımsız, herkese açık veriyi salt okunur işleyen üçüncü taraf olarak tanımlar. Bu nedenle veri kullanım şartları ve X platform politikası ayrıca hukuk kontrolünden geçmelidir.

## 3. Hedef veri akışı

```text
Konu / token / ülke listesi
        ↓
OKX + Sorsa aday keşfi
        ↓
Kimlik çözümleme (handle, platform ID, profil URL)
        ↓
Ham snapshot + kaynak + ölçüm zamanı
        ↓
Normalizasyon ve tekrar kayıt temizleme
        ↓
Bot/anomali kontrolü + editör doğrulaması
        ↓
KOL sosyal metrikleri ve güven seviyesi
        ↓
Skor pipeline'ı / profil / kampanya eşleştirme
```

## 4. Alan eşleştirme kuralları

| Sağlayıcı alanı | KriptoKeyfi hedefi | Kural |
|---|---|---|
| OKX `handle`, `nickname` | KOL sosyal hesap kimliği | Önce platform ID; yoksa normalize handle ile aday eşleşme |
| OKX `followers` | Takipçi gözlemi | Sayı + kaynak + `observedAt`; mevcut değerin üzerine sessizce yazılmaz |
| OKX `engagement`, `mentions`, `impressions` | Sosyal metrik gözlemleri | Sağlayıcının zaman penceresiyle birlikte saklanır |
| OKX `firstMention.tweetUrl` | İçerik kanıtı / çağrı adayı | Otomatik doğruluk puanı verilmez; editör veya fiyat değerlendirmesi gerekir |
| Sorsa profil alanları | Sosyal hesap zenginleştirme | Handle değişimine karşı dış platform ID tercih edilir |
| Sorsa tweet sonuçları | İçerik ve çağrı adayları | Arama sorgusu ve cursor senkronizasyon kaydına eklenir |
| Sorsa takipçi istatistikleri | Topluluk kalitesi sinyali | Bot oranı diye doğrudan sunulmaz; model girdisi olarak etiketlenir |
| Sorsa Score | Harici referans sinyali | KriptoKeyfi skoru değildir; ayrı sağlayıcı metriği olarak tutulur |
| Growing3 çıktısı | Editör araştırma notu | Tarih, ekran/profil bağlantısı ve editör kimliğiyle manuel girilir |
| BitMart çıktısı | Araştırma/benchmark | İzin ve API olmadan kopyalanmaz veya otomatik çekilmez |

## 5. Adım adım altyapı planı

### Adım 1 — Sağlayıcı sözleşmesi

Her sağlayıcı için `key`, çalışma modu, yetenekler, yapılandırma durumu, resmî kaynak ve sınırlama tanımlanır. Sağlayıcı kapalıysa sistem sahte veri döndürmez; “yapılandırılmadı” durumu gösterir.

### Adım 2 — Anahtar ve erişim güvenliği

Anahtarlar yalnız backend ortamında tutulur:

```env
SORSA_API_KEY=""
SORSA_API_BASE_URL="https://api.sorsa.io/v3"
OKX_ONCHAIN_API_KEY=""
OKX_ONCHAIN_SECRET_KEY=""
OKX_ONCHAIN_PASSPHRASE=""
OKX_ONCHAIN_API_BASE_URL="https://web3.okx.com"
```

Üç OKX kimlik bilgisi birlikte zorunludur. Loglarda header, imza, anahtar veya ham hata gövdesi yazdırılmamalıdır.

### Adım 3 — Aday keşif stratejisi

1. Ülke başına dil, hashtag, ekosistem ve token sepeti oluştur.
2. OKX üzerinde token başına 7 ve 30 günlük en etkili hesapları çek.
3. Sorsa `/search-users`, `/search-tweets` ve `/mentions` ile konu adaylarını ekle.
4. Handle'ları küçük harfe çevir, `@` işaretini kaldır ve platform ID ile tekilleştir.
5. Ülke bilgisini otomatik kesin gerçek olarak atama; dil, bio, saat dilimi ve editör kontrolünden bir güven düzeyi üret.

Türkiye başlangıç sorguları: `kripto`, `bitcoin`, `altcoin`, `teknik analiz`, `DeFi`, `NFT`, `Solana`, `Ethereum`, `#kriptopara`. Marka ya da kişi hakkında negatif iddia üreten sorgular manuel incelemeye gider.

### Adım 4 — Ham veri ve senkronizasyon kaydı

Her çalışma şu üst veriyi taşımalıdır:

- sağlayıcı ve endpoint;
- istek kapsamı (gizli alanlar hariç);
- başlangıç/bitiş zamanı ve durum;
- okunan/yazılan kayıt sayısı;
- cursor veya sonraki sayfa;
- hata kodu ve yeniden deneme sayısı;
- ham gövde özeti/hash'i ve saklama süresi.

Ham payload süresiz saklanmamalı; sözleşme ve kişisel veri politikasıyla uyumlu bir retention süresi belirlenmelidir.

### Adım 5 — Zamanlama ve hız kontrolü

- Profil: 24 saatte bir
- Son içerikler: yüksek öncelikli KOL için 15–60 dakika; diğerleri 6 saat
- Takipçi/kitle: günde bir
- OKX token keşfi: 6 saatte bir; trend token için saatlik
- Başarısız istek: üstel bekleme + jitter, en fazla 3 otomatik deneme
- `429`: sağlayıcının `Retry-After` bilgisini uygula
- Aynı kapsam için dağıtık kilit kullan; iki worker aynı cursor'ı işlememeli

### Adım 6 — Doğrulama ve güven seviyesi

Her metrik `verified`, `confidence`, `sourceReference`, `observedAt` taşımalıdır.

- Yüksek güven: platform ID eşleşmiş, iki kaynaktan yakın sonuç veya API + editör onayı
- Orta güven: tek belgelenmiş API, kimlik eşleşmiş
- Düşük güven: handle tabanlı eşleşme, manuel üçüncü taraf ekranı veya eksik zaman penceresi
- Reddedildi: hesap belirsiz, ölçüm penceresi yok, bariz aykırı değer veya kaynak bağlantısı yok

### Adım 7 — Skora geçiş

Toplanan ham sosyal sayı doğrudan toplam skora girmez. Önce örneklem büyüklüğü, zaman penceresi, anomali, platform ve doğrulama seviyesi değerlendirilir. Kampanya dönüşümü ve geçmiş çağrı doğruluğu, sosyal popülerlikten ayrı bileşenler olarak kalır.

### Adım 8 — İzleme ve operasyon

Admin panelinde şu göstergeler bulunmalıdır:

- sağlayıcı yapılandırma durumu;
- son başarılı ve son hatalı senkronizasyon;
- gecikmiş işler;
- 401/403, 429 ve 5xx hata sayıları;
- kayıt başına maliyet ve günlük kota;
- eşleşemeyen KOL kimlikleri;
- editör inceleme kuyruğu.

## 6. Uygulama checklist'i

### Tamamlananlar

- [x] Sağlayıcı matrisi ve kullanım sınırları dokümante edildi.
- [x] Ortak sağlayıcı descriptor/registry yapısı eklendi.
- [x] Sorsa profil ve tweet arama adapter iskeleti eklendi.
- [x] OKX imzalama ve Top KOL çağrı adapter iskeleti eklendi.
- [x] İstekler için 15 saniye timeout ve açık hata durumu eklendi.
- [x] Backend ortam değişkenleri ve örnekleri eklendi.
- [x] Eksik OKX kimlik bilgilerinde uygulama başlangıç doğrulaması eklendi.
- [x] Admin için `GET /api/admin/kols/data-sources` durum endpoint'i eklendi.
- [x] `/kol-intelligence/data-sources` bilgilendirme sayfası eklendi.
- [x] Masaüstü ve mobil KOL Intelligence menüsüne “Veri Kaynakları” eklendi.
- [x] Sahte/demo API cevabı üretmeme kuralı uygulandı.

### Erişim gerektiren işler

- [ ] Sorsa paketi ve üretim API anahtarı alınacak.
- [ ] Sorsa anahtarı backend secret store'a tanımlanıp `/info` smoke testi yapılacak.
- [ ] OKX OnchainOS projesi ve üç erişim bilgisi alınacak.
- [ ] Ethereum, BNB ve Solana için birer Top KOL smoke testi yapılacak.
- [ ] Growing3 ticari kullanım ve veri dışa aktarım hakkı yazılı olarak teyit edilecek.
- [ ] BitMart'tan lisanslı API/partner erişimi olup olmadığı teyit edilecek.
- [ ] X ve üçüncü taraf sağlayıcıların saklama/gösterim şartları hukuk incelemesinden geçirilecek.

### Geliştirme kuyruğu

- [ ] `KOLDataSyncRun` senkronizasyon geçmişi modeli ve migration'ı eklenecek.
- [ ] Ham snapshot için şifreli/erişim kontrollü kısa süreli saklama eklenecek.
- [ ] Queue worker, cursor checkpoint, tekrar deneme ve idempotency kurulacak.
- [ ] Sağlayıcı yanıtları için Zod şemaları ve fixture tabanlı adapter testleri eklenecek.
- [ ] Kimlik çözümleme ve olası eşleşme editör kuyruğu eklenecek.
- [ ] Metrik normalizasyonu ile güven seviyesi hesaplayıcısı eklenecek.
- [ ] Admin paneline canlı durum, son senkronizasyon ve hata ekranı eklenecek.
- [ ] Türkiye pilotu için 14 mevcut aday üzerinde profil zenginleştirme çalıştırılacak.
- [ ] İlk 30 günlük veriyle bot/anomali eşikleri gözden geçirilecek.

## 7. İlk canlı pilot kabul kriteri

Pilot tamamlanmış sayılabilmesi için:

1. En az bir OKX ve bir Sorsa çağrısı başarıyla loglanmalı.
2. Aynı KOL iki kaynaktan gelirse tek profile eşleşmeli.
3. Her metrikte kaynak, ölçüm zamanı ve güven seviyesi görünmeli.
4. API kapalıyken mevcut doğrulanmış veri korunmalı; kullanıcıya uydurma güncel veri gösterilmemeli.
5. En az 14 Türkiye adayı editör kontrolünden geçmeli.
6. Sağlayıcı puanı ile KriptoKeyfi puanı arayüzde açık biçimde ayrılmalı.
7. Yeniden çalıştırma aynı gözlemi çoğaltmamalı.

## 8. Bir sonraki uygulama sırası

1. API erişimlerinin alınması ve smoke testler
2. Sync-run ve metric-observation veri modelleri
3. Worker ve normalizasyon pipeline'ı
4. Türkiye pilot veri toplaması
5. Admin inceleme ekranı
6. Ölçüm kalitesi raporu ve skor pipeline entegrasyonu

