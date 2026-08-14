import { ArrowRight, Check, CircleDashed, DatabaseZap, ExternalLink, Radar, Search, ShieldCheck, Sparkles } from 'lucide-react';

const sources = [
  {
    name: 'OKX OnchainOS',
    mode: 'API entegrasyonu',
    tone: 'text-primary bg-primary/10 border-primary/20',
    description: 'Zincir ve token adresine göre KOL adaylarını; etkileşim, bahsedilme veya gösterime göre keşfeder.',
    fields: 'Takipçi · etkileşim · bahsedilme · gösterim · ilk paylaşım',
    href: 'https://web3.okx.com/tr/onchainos/dev-docs/market/market-social-vibe-top-kols',
  },
  {
    name: 'Sorsa API',
    mode: 'API entegrasyonu',
    tone: 'text-tertiary bg-tertiary/10 border-tertiary/20',
    description: 'Aday hesapların herkese açık X profilini, tweetlerini, takipçi sinyallerini ve etkileşimini zenginleştirir.',
    fields: 'Profil · tweet · arama · takipçi analizi · üçüncü taraf skor',
    href: 'https://docs.sorsa.io/api-reference-guide',
  },
  {
    name: 'Growing3',
    mode: 'Editör destekli',
    tone: 'text-amber-300 bg-amber-300/10 border-amber-300/20',
    description: 'X profilinde kitle, etkileşim ve anahtar kelime kontrolü için editör araştırma katmanıdır.',
    fields: 'Profil özeti · kitle · etkileşim oranı · anahtar kelimeler',
    href: 'https://growing3.ai/product/influencer_insight_browser_extension',
  },
  {
    name: 'BitMart X Insight',
    mode: 'Araştırma / benchmark',
    tone: 'text-violet-300 bg-violet-300/10 border-violet-300/20',
    description: 'KOL görüşleri ve sosyal duygu çıktılarının ürün araştırmasında karşılaştırılmasını sağlar.',
    fields: 'KOL görüşü · sosyal duygu · piyasa reaksiyonu',
    href: 'https://www.bitmart.com/en-US/ai/xinsight/landing',
  },
];

const pipeline = [
  ['01', 'Keşfet', 'Token, konu ve ülke bazlı aday havuzu'],
  ['02', 'Kimliği eşleştir', 'Aynı kişiye ait hesapları tek KOL kaydında birleştir'],
  ['03', 'Topla', 'Ham yanıtı zaman ve kaynak bağlantısıyla kaydet'],
  ['04', 'Normalize et', 'Metrikleri ortak alanlara dönüştür'],
  ['05', 'Doğrula', 'Aykırı değer, bot sinyali ve editör kontrolü'],
  ['06', 'Skorla', 'Yalnız doğrulanmış sinyalleri ağırlıklı skora al'],
];

const checklist = [
  [true, 'Sağlayıcı türleri ve veri sorumlulukları tanımlandı'],
  [true, 'Sorsa ve OKX için sunucu tarafı adapter iskeleti kuruldu'],
  [true, 'API anahtarları için güvenli ortam değişkenleri eklendi'],
  [true, 'Admin sağlayıcı durum endpoint’i eklendi'],
  [true, 'Veri kaynakları sayfası ve KOL menü bağlantısı eklendi'],
  [false, 'Sorsa üretim API anahtarı alınacak ve bağlantı testi yapılacak'],
  [false, 'OKX proje anahtarları alınacak ve ilk token keşif testi yapılacak'],
  [false, 'Periyodik toplama kuyruğu, yeniden deneme ve hata alarmı kurulacak'],
  [false, 'Ham snapshot ve senkronizasyon geçmişi için veri tabanı tabloları eklenecek'],
  [false, 'Growing3 dışa aktarım / ticari kullanım izni netleştirilecek'],
  [false, 'BitMart için lisanslı API veya partner erişimi olup olmadığı teyit edilecek'],
];

