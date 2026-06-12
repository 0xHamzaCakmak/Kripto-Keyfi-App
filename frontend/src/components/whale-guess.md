# Kripto Keyfi Whale Guess Oyunu

Bu dokuman, `/games/whale-guess` rotasinda gelistirilen Whale Guess on-chain egitim/tahmin oyununun kapsamını, oyun mantigini, component yapisini ve servis sozlesmesini aciklar.

## Genel Amac

Whale Guess, kullanicinin buyuk cuzdan hareketlerini okuyup yorumlamasini ogreten egitim ve eglence odakli bir oyundur. Kullaniciya mock bir whale transfer senaryosu gosterilir; kullanici hareketin piyasa etkisini ve transfer tipini tahmin eder. Cevap gosterildiginde dogru sonuc, sanal puan, aciklama ve ogrenme notu sunulur.

Sayfada su uyari net gorunur:

> Bu oyun egitim ve eglence amaclidir. Gercek yatirim tavsiyesi, trade sinyali veya finansal kazanc sistemi degildir.

Metinlerde kesin yukselis/dusus, al/sat sinyali veya para kazanma vaadi kullanilmaz. Bunun yerine `genellikle yorumlanir`, `potansiyel sinyal olabilir`, `tek basina kesin sonuc uretmez` ve `egitim amaclidir` dili tercih edilir.

## Rotalar

- `/games`: Games merkezi.
- `/games/whale-guess`: Whale Guess oyun sayfasi.

`/games` sayfasindaki Whale Guess karti aktif durumdadir ve `/games/whale-guess` rotasina yonlenir.

## Dosya Yapisi

- `frontend/src/components/WhaleGuess.tsx`: Sayfa ve UI componentleri.
- `frontend/src/services/whaleGuessService.ts`: Mock senaryolar, secenekler, puanlama, history ve stats fonksiyonlari.
- `frontend/src/services/gameService.ts`: Games katalog karti ve aktif durum.
- `frontend/src/App.tsx`: `/games/whale-guess` route tanimi.

## Component Yapisi

`WhaleGuess.tsx` icindeki ana parcalar:

- `WhaleGuessPage`: Ana sayfa state ve oyun akisi.
- `WhaleTransferCard`: Whale transfer senaryosu karti.
- `SentimentOptions`: Bullish / Bearish / Neutral secenekleri.
- `FlowTypeOptions`: Transfer tipi secenekleri.
- `GuessResultPanel`: Cevap, puan, aciklama ve ogrenme notu.
- `WhaleScorePanel`: Toplam puan, deneme, basari orani ve seri bilgileri.
- `WhaleGuessHistory`: Son tahminler listesi.
- `WhaleEducationPanel`: Whale hareketlerini okuma notlari.
- `FlowTypeGlossary`: Acilir/kapanir transfer tipi sozlugu.
- `GameDisclaimer`: Guvenli dil ve risk uyarisi.
- `EmptyState`: Bos history durumu.

## Oyun Akisi

1. Kullanici bir whale transfer senaryosu gorur.
2. Piyasa etkisi tahminini secer:
   - Bullish
   - Bearish
   - Neutral
3. Transfer tipi tahminini secer:
   - Exchange Inflow
   - Exchange Outflow
   - Wallet to Wallet
   - Bridge
   - Staking
   - Mint / Burn
   - Unknown
4. Iki secim yapilana kadar `Cevabi Goster` butonu pasiftir.
5. Cevap gosterildikten sonra secimler kilitlenir.
6. Sonuc panelinde kullanicinin secimi, dogru cevap, kazanilan puan, aciklama ve ogrenme notu gosterilir.
7. `Sonraki Whale` butonu yeni senaryoya gecer.
8. Ayni senaryo ust uste gelmez.

## Puanlama

- Sentiment dogruysa: `+10`
- Flow type dogruysa: `+15`
- Ikisi de dogruysa bonus: `+5`
- Maksimum toplam: `+30`

Yanlis cevapta kullanici dogru olan kisimlardan puan alabilir. Aciklama ve ogrenme notu her durumda gosterilir.

## Mock Senaryo Alani

Her mock senaryo su alanlari icerir:

- `id`
- `asset`
- `assetName`
- `network`
- `amount`
- `amountUsd`
- `fromLabel`
- `fromAddress`
- `toLabel`
- `toAddress`
- `txHash`
- `timestamp`
- `severity`
- `correctSentiment`
- `correctFlowType`
- `explanation`
- `learningNote`

Ilk versiyonda en az 12 mock senaryo bulunur:

- BTC Wallet -> Binance
- ETH Coinbase -> Unknown Wallet
- USDT Treasury Mint
- USDC Burn
- ETH Wallet -> Staking Contract
- USDC Ethereum -> Arbitrum Bridge
- BNB Unknown Wallet -> Binance
- SOL Exchange -> Wallet
- BTC Wallet -> Wallet
- ETH Whale -> Kraken
- USDT Binance -> Unknown Wallet
- MATIC Bridge Transfer

## LocalStorage

Oyun verileri simdilik tarayici localStorage uzerinde tutulur:

- `whaleGuessScore`: Toplam sanal puan.
- `whaleGuessStats`: Deneme, dogru tahmin, seri ve skor ozeti.
- `whaleGuessHistory`: Son tahmin kayitlari.

History limiti `20` kayittir. UI tarafinda son 10 kayit gosterilir.

## Service API

`whaleGuessService.ts` icindeki ana fonksiyonlar:

- `getMockWhaleScenario()`: Varsayilan mock senaryoyu dondurur.
- `getNextWhaleScenario(currentId)`: Mevcut senaryo disinda yeni senaryo secer.
- `submitWhaleGuess(scenario, selectedSentiment, selectedFlowType)`: Cevabi puanlar.
- `getWhaleGuessStats()`: Stats bilgisini localStorage'dan okur.
- `saveWhaleGuessStats(previousStats, result)`: Stats bilgisini gunceller.
- `getWhaleGuessHistory()`: History listesini okur.
- `saveWhaleGuessHistory(item)`: Yeni history kaydi ekler.
- `getFlowTypeLabel(flowType)`: Flow type label dondurur.
- `getSentimentLabel(sentiment)`: Sentiment label dondurur.
- `shortenAddress(address)`: Adres/hash kisaltir.

Bu yapi ileride gercek API entegrasyonuna hazirdir. API key gerektiren hicbir bilgi frontend'e gomulmemelidir. Gercek veri ihtiyaci backend uzerinden karsilanmalidir.

## Gelecek API Hazirligi

Ileride baglanabilecek kaynaklar:

- Whale Alert API
- Etherscan / BscScan / Blockstream
- Alchemy / Moralis
- Backend whale-listener servisi

Gercek transferler frontend'e dogrudan API key ile cekilmemelidir. Backend, veriyi normalize edip `WhaleScenario` benzeri bir formata donusturmelidir.

## UI ve Responsive Davranis

Desktop duzeni:

- Sol ana alan:
  - Baslik ve durum kartlari
  - Uyari
  - Whale transfer karti
  - Tahmin secenekleri
  - Sonuc paneli
- Sag panel:
  - Skor
  - Son tahminlerim
  - Egitim notlari
  - Transfer tipi sozlugu

Mobil duzeni:

- Tek kolon.
- Sag panel icerikleri ana akisin altina iner.

Tasarim mevcut Kripto Keyfi koyu tema, kart tabanli yapi ve Web3 arayuz diliyle uyumludur.
