# Kripto Keyfi Scam mi Degil mi Oyunu

Bu dokuman, `/games/scam-or-safe` rotasinda gelistirilen Scam mi Degil mi guvenlik egitim oyununun kapsamını, oyun mantigini, component yapisini ve servis sozlesmesini aciklar.

## Genel Amac

Scam mi Degil mi, kullanicinin token, proje, smart contract veya Web3 senaryolarindaki risk sinyallerini okuyup yorumlamasini saglayan egitim ve eglence odakli bir oyundur. Kullanici senaryoyu inceler, risk seviyesini tahmin eder ve ileri seviyelerde ana risk sebebini de secer. Cevap sonrasinda sistem dogru sonucu, puani, egitim aciklamasini ve ogrenme notunu gosterir.

Sayfada su uyari net gorunur:

> Bu oyun egitim ve eglence amaclidir. Gercek yatirim tavsiyesi veya finansal karar araci degildir.

Metinlerde kesin yatirim yonlendirmesi, al/sat sinyali veya kazanc vaadi kullanilmaz. Bunun yerine `yuksek risk sinyali tasiyor`, `guvenli gorunse de kesin garanti degildir`, `bu veri tek basina yeterli degildir` ve `egitim amacli degerlendirme` dili tercih edilir.

## Rotalar

- `/games`: Games merkezi.
- `/games/scam-or-safe`: Scam mi Degil mi oyun sayfasi.

`/games` sayfasindaki `Scam mi Degil mi?` karti aktif durumdadir ve `/games/scam-or-safe` rotasina yonlenir.

## Dosya Yapisi

- `frontend/src/components/ScamOrSafe.tsx`: Sayfa ve UI componentleri.
- `frontend/src/services/scamOrSafeService.ts`: Mock senaryolar, zorluklar, secenekler, puanlama, history ve stats fonksiyonlari.
- `frontend/src/services/gameService.ts`: Games katalog karti ve aktif durum.
- `frontend/src/App.tsx`: `/games/scam-or-safe` route tanimi.

## Component Yapisi

`ScamOrSafe.tsx` icindeki ana parcalar:

- `ScamOrSafePage`: Ana sayfa state ve oyun akisi.
- `DifficultySelector`: Baslangic, Orta, Ileri, Uzman zorluk secimi.
- `ScamScenarioCard`: Proje/token risk analiz karti.
- `RiskLevelOptions`: Guvenilir, Riskli, Scam riski yuksek secenekleri.
- `MainRiskOptions`: Ana risk sebebi secenekleri.
- `ScamResultPanel`: Cevap, puan, dogru/yanlis ve aciklama paneli.
- `ScamScorePanel`: Toplam puan, deneme, basari orani ve seri bilgileri.
- `ScamHistory`: Son cevaplar listesi.
- `RiskGlossary`: Risk kavramlari sozlugu.
- `LearningNoteBox`: Senaryo sonrasi egitim notu.
- `ContractCodeSnippet`: Solidity/mock contract kod parcasi.
- `GameDisclaimer`: Guvenli dil ve egitim/eglence uyarisi.
- `EmptyState`: Bos history durumu.

## Zorluk Seviyeleri

Baslangic:

- Amator kullanicilar icin basit proje karti.
- Teknik detay azdir.
- Yalnizca risk seviyesi secimi gerekir.

Orta:

- Tokenomics, likidite, holder dagilimi, sosyal medya ve audit bilgileri gosterilir.
- Risk seviyesi ve ana risk sebebi secilir.

Ileri:

- Smart contract kod parcasi, owner yetkileri, mint, blacklist ve honeypot sinyalleri gosterilebilir.
- Risk seviyesi ve ana risk sebebi secilir.

Uzman:

- Birden fazla risk sinyali karisik verilir.
- Kullanici hem sonucu hem de en baskin risk sebebini secmelidir.

## Oyun Akisi

1. Kullanici zorluk seviyesini secer.
2. Secilen zorluga uygun senaryo gelir.
3. Kullanici risk seviyesini secer:
   - Guvenilir gorunuyor
   - Riskli
   - Scam riski yuksek
4. Orta, Ileri ve Uzman seviyelerde ana risk sebebini secer.
5. Iki gerekli secim tamamlanmadan `Cevabi Goster` butonu aktif olmaz.
6. Cevap gosterildikten sonra secimler kilitlenir.
7. Sonuc panelinde kullanicinin secimi, dogru cevap, ana risk sebebi, puan, aciklama ve ogrenme notu gosterilir.
8. `Sonraki Senaryo` butonu ayni zorlukta yeni senaryoya gecer.

## Risk Seviyeleri

- `safe`: Guvenilir gorunuyor.
- `risky`: Riskli.
- `high_scam`: Scam riski yuksek.

UI renkleri:

- Guvenilir: yesil.
- Riskli: sari/turuncu.
- Scam riski yuksek: kirmizi.

## Ana Risk Sebepleri

Ana risk secenekleri:

- `mint_authority`: Mint yetkisi.
- `unlocked_liquidity`: Likidite kilitli degil.
- `owner_privileges`: Owner yetkisi.
- `honeypot`: Honeypot riski.
- `blacklist`: Blacklist fonksiyonu.
- `high_tax`: Asiri yuksek vergi.
- `fake_audit`: Sahte audit.
- `holder_concentration`: Holder yogunlasmasi.
- `new_project`: Yeni acilmis proje.
- `social_inconsistency`: Sosyal medya tutarsizligi.
- `low_risk`: Risk yok / dusuk risk.

## Mock Senaryo Alani