export default function KOLDataSources() {
  return <div className="mx-auto max-w-7xl space-y-8 pb-12">
    <section className="relative overflow-hidden rounded-[32px] border border-outline/10 bg-surface px-6 py-10 sm:px-10 lg:px-14">
      <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative max-w-3xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.22em] text-primary"><DatabaseZap size={14}/> KOL Data Intelligence</div>
        <h1 className="font-headline text-4xl font-black tracking-tight text-white sm:text-5xl">KOL verisini bul, doğrula ve kanıta dönüştür.</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-base">KriptoKeyfi tek bir dış servis skoruna güvenmez. API sinyallerini, editör kontrolünü ve kampanya sonuçlarını kaynak bilgisiyle birleştirir; eksik veri olduğunda tahmin üretmez.</p>
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-primary">Kaynak haritası</p><h2 className="mt-1 font-headline text-2xl font-black text-white">Dört araç, üç farklı kullanım biçimi</h2></div></div>
      <div className="grid gap-4 md:grid-cols-2">{sources.map((source) => <article key={source.name} className="rounded-3xl border border-outline/10 bg-surface p-6">
        <div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-high text-primary"><Radar size={20}/></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${source.tone}`}>{source.mode}</span></div>
        <h3 className="mt-5 font-headline text-xl font-black text-white">{source.name}</h3>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{source.description}</p>
        <p className="mt-4 rounded-xl bg-background/45 p-3 text-xs font-bold leading-5 text-on-surface">{source.fields}</p>
        <a href={source.href} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-black text-primary hover:text-white">Resmî kaynağı incele <ExternalLink size={13}/></a>
      </article>)}</div>
    </section>

    <section className="rounded-[28px] border border-outline/10 bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles size={18}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Veri hattı</p><h2 className="font-headline text-xl font-black text-white">Kaynaktan skora kontrollü akış</h2></div></div>
      <div className="mt-7 grid gap-3 md:grid-cols-3">{pipeline.map(([number, title, detail]) => <div key={number} className="relative rounded-2xl border border-outline/10 bg-background/35 p-4"><span className="text-[10px] font-black text-primary">{number}</span><h3 className="mt-2 text-sm font-black text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-on-surface-variant">{detail}</p></div>)}</div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-xs leading-5 text-on-surface-variant"><ShieldCheck className="mt-0.5 shrink-0 text-tertiary" size={17}/><p><strong className="text-white">Temel kural:</strong> Sorsa gibi üçüncü taraf skorları doğrudan KriptoKeyfi Güven Skoru yapılmaz. Kaynak tarihi, örneklem ve güven seviyesi olan ölçümler ayrı sinyaller olarak işlenir.</p></div>
    </section>

    <section className="grid gap-6 lg:grid-cols-[1fr_.42fr]">
      <div className="rounded-[28px] border border-outline/10 bg-surface p-6 sm:p-8"><div className="flex items-center gap-3"><Search className="text-primary" size={20}/><h2 className="font-headline text-xl font-black text-white">Uygulama görev listesi</h2></div><div className="mt-6 space-y-2">{checklist.map(([done, label]) => <div key={String(label)} className="flex items-start gap-3 rounded-xl bg-background/35 px-4 py-3">{done ? <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-background"><Check size={13} strokeWidth={3}/></span> : <CircleDashed className="mt-0.5 shrink-0 text-outline" size={20}/>}<span className={`text-xs leading-5 ${done ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>{label}</span></div>)}</div></div>
      <aside className="rounded-[28px] border border-primary/20 bg-primary/8 p-6"><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Sıradaki eşik</p><h2 className="mt-3 font-headline text-xl font-black text-white">Canlı veri için anahtarlar</h2><p className="mt-3 text-sm leading-6 text-on-surface-variant">Adapter’lar hazır. Üretim çağrılarını başlatmak için Sorsa ve OKX erişim bilgileri yalnız backend ortamına tanımlanmalı; tarayıcıya gönderilmemeli.</p><a href="/kol-intelligence/methodology" className="mt-6 inline-flex items-center gap-2 text-xs font-black text-primary">Skor metodolojisine geç <ArrowRight size={14}/></a></aside>
    </section>
  </div>;
}
