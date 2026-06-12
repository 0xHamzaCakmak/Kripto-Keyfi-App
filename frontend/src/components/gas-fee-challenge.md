# Kripto Keyfi Gas Fee Challenge Oyunu

Bu dokuman, `/games/gas-fee-challenge` rotasinda gelistirilen Gas Fee Challenge egitim/tahmin oyununun kapsamını, oyun mantigini, component yapisini ve servis sozlesmesini aciklar.

## Genel Amac

Gas Fee Challenge, kullanicinin Ethereum, Layer-2 ve farkli blockchain aglarinda islem ucretlerini, gas fee, Gwei, ag yogunlugu ve L1/L2 farklarini ogrenmesini saglayan egitim ve eglence odakli bir oyundur. Kullanici secilen moda gore gas yonunu, yaklasik islem maliyetini, en ucuz agi veya Layer-2 mantigini tahmin eder.

Sayfada su uyari net gorunur:

> Bu oyun egitim ve eglence amaclidir. Gercek islem, yatirim tavsiyesi veya finansal kazanc sistemi degildir.

Metinlerde kesin maliyet, islem yapma yonlendirmesi, kazanc vaadi veya trade sinyali kullanilmaz. Bunun yerine `genellikle`, `tahmini`, `egitim amacli`, `yaklasik maliyet` ve `ag yogunluguna gore degisebilir` dili tercih edilir.

## Rotalar

- `/games`: Games merkezi.
- `/games/gas-fee-challenge`: Gas Fee Challenge oyun sayfasi.

`/games` sayfasindaki Gas Fee Challenge karti aktif durumdadir ve `/games/gas-fee-challenge` rotasina yonlenir.

## Dosya Yapisi

- `frontend/src/components/GasFeeChallenge.tsx`: Sayfa ve UI componentleri.
- `frontend/src/services/gasFeeChallengeService.ts`: Mock senaryolar, modlar, zorluklar, puanlama, history ve stats fonksiyonlari.
- `frontend/src/services/gameService.ts`: Games katalog karti ve aktif durum.
- `frontend/src/App.tsx`: `/games/gas-fee-challenge` route tanimi.

## Component Yapisi

`GasFeeChallenge.tsx` icindeki ana parcalar:

- `GasFeeChallengePage`: Ana sayfa state ve oyun akisi.
- `GasModeSelector`: Oyun modu secimi.
- `GasDifficultySelector`: Zorluk secimi.
- `GasScenarioCard`: Gas senaryo karti ve teknik metrikler.
- `GasAnswerOptions`: Cevap secenekleri.
- `GasResultPanel`: Dogru/yanlis, puan, aciklama ve ogrenme notu.
- `GasScorePanel`: Toplam puan, deneme, basari orani ve seri bilgileri.
- `GasHistory`: Son cevaplar.
- `GasGlossary`: Gas kavramlari sozlugu.
- `GasComparisonTable`: Ag ucret karsilastirma tablosu.
- `GasLearningNote`: Senaryo sonrasi egitim notu.
- `GameDisclaimer`: Guvenli dil ve egitim/eglence uyarisi.
- `EmptyState`: Bos history durumu.

## Oyun Modlari

Gas Yonu Tahmini:

- Kullanici 5 dakika sonra gas fee hangi araliga gider tahmin eder.
- Pending tx, ag durumu ve event bilgisi kullanilir.

Islem Maliyeti Tahmini:

- Kullanici verilen islem turunun yaklasik dolar maliyetini tahmin eder.
- Ornek islem turleri: ETH Transfer, ERC20 Transfer, Swap, NFT Mint, Bridge, Contract Deploy.

En Ucuz Ag Hangisi:

- Ayni islem icin genellikle en dusuk ucretli ag secilir.
- Ethereum, Arbitrum, Base, Polygon, BNB Chain gibi aglar karsilastirilir.

Layer-2 Karsilastirmasi:

- Kullanici L1/L2 maliyet farkini ve rollup mantigini yorumlar.
- Ag ucret karsilastirma tablosu gosterilebilir.

## Zorluk Seviyeleri

Baslangic:

- Basit ag ve islem maliyeti sorulari.
- Yeni kullanicilar icin okunabilir aciklamalar.

Orta:

- Pending tx, network congestion, Gwei ve islem turu bilgisi.

Ileri:

- Birden fazla ag, L1/L2 farki, NFT mint, swap, bridge ve contract deploy gibi daha karmasik senaryolar.

## Oyun Akisi

1. Kullanici oyun modunu secer.
2. Zorluk seviyesini secer.
3. Secilen mod ve zorluga uygun senaryo gelir.
4. Kullanici cevap secenegini secer.
5. `Cevabi Goster` butonuna basar.
6. Sonuc, aciklama, ogrenme notu ve puan gosterilir.
7. `Sonraki Senaryo` butonu ayni mod ve zorlukta yeni senaryoya gecer.

## Senaryo Alani

Her mock senaryo su alanlari icerir:

- `id`
- `mode`
- `difficulty`
- `title`
- `network`
- `transactionType`
- `currentGasGwei`
- `pendingTx`
- `networkStatus`
- `gasLimit`
- `estimatedCostUsd`
- `question`
- `options`
- `correctAnswer`
- `explanation`
- `learningNote`
- `comparisonTable`

Mode degerleri:

- `gas_direction`
- `transaction_cost`
- `cheapest_network`
- `layer2_compare`

Difficulty degerleri:

- `beginner`
- `intermediate`
- `advanced`

Ilk versiyonda en az 24 mock senaryo bulunur. Senaryolar Ethereum, Arbitrum, Base, Polygon, BNB Chain, Optimism ve multi-chain karsilastirmalari kapsar.

## Ag Ucret Karsilastirma Tablosu

`cheapest_network` ve `layer2_compare` modlarinda senaryoya bagli karsilastirma tablosu gosterilebilir.

Tablo alanlari:

- Network
- Gas / Gwei
- Tahmini maliyet
- Not

Bu tablo kullaniciya Ethereum ana aginin genellikle daha pahali, Layer-2 ve bazi alternatif aglarin ise genellikle daha dusuk maliyetli olabilecegini egitim amacli anlatir.

## Puanlama

- Dogru cevap: `+20`
- Orta zorluk bonusu: `+5`
- Ileri zorluk bonusu: `+10`
- Yanlis cevap: `+0`
- Her 3 dogru seri icin ekstra bonus: `+10`

Puan localStorage uzerinde tutulur.

## LocalStorage

Oyun verileri simdilik tarayici localStorage uzerinde tutulur:

- `gasFeeChallengeScore`: Toplam sanal puan.
- `gasFeeChallengeStats`: Toplam deneme, dogru cevap, mevcut seri ve en iyi seri.
- `gasFeeChallengeHistory`: Son cevap kayitlari.
- `selectedGasMode`: Son secilen oyun modu.
- `selectedGasDifficulty`: Son secilen zorluk.

History limiti `20` kayittir. UI tarafinda son 10 kayit gosterilir.

## Service API

`gasFeeChallengeService.ts` icindeki ana fonksiyonlar:

- `getGasFeeScenarios()`: Tum mock senaryolari dondurur.
- `getScenarioByModeAndDifficulty(mode, difficulty)`: Moda ve zorluga uygun varsayilan senaryoyu dondurur.
- `getNextGasScenario(mode, difficulty, currentId)`: Ayni mod/zorlukta yeni senaryo secer.
- `submitGasFeeAnswer(scenario, selectedAnswer, currentStreak)`: Cevabi puanlar.
- `calculateGasScore(scenario, selectedAnswer, currentStreak)`: Skor ve seri bonusu hesaplar.
- `saveGasFeeHistory(item)`: History kaydi ekler.
- `getGasFeeHistory()`: History listesini okur.
- `getGasFeeStats()`: Stats bilgisini okur.
- `saveGasFeeStats(previousStats, result)`: Stats bilgisini gunceller.
- `getSavedGasMode()`: Kayitli modu okur.
- `getSavedGasDifficulty()`: Kayitli zorlugu okur.
- `saveGasMode(mode)`: Mod secimini kaydeder.
- `saveGasDifficulty(difficulty)`: Zorluk secimini kaydeder.
- `getModeLabel(mode)`: Mod label dondurur.
- `getDifficultyLabel(difficulty)`: Zorluk label dondurur.

Bu yapi ileride gercek gas fee API veya backend gas monitoring servisine baglanmaya hazirdir.

## Gelecek API Hazirligi

Ileride baglanabilecek kaynaklar:

- Ethereum gas tracker.
- Etherscan Gas Oracle.
- Alchemy.
- Blocknative.
- Backend gas monitoring service.

API key gerektiren hicbir bilgi frontend'e gomulmemelidir. Gercek entegrasyon backend uzerinden normalize edilmis gas verisiyle yapilmalidir.

## Gas Sozlugu

Sayfada kisa gas sozlugu bulunur:

- Gas
- Gwei
- Gas Limit
- Base Fee
- Priority Fee
- Pending Transaction
- Network Congestion
- Layer-2
- Rollup
- Bridge
- Contract Deploy
- Swap
- Approve

Her kavram kisa ve okunabilir sekilde aciklanir.

## UI ve Responsive Davranis

Desktop duzeni:

- Sol ana alan:
  - Baslik ve durum kartlari
  - Uyari
  - Mod secimi
  - Zorluk secimi
  - Senaryo karti
  - Cevap secenekleri
  - Sonuc paneli
- Sag panel:
  - Skor
  - Son cevaplar
  - Gas sozlugu

Mobil duzeni:

- Tek kolon.
- Sag panel icerikleri ana akisin altina iner.
- Mod ve zorluk secimleri buyuk dokunulabilir butonlar olarak gosterilir.

Tasarim mevcut Kripto Keyfi koyu tema, kart tabanli yapi ve teknik ama okunabilir egitim diliyle uyumludur.
