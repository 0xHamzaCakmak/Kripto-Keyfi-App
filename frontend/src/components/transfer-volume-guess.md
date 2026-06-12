# Kripto Keyfi Transfer Volume Guess Oyunu

Bu dokuman, `/games/transfer-volume-guess` rotasinda gelistirilen Transfer Volume Guess on-chain egitim/tahmin oyununun kapsamını, oyun mantigini, component yapisini ve servis sozlesmesini aciklar.

## Genel Amac

Transfer Volume Guess, kullanicinin belirli bir coin/ag secip kisa bir sure icinde toplam ne kadar transfer hacmi olusacagini tahmin ettigi egitim ve eglence odakli bir oyundur. Oyun basladiginda mock transfer feed'i calisir, gelen transferler toplam hacme eklenir ve sure sonunda kullanicinin tahmini gerceklesen mock hacimle karsilastirilir.

Sayfada su uyari net gorunur:

> Bu oyun egitim ve eglence amaclidir. Gercek yatirim tavsiyesi veya finansal kazanc sistemi degildir.

Oyun gercek trade, yatirim tavsiyesi, bahis veya finansal kazanc sistemi degildir. Metinlerde kesin piyasa yonu, al/sat sinyali veya para kazanma vaadi kullanilmaz.

## Rotalar

- `/games`: Games merkezi.
- `/games/transfer-volume-guess`: Transfer Volume Guess oyun sayfasi.

`/games` sayfasindaki Transfer Volume Guess karti aktif durumdadir ve `/games/transfer-volume-guess` rotasina yonlenir.

## Dosya Yapisi

- `frontend/src/components/TransferVolumeGuess.tsx`: Sayfa ve UI componentleri.
- `frontend/src/services/transferVolumeGameService.ts`: Desteklenen aglar, mock transfer uretimi, oyun sonucu, history ve stats fonksiyonlari.
- `frontend/src/services/gameService.ts`: Games katalog karti ve aktif durum.
- `frontend/src/App.tsx`: `/games/transfer-volume-guess` route tanimi.

## Component Yapisi

`TransferVolumeGuess.tsx` icindeki ana parcalar:

- `TransferVolumeGuessPage`: Ana sayfa state ve oyun akisi.
- `AssetSelector`: Coin/ag secimi.
- `DurationSelector`: 1, 3 veya 5 dakika sure secimi.
- `PredictionInput`: Tahmin miktari girisi ve oyunu baslatma.
- `TransferVolumeDashboard`: Canli toplam hacim, transfer sayisi, ortalama ve en buyuk transfer paneli.
- `LiveTransferFeed`: Explorer benzeri son transfer listesi.
- `TransferRow`: Tek transfer satiri.
- `VolumeResultPanel`: Sure sonu sonuc ve puan paneli.
- `TransferVolumeStatsPanel`: Skor ozeti.
- `TransferVolumeHistoryPanel`: Son oyunlar.
- `EducationNotes`: Transfer hacmi egitim notlari.
- `GameDisclaimer`: Guvenli dil ve egitim/eglence uyarisi.
- `EmptyState`: Bos liste durumlari.

## Oyun Akisi

1. Kullanici coin/ag secer.
2. Sure secer:
   - 1 dakika
   - 3 dakika
   - 5 dakika
3. Tahmin miktarini sayisal olarak girer.
4. `Oyunu Baslat` butonu tahmin girilmeden aktif olmaz.
5. Oyun basladiginda secili coin/ag, sure ve tahmin kilitlenir.
6. Her 1-4 saniye arasinda secili ag icin mock transfer uretilir.
7. Uretilen transferler:
   - Son transferler feed'ine eklenir.
   - Toplam hacme eklenir.
   - Transfer sayisini artirir.
   - Ortalama ve en buyuk transfer metriklerini gunceller.
8. Sure bitince sonuc hesaplanir.
9. Kullanici `Tekrar Oyna` veya `Coin Degistir` aksiyonlariyla devam eder.

## Desteklenen Coin / Aglar

Ilk versiyonda desteklenen secenekler:

- Ethereum / ETH
- Bitcoin / BTC
- BNB Chain / BNB
- Arbitrum / ETH
- Base / ETH
- Polygon / MATIC
- USDT / Ethereum
- USDC / Ethereum

Her kartta coin sembolu, ag adi, ikon, mock aktivite etiketi ve destek durumu gosterilir.

## Mock Transfer Feed

Transfer feed alani Explorer hissi verecek sekilde tasarlanir. Son 10 transfer gosterilir.

Her transfer satiri:

- Tx hash kisa hali
- From adresi veya etiket
- To adresi veya etiket
- Miktar
- Coin sembolu
- Zaman
- Mock explorer butonu

