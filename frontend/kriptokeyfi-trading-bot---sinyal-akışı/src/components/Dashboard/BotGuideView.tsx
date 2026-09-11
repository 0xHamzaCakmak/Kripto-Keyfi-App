import { useState } from 'react';
import { BookOpen } from 'lucide-react';

// Source: trading-engine/internal/bot/strategy.go; strategy-registry.schema.ts;
// bootstrap-strategy-arsenal.ts; risk.schema.ts; Pro account/control components.
const sections = [
  { id: 'baslangic', title: '1. Hesap ve günlük kullanım', items: [
    ['Hesabı seç', 'Üst başlıkta seçilen aktif TESTNET/DEMO hesabı; Botlarım, Arena, Pozisyonlar, Emirler ve Risk için ortak hesaptır. Hesap değişince önceki hesabın verilerini yeni hesabın sonucu olarak değerlendirmeyin.'],
    ['Botları kontrol et', 'Botlarım seçili hesabın arşivlenmemiş DEMO botlarını gösterir. Motor durumu, hedef durum ve yaşam döngüsü ayrı alanlardır. PAPER botunun burada görünmemesi silindiği anlamına gelmez.'],
    ['Risk ayarlarını oku', 'Teminat, kaldıraç, SL/TP, emir ve parite limitleri Risk bölümünden yönetilir. Kayıt tamamlanmadan yeni değerin uygulanmış olduğunu varsaymayın.'],
    ['Sonucu borsadan doğrula', 'Pozisyonlar bot dışında açılan borsa pozisyonlarını da listeler. Emirler açık borsa emirlerini gösterir. İstek kabulü, emrin gerçekleştiği veya pozisyonun kapandığı anlamına gelmez.'],
  ] },
  { id: 'modlar', title: '2. Çalışma modları', items: [
    ['SHADOW · gözlem', 'Karar ve işlem niyeti gözlemlenir; borsaya emir gönderilmez. SHADOW kayıtları gerçek hesap getirisi olarak okunmamalıdır.'],
    ['PAPER · uygulama içi simülasyon', 'Sanal fill, pozisyon, ücret ve PnL defteri kullanılır; borsaya emir gönderilmez. Ücret ve kayma varsayımları ilgili motorun yapılandırmasına aittir. PAPER sonucu TESTNET veya LIVE sonucu değildir.'],
    ['DEMO / TESTNET · demo borsa yürütmesi', 'Yetkili ve uygun botlar demo borsa API’sine emir gönderebilir. Hesap bağlantısı, bot durumu, otomatik işlem izni ve risk kontrolleri birlikte geçerlidir. Binance TESTNET operasyon/hesap özeti ile Bybit DEMO desteğinin kapsamı aynı değildir.'],
    ['LIVE · sonraki aşama', 'Pro’nun ortak hesap seçimi şu anda LIVE işlemlerini açmaz. Gerçek hesapla çalışma ve şifreli yetkilendirme ayrı geçiş çalışmasıdır. LIVE_ELIGIBLE etiketi canlı işlem yetkisi verildiği anlamına gelmez.'],
  ] },
  { id: 'turler', title: '3. Bot türleri: Scalping, Grid ve Autonomous', items: [
    ['SCALPING · kısa çevrimli kural botu', 'Fiyat değişimini yapılandırılmış eşikle karşılaştırır. Referans hazırlanırken WARMING_UP, eşik aşılmadığında HOLD görülebilir. Çevrim süresi değerlendirme sıklığıdır; her çevrimde emir oluşması beklenmez.'],
    ['GRID · seviye geçişleri', 'Alt ve üst fiyat arasındaki seviyelere göre karar üretir. Örneğin sınırlar dahil 10 seviye, 9 aralık demektir. Alt seviyeye geçiş GRID_BUY, üst seviyeye geçiş GRID_SELL üretebilir; aralık dışı OUT_OF_RANGE olur. Grid planı borsaya yerleştirilmiş emir listesi değildir.'],
    ['Klasik Grid kapsamı', 'Eski grid sihirbazındaki FUTURES / NEUTRAL / ARITHMETIC SHADOW-PAPER planı ile Pro’daki henüz bağlanmamış Grid Bot ekranını ayırın. Pro Grid kartlarını çalışan demo emir sistemi olarak kullanmayın.'],
    ['AUTONOMOUS · AI strateji botu', 'Hesap, pariteler, strateji sürümü, parametreler ve yaşam döngüsüyle tanımlanır. Strateji değerlendirmesi bir karar üretir; yürütme ayrıca hesap ve risk kontrollerinden geçer. Aynı aileye ait iki bot farklı parametrelerle farklı davranabilir.'],
  ] },
  { id: 'aileler', title: '4. AI botları ve strateji aileleri', items: [
    ['AI Momentum Baseline', 'Projede kullanılan başlangıç stratejisidir. Momentum yaklaşımı hareketin devamını değerlendirir. Giriş eşikleri ve koruma değerleri botun bağlı olduğu sürüm ve hesap ayarlarından gelir; evrensel bir güven yüzdesi yoktur.'],
    ['AI RSI Bollinger Range', 'RSI_MEAN_REVERSION ailesindeki aralık/dönüş yaklaşımıdır. Yatay piyasa ve ortalamaya dönüş fikrini değerlendirir. Güçlü trendde dönüş beklentisi ters yönde kalabilir.'],
    ['Playbook Confluence', 'MULTI_AGENT ailesinde, rejime göre trend/momentum veya aralık/dönüş yaklaşımını birleştiren stratejidir. Bootstrap ataması PAPER kapsamındadır; bu adın bulunması demo veya canlı yürütmenin açıldığı anlamına gelmez.'],
    ['Trend grubu', 'TREND, SMA_CROSSOVER, EMA_TREND ve MACD_TREND strateji kayıtlarında kullanılabilen ailelerdir. Adları trend, hareketli ortalama veya kesişim yaklaşımını belirtir; çalıştırılan sürüm ve motor uygulaması ayrıca belirleyicidir.'],
    ['Momentum ve kırılım grubu', 'MOMENTUM, DONCHIAN_BREAKOUT, ATR_BREAKOUT ve VOLUME_SPIKE; hareket, kanal, oynaklık veya hacim bağlamını temsil eder. Aile etiketi tek başına her göstergenin bağımsız ve tam bir yürütücüsü olduğu anlamına gelmez.'],
    ['Ortalamaya dönüş grubu', 'RSI_MEAN_REVERSION ve BOLLINGER_MEAN_REVERSION dönüş stratejilerini sınıflandırır. Botun parametrelerini ve güncel rejimi birlikte okuyun.'],
    ['Diğer kayıt aileleri', 'GRID, FUNDING_SKEW, BASIS_ARBITRAGE, NEWS_REACTIVE, DCA, AI_LIMIT ve CUSTOM da strateji şemasında tanımlıdır. Şemada tanımlı olmak, ilgili botun hesabınızda mevcut veya borsa yürütmesine hazır olduğunu kanıtlamaz.'],
    ['Bot adı, strateji ve performans', 'Bot adından çalışan algoritmayı veya kârlılığı çıkarmayın. Gerçek strateji ailesi/sürümü ve işlem kayıtları esas alınır. Eski örnek “AI Momentum Scalper Pro” gibi kart adları gerçek bot envanteri değildir.'],
  ] },
  { id: 'kontroller', title: '5. Başlat, durdur ve acil durdurma', items: [
    ['Üstteki Otomatik İşlemleri Aç/Durdur', 'Seçili hesabın entryPaused kontrolünü değiştirir. Mevcut backend kapsamı bu hesaptaki arşivlenmemiş PAPER ve DEMO AUTONOMOUS botlarıdır. Risk ve Arena aynı ayarı kullanır.'],
    ['Durdurmanın etkisi', 'Yeni otomatik emir girişini ve otomatik pozisyon yönetimini duraklatır. Açık pozisyonları kapatmaz; borsadaki mevcut emirlerin iptal edildiği anlamına gelmez. Pozisyonlar ve Emirler üzerinden gerçek durumu izleyin.'],
    ['Bot kartındaki başlat/duraklat', 'Yalnızca o botun ID’sine bir durum değişikliği isteği gönderir. Hedef durumun değişmesi, motorun o anda RUNNING olduğu anlamına gelmez. Hesap durdurması ve risk engelleri ayrıca geçerlidir.'],
    ['Acil durdurma', 'Risk’teki hesap acil durdurması seçili hesap içindir; GLOBAL acil durdurma tüm hesapları etkiler. Bu kontroller otomatik işlem izninden ayrıdır. Gerekçe ve onayla kullanılır; sonuç sunucudan doğrulanır.'],
    ['Sinyal, karar ve emir farklıdır', 'Bir LONG/SHORT/BUY/SELL kararı tek başına borsa emri değildir. Önceki rastgele Sinyal Tetikle düğmesi kaldırıldı. Başlat düğmesi anında piyasa emri vermek için kullanılmaz.'],
  ] },
  { id: 'parametreler', title: '6. Parametre sözlüğü', items: [
    ['Parite ve çevrim', 'BTCUSDT bir işlem çiftidir. Çevrim süresi botun değerlendirme aralığıdır; daha kısa süre daha çok kaynak tüketebilir. Klasik botun çevrim ayarını Autonomous botun mum zaman dilimiyle karıştırmayın.'],
    ['Miktar, teminat ve büyüklük', 'Miktar varlık adedidir; örneğin 0.001 BTC. İşlem büyüklüğü yaklaşık miktar × fiyat, başlangıç teminatı yaklaşık büyüklük / kaldıraçtır. Bot kotası ve asgari teminat Risk’teki hesap ayarlarıdır.'],
    ['Kaldıraç', 'Sabit büyüklükteki pozisyonun fiyat farkından doğan mutlak PnL’sini tek başına çarpmaz; gereken teminatı ve teminata göre getiri oranını değiştirir. Pro risk API’sindeki mevcut asgari/azami kaldıraç alanları 5–20 aralığını kabul eder.'],
    ['SL / TP ve bps', '100 bps = %1. Pro SL/TP değerleri Risk’ten okunur; sabit %1.5 SL veya %3.5 TP kuralı yoktur. Arayüzdeki net kâr hedefi ile borsadaki tetikleme fiyatını aynı sayı olarak yorumlamayın.'],
    ['Limitler ve sıfır', 'Yalnızca yanında “0 = sınırsız” yazan alanlarda sıfır bu anlamdadır. Bot teminatı gibi pozitif alanlarda sıfır geçerli değildir. Hesap limiti, parite limiti ve emir limiti farklı kontrollerdir.'],
    ['Kayıp oranları ve parite izinleri', 'Risk oranlarında 0.01 = %1. İzinli/engelli pariteler BTCUSDT biçiminde yazılır; aynı parite iki listede bulunamaz. Korunacak bakiye yeni işlem kapasitesini etkiler.'],
    ['Koruma ve kapanış', 'SL/TP emrini iptal etmek pozisyonu kapatmaz; yönetim aktifken koruma emri tekrar oluşturulabilir. Market, limit veya kısmi kapatma Pozisyonlar’dan yapılır. Limit kapatma emri gerçekleşene kadar pozisyon açık kalabilir.'],
  ] },
  { id: 'kararlar', title: '7. Kararlar, durumlar ve performans', items: [
    ['WARMING_UP / HOLD', 'WARMING_UP referans/veri hazırlığıdır. HOLD o çevrimde yeni işlem kararı verilmediğini belirtir; HODL yatırım yaklaşımıyla aynı şey değildir. Açık pozisyonun varlığı ayrı okunmalıdır.'],
    ['BUY / SELL / GRID_BUY / GRID_SELL', 'Yön ve seviye geçişi kararlarıdır. PAPER’da sanal fill, uygun DEMO yürütmesinde borsa isteği oluşabilir. Yön etiketi tek başına gerçekleşen işlem kanıtı değildir.'],
    ['RULE_ENGINE ve AI_MODEL', 'Klasik Scalping/Grid gözlem akışında RULE_ENGINE uygulanan kural kararıdır; AI_MODEL / OBSERVED bağımsız gözlemdir. Bu açıklamayı bütün Autonomous karar yollarına genellemeyin. İki kaynağın yön uyumu kârlılık kanıtı değildir.'],
    ['Motor, hedef ve yaşam döngüsü', 'RUNNING motor durumudur; desiredState hedef durumdur. DRAFT, CANDIDATE, TESTING, PAPER, CHALLENGER, CHAMPION, REJECTED, PAUSED ve ARCHIVED gibi yaşam döngüsü değerleri ayrı değerlendirme aşamalarını gösterir; hepsi zorunlu doğrusal bir sıra değildir.'],
    ['Arena ve Champions', 'Arena gerçek seçili hesap botlarını ve mevcut skor/operasyon verisini kullanır. Eksik metrik “—” olabilir. Champion seçimi yalnızca en yüksek kazanç sıralaması değildir; skor ve işlem kanıtı gerekir. Pro Champions ekranının mevcut örnek verileri gerçek sıralama olarak kullanılmamalıdır.'],
    ['PnL ve başarı oranı', 'Gerçekleşen PnL kapanan işlemlerden, açık PnL mevcut pozisyondan gelir. Komisyon, funding, kayma ve dönem kapsamını kontrol edin. İşlem sayısı, fill sayısı ve kazanma oranı birbirinin yerine geçmez.'],
  ] },
  { id: 'sorunlar', title: '8. Kontrol sırası ve mevcut sınırlar', items: [
    ['Bot görünmüyor', 'Doğru hesabı seçtiğinizi, botun DEMO modunda ve arşivlenmemiş olduğunu kontrol edin. Botlarım bütün hesapların veya PAPER botlarının ortak listesi değildir.'],
    ['Bot çalışıyor ama emir yok', 'Hedef/motor durumunu, hesabın otomatik işlem iznini, acil durdurmaları ve son risk olaylarını kontrol edin. HOLD kararı, yetersiz veri veya risk reddi emir oluşmamasını açıklayabilir.'],
    ['Pozisyon veya emir boş', 'Önce hata/yükleme mesajını ve seçili hesabı kontrol edin. Başarısız okuma “işlem yok” anlamına gelmez. Pozisyonlar ve Emirler düzenli yenilenir; gerektiğinde Yenile düğmesini kullanın.'],
    ['Henüz taşınmayan bölümler', 'Yeni bot oluşturma ve strateji düzenleme geçişi devam ediyor. Pro Manuel İşlem, Grid, Memory, Performans, Kâr/Zarar ve Champions gibi henüz bağlanmamış alanların örnek değerlerini gerçek işlem verisi sanmayın. Bölüm durumu proje checklist’inde takip edilir.'],
    ['Rehberin kapsamı', 'Bu rehber uygulamanın kodda tanımlı işleyişini açıklar. Bir stratejinin burada anlatılması hesabınızda kurulu olduğunu, kâr edeceğini veya LIVE’a hazır olduğunu göstermez.'],
  ] },
];

