# Trading Playbook — KriptoKeyfi Bot Ordusu

**Versiyon:** v1.0
**Amaç:** Bu dosya, otonom trading botlarının (Candidate → Challenger → Champion → Live Eligible) karar motoruna beslenecek kural setidir. Bot bir LLM tabanlı karar veriyorsa bu dosya system prompt / context olarak verilir. Rule-engine tabanlıysa buradaki eşikler doğrudan koda çevrilir.

**Güncelleme kuralı:** Bu dosya statik değildir. Researcher modülü Trade Memory'yi periyodik taradıkça yeni bulgular buraya eklenir ve versiyon numarası artırılır (v1.0 → v1.1 ...). Her versiyon, önceki versiyonla A/B test edilir; kazanan versiyon ana playbook olur.

---

## 1. Piyasa Rejimi Tespiti (her kararın ilk adımı)

Bot, pozisyon açmadan önce mevcut rejimi sınıflandırmalı:

| Rejim | Tespit kriteri | Uygun strateji ailesi |
|---|---|---|
| **TREND (bull/bear)** | 1H ve 4H EMA(50) ile EMA(200) aynı yönde ayrışıyor, ADX > 25 | Momentum / Trend-following |
| **RANGE** | ADX < 20, fiyat son 50 mumda belirli bant içinde | Mean-reversion / Range trading |
| **YÜKSEK VOLATİLİTE** | ATR son 20 mumun ortalamasının %150'sinden fazla | Pozisyon boyutunu küçült, breakout stratejisi opsiyonel |
| **BELİRSİZ** | Yukarıdakilerin hiçbiri net değil | **İşlem açma** — bekle |

**Kural:** Rejim "BELİRSİZ" ise bot işlem açmamalı. Zorla işlem açmaya çalışmak acemi botların en büyük hatasıdır.

## 2. Çoklu Zaman Dilimi Teyidi

- **Üst zaman dilimi (4H/1H):** yön filtresi — sadece trendin yönünde işlem aç.
- **Orta zaman dilimi (15dk):** yapı teyidi — destek/direnç, swing high/low.
- **Alt zaman dilimi (5dk/1dk):** giriş tetiği — momentum onayı, hacim artışı.

**Kural:** Üç zaman diliminden en az ikisi aynı yönü işaret etmiyorsa işlem açma.

## 3. Vadeli İşlemlere Özgü Sinyaller (sadece fiyat grafiği yetersiz)

- **Funding rate:** Aşırı pozitif funding = piyasa aşırı long, tersine dönüş riski. Aşırı negatif = aşırı short, short squeeze riski.
- **Open Interest (OI):** Fiyat yükselirken OI artıyorsa trend sağlıklı (yeni para giriyor). Fiyat yükselirken OI düşüyorsa short kapanışı — trend zayıf olabilir.
- **Liquidation kümeleri:** Yakın likidasyon bölgeleri potansiyel hedef/mıknatıs seviyeleridir.

**Kural:** Momentum sinyali OI artışıyla teyit edilmiyorsa pozisyon boyutunu yarıya indir.

## 4. Giriş Kriterleri (checklist — hepsi karşılanmadan giriş yok)

- [ ] Rejim net (TREND veya RANGE, BELİRSİZ değil)
- [ ] Üst zaman dilimi yön filtresiyle uyumlu
- [ ] En az 2/3 zaman dilimi teyidi
- [ ] Risk/Ödül oranı ≥ 1:1.5
- [ ] Mevcut açık pozisyon sayısı bot/portföy limitini aşmıyor
- [ ] Funding/OI sinyali yönle çelişmiyor

## 5. Pozisyon Boyutlandırma ve Risk

- **Sabit risk yüzdesi:** Her işlemde toplam sermayenin sabit bir yüzdesi (ör. %0.5–1) riske edilir — kazanç/kayıp serisine göre büyütülüp küçültülmez (Martingale YASAK).
- **Kaldıraç üst sınırı:** Bot rejim güveni düşükse kaldıraç otomatik düşürülür.
- **Kayıp serisi kuralı:** Art arda 3 kayıp sonrası bot 24 saat "gözlem moduna" (paper'a) geçer, insan/Teacher onayı olmadan tekrar live açılmaz.
- **Günlük zarar durdurma:** Bot bazlı günlük max drawdown eşiği aşılırsa o gün için tüm yeni girişler durur.

## 6. Kâr Alma Mantığı ("maksimum kâr" değil, "disiplinli kâr")

- **Kademeli TP:** Pozisyonun bir kısmı ilk hedefte kapatılır (risk sıfırlanır), kalan kısım trailing stop ile trend bitene kadar taşınır.
- **Trailing stop:** Sabit TP yerine, trend devam ettikçe stop seviyesi yukarı (long) / aşağı (short) çekilir — "maksimum kâr alma" isteğinin gerçekçi karşılığı budur.
- **Rejim değişimi çıkışı:** Rejim TREND'den RANGE/BELİRSİZ'e döndüğünde pozisyon kapatılır, sinyal beklenmez.

## 7. Acemi Hata Kalıpları (bunlardan kaçın — Trade Memory'de sık görülen desenler)

> Bu bölüm Researcher modülü tarafından güncellenecek. Şimdilik genel kural seti:

- Düşük win rate + düşük risk/ödül oranı kombinasyonu = sistemik hata, tek tek işlem değil. Win rate'e değil, **expectancy**'ye (ortalama kazanç × win rate − ortalama kayıp × loss rate) bak.
- Aynı yönde art arda çok sayıda korelasyonlu pozisyon açmak (ör. 10 farklı altcoin long) tek bir büyük pozisyon riskiyle aynıdır — portföy limiti bunu engellemeli.
- Haber/olay öncesi (funding değişimi, büyük ekonomik veri) volatilite genişlemesinde pozisyon boyutu otomatik küçültülmeli.

## 8. Kendi Kendini Geliştirme Döngüsü

1. **Veri toplama:** Her kapanmış işlem (entry/exit, PnL, MFE/MAE, close_reason, rejim) Trade Memory'ye kaydedilir — bu zaten mevcut yapıda var.
2. **Retrospektif analiz (Researcher):** Haftalık, kapanma nedenine (STOP_LOSS/TAKE_PROFIT) ve rejime göre gruplanmış performans analizi. Hangi strateji-rejim kombinasyonu sistematik kayıp veriyor?
3. **Playbook güncelleme (Teacher):** Bulgular bu dosyaya yeni kural/kısıt olarak eklenir, versiyon artırılır.
4. **A/B test:** Yeni versiyon sadece yeni Candidate botlara verilir; eski versiyon mevcut Champion'larda kalır. N işlem sonra iki grup karşılaştırılır.
5. **Terfi/rotasyon:** Kazanan versiyon ana playbook olur, kaybeden versiyon arşivlenir (geri dönüş için saklanır, silinmez).

---

## Değişiklik Geçmişi

| Versiyon | Tarih | Değişiklik |
|---|---|---|
| v1.0 | — | İlk sürüm |