Aglara gore mock format:

- Ethereum, Arbitrum, Base, Polygon, BNB Chain: `0x` formatli adres ve tx hash.
- Bitcoin: `bc1` benzeri mock adresler ve 64 karakter hash.
- Stablecoin transferleri: USDT/USDC miktarlari daha genis araliklarda uretilir.

## Mock Transfer Uretimi

Secili coin/ag icin rastgele ama mantikli araliklarda transfer uretilir.

ETH:

- Kucuk: `0.1 - 5 ETH`
- Orta: `5 - 50 ETH`
- Nadir buyuk: `100 - 1000 ETH`

BTC:

- Kucuk: `0.01 - 0.3 BTC`
- Orta: `0.3 - 2 BTC`
- Nadir buyuk: `2 - 20 BTC`

USDT / USDC:

- Kucuk: `100 - 5.000`
- Orta: `5.000 - 100.000`
- Nadir buyuk: `100.000 - 5.000.000`

BNB:

- Kucuk: `1 - 20 BNB`
- Orta: `20 - 300 BNB`
- Nadir buyuk: `300 - 3000 BNB`

MATIC:

- Kucuk: `100 - 5.000 MATIC`
- Orta: `5.000 - 50.000 MATIC`
- Nadir buyuk: `50.000 - 750.000 MATIC`

## Sonuc Mantigi

Sure sonunda:

- `actualVolume` hesaplanir.
- `predictionAmount` ile karsilastirilir.
- `difference` hesaplanir.
- `percentageError` hesaplanir.

Basarili kabul:

```text
difference <= max(assetMinTolerance, actualVolume * 0.10)
```

Yakin sonuc:

```text
difference <= max(assetMinTolerance * 2, actualVolume * 0.20)
```

Sonuc durumlari:

- `Basarili`
- `Yaklastin`
- `Basarisiz`

## Puanlama

- Basarili: `+30`
- Yaklastin: `+10`
- Basarisiz: `+0`

## LocalStorage

Oyun verileri simdilik tarayici localStorage uzerinde tutulur:

- `transferVolumeStats`: Toplam puan, toplam deneme, basarili deneme ve en iyi tahmin hatasi.
- `transferVolumeHistory`: Son oyun sonuclari.

History limiti `20` kayittir. UI tarafinda son 10 kayit gosterilir.

## Service API

`transferVolumeGameService.ts` icindeki ana fonksiyonlar:

- `getSupportedAssets()`: Desteklenen coin/ag seceneklerini dondurur.
- `generateMockTransfer(asset)`: Secili asset icin mock transfer uretir.
- `getLatestTransfers(asset, count)`: Baslangic feed'i icin mock transfer listesi dondurur.
- `startTransferVolumeGame(config)`: Oyun state'ini baslatir.
- `finishTransferVolumeGame(gameState)`: Sonucu ve puani hesaplar.
- `saveTransferVolumeHistory(result)`: History kaydi ekler.
- `getTransferVolumeHistory()`: History listesini okur.
- `getTransferVolumeStats()`: Stats bilgisini okur.
- `saveTransferVolumeStats(previousStats, result)`: Stats bilgisini gunceller.
- `formatTransferAmount(amount, asset)`: Miktari coin semboluyle formatlar.
- `shortenAddress(value)`: Adres veya hash kisaltir.

Bu yapi ileride gercek API entegrasyonuna hazirdir. API key gerektiren hicbir bilgi frontend'e gomulmemelidir.

## Gelecek API Hazirligi

Ileride baglanabilecek kaynaklar:

- Ethereum / EVM icin Etherscan, Alchemy, Moralis veya backend listener servisi.
- BNB Chain icin BscScan.
- Bitcoin icin Blockstream veya Mempool API.
- Backend whale/transfer listener servisi.

Gercek entegrasyon backend uzerinden yapilmalidir. Frontend yalnizca normalize edilmis transfer verisini kullanmalidir.

## UI ve Responsive Davranis

Desktop duzeni:

- Sol ana alan:
  - Baslik ve durum kartlari
  - Uyari
  - Coin/ag secimi
  - Sure secimi
  - Tahmin girisi
  - Canli hacim paneli
  - Sonuc paneli
  - Son transferler feed'i
- Sag panel:
  - Skor ozeti
  - Son oyunlar
  - Egitim notlari

Mobil duzeni:

- Tek kolon.
- Sag panel icerikleri ana akisin altina iner.

Tasarim mevcut Kripto Keyfi koyu tema, kart tabanli yapi ve Web3 arayuz diliyle uyumludur.