export function BotGuideView() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('tr-TR');
  const visible = sections.map((section) => ({ ...section, items: section.items.filter(([title, text]) => `${section.title} ${title} ${text}`.toLocaleLowerCase('tr-TR').includes(normalized)) })).filter((section) => section.items.length);
  return <div id="bot-guide-view" className="space-y-5 text-[#eaecef]">
    <header className="space-y-3 rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5 sm:p-6">
      <h1 className="flex items-center gap-3 text-xl font-bold"><BookOpen className="shrink-0 text-[#00d2ff]"/> AI Trading Pro · Bot Rehberi</h1>
      <p className="text-sm leading-6 text-[#848e9c]">Klasik botlar ve AI botları için ortak kullanım rehberi: hesap seçimi, çalışma modları, stratejiler, risk ve işlem takibi.</p>
      <label className="block text-xs text-[#848e9c]">Rehberde ara<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Örn. Grid, SL/TP, durdur, PAPER" className="mt-2 w-full rounded-xl border border-[#2b3139] bg-[#0b0e11] p-3 text-sm text-[#eaecef]"/></label>
      <nav aria-label="Rehber içindekiler" className="flex flex-wrap gap-2">{visible.map((section) => <a key={section.id} href={`#rehber-${section.id}`} className="rounded-lg border border-[#2b3139] px-3 py-2 text-xs text-[#00d2ff] hover:bg-[#0b0e11]">{section.title}</a>)}</nav>
    </header>
    {!visible.length && <p role="status" className="p-5 text-sm text-[#848e9c]">Aramaya uygun açıklama bulunamadı.</p>}
    {visible.map((section) => <section key={section.id} id={`rehber-${section.id}`} className="scroll-mt-6 space-y-4"><h2 className="text-lg font-bold text-[#f0b90b]">{section.title}</h2><div className="grid gap-4 lg:grid-cols-2">{section.items.map(([title, text]) => <article key={title} className="rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5"><h3 className="font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-[#848e9c]">{text}</p></article>)}</div></section>)}
  </div>;
}