Her mock senaryo su alanlari icerir:

- `id`
- `title`
- `projectName`
- `tokenSymbol`
- `network`
- `difficulty`
- `projectAge`
- `holders`
- `liquidity`
- `liquidityLocked`
- `liquidityLockDuration`
- `auditStatus`
- `auditProvider`
- `ownerRenounced`
- `mintEnabled`
- `blacklistEnabled`
- `honeypotRisk`
- `buyTax`
- `sellTax`
- `topHoldersPercent`
- `contractVerified`
- `websiteStatus`
- `socialStatus`
- `codeSnippet`
- `riskSignals`
- `correctRiskLevel`
- `correctMainRisk`
- `explanation`
- `learningNote`

Ilk versiyonda en az 20 mock senaryo bulunur. Senaryolar su risk tiplerini kapsar:

- Basit scam ornegi.
- Likidite kilidi olmayan token.
- Sinirsiz mint yetkisi olan token.
- Honeypot riski olan token.
- Sell tax cok yuksek token.
- Holder yogunlasmasi yuksek token.
- Audit var ama riskli token.
- Dusuk riskli token.
- Owner renounced edilmis token.
- Proxy contract riski.
- Phishing airdrop senaryosu.
- Sahte website / sahte sosyal medya senaryosu.
- Fake partnership iddiasi.
- Yeni acilmis meme token.
- Gercekci DeFi proje senaryosu.

## Sonuc Mantigi

Sonuc panelinde gosterilenler:

- Dogru / yanlis etiketi.
- Kullanicinin risk seviyesi cevabi.
- Dogru risk seviyesi.
- Kullanicinin ana risk cevabi.
- Dogru ana risk sebebi.
- Egitim aciklamasi.
- `Bu senaryodan ne ogrenmelisin?` bolumu.
- Kazanilan sanal puan.

Baslangic seviyesinde ana risk secimi zorunlu degildir. Orta, Ileri ve Uzman seviyelerde ana risk sebebi de puanlamaya dahil edilir.

## Puanlama

- Dogru risk seviyesi: `+10`
- Dogru ana risk sebebi: `+15`
- Zorluk bonusu:
  - Baslangic: `+0`
  - Orta: `+5`
  - Ileri: `+10`
  - Uzman: `+15`

Zorluk bonusu risk seviyesi dogruysa eklenir. Baslangic seviyesinde ana risk sorusu sorulmaz.

## LocalStorage

Oyun verileri simdilik tarayici localStorage uzerinde tutulur:

- `scamOrSafeScore`: Toplam sanal puan.
- `scamOrSafeStats`: Toplam deneme, dogru cevap, seri ve skor ozeti.
- `scamOrSafeHistory`: Son cevap kayitlari.
- `selectedDifficulty`: Son secilen zorluk seviyesi.

History limiti `20` kayittir. UI tarafinda son 10 kayit gosterilir.

## Service API

`scamOrSafeService.ts` icindeki ana fonksiyonlar:

- `getScamScenarios()`: Tum mock senaryolari dondurur.
- `getScenarioByDifficulty(difficulty)`: Zorluga uygun varsayilan senaryoyu dondurur.
- `getNextScenario(difficulty, currentId)`: Ayni zorlukta yeni senaryo secer.
- `submitScamGuess(scenario, selectedRiskLevel, selectedMainRisk)`: Cevabi puanlar.
- `calculateScamScore(scenario, selectedRiskLevel, selectedMainRisk)`: Skor hesaplar.
- `saveScamHistory(item)`: History kaydi ekler.
- `getScamHistory()`: History listesini okur.
- `getScamStats()`: Stats bilgisini okur.
- `saveScamStats(previousStats, result)`: Stats bilgisini gunceller.
- `getSavedDifficulty()`: Kayitli zorluk seviyesini okur.
- `saveSelectedDifficulty(difficulty)`: Zorluk seviyesini kaydeder.
- `getRiskLevelLabel(riskLevel)`: Risk seviyesi label dondurur.
- `getMainRiskLabel(mainRisk)`: Ana risk label dondurur.
- `needsMainRisk(difficulty)`: Zorluk icin ana risk sorusu gerekip gerekmedigini dondurur.

Bu yapi ileride gercek contract scanner, honeypot checker veya backend risk analizi sistemine baglanmaya hazirdir.

## Gelecek API Hazirligi

Ileride baglanabilecek kaynaklar:

- Contract scanner backend servisi.
- Honeypot checker backend servisi.
- Token holder analiz servisi.
- Liquidity lock kontrol servisi.
- Audit metadata servisi.
- Etherscan / BscScan / explorer tabanli backend veri toplayici.

API key gerektiren hicbir bilgi frontend'e gomulmemelidir. Gercek risk analizi backend uzerinden normalize edilmis veri olarak frontend'e verilmelidir.

## UI ve Responsive Davranis

Desktop duzeni:

- Sol ana alan:
  - Baslik ve durum kartlari
  - Uyari
  - Zorluk secimi
  - Senaryo karti
  - Risk seviyesi secimi
  - Ana risk secimi
  - Sonuc paneli
- Sag panel:
  - Skor
  - Son cevaplar
  - Risk sozlugu

Mobil duzeni:

- Tek kolon.
- Sag panel icerikleri ana akisin altina iner.
- Secenekler buyuk butonlar halinde gosterilir.
- Kod blogu yatay tasma olmadan scroll edilebilir.

Tasarim mevcut Kripto Keyfi koyu tema, kart tabanli yapi ve guvenlik egitimi diliyle uyumludur.
