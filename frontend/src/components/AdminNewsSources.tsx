import { useEffect, useState } from "react";
import { Activity, BarChart3, CheckCircle2, ExternalLink, Pencil, Plus, Radio, RefreshCw, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import {
  createNewsSource,
  getAdminNewsArticles,
  getNewsAnalyticsReport,
  getNewsOperations,
  getNewsSources,
  relocalizeNewsArticle,
  type AdminNewsArticle,
  type NewsSource,
  updateNewsArticle,
  updateNewsArticleContent,
  updateNewsSource,
} from "../services/newsAdminService";
import { getApiErrorMessage } from "../services/apiClient";

const createBlank = () => ({
  name: "",
  slug: "",
  websiteUrl: "",
  feedUrl: "",
  integrationType: "RSS" as "RSS" | "API",
  language: "tr",
  category: "",
  logoUrl: "",
  isActive: false,
  isTrusted: false,
  autoPublish: false,
  aiEnabled: true,
  minimumManualReviews: 20,
  commercialUseAllowed: false,
  excerptAllowed: false,
  imageUseAllowed: false,
  attributionRequired: true,
  termsUrl: "",
  lastTermsCheckedAt: "",
  fetchIntervalMinutes: 30,
  priority: 100,
});
const checks = [
  { key: "isTrusted", label: "Kaynak güvenilir olarak doğrulandı" },
  { key: "commercialUseAllowed", label: "Ticari kullanım izni var" },
  { key: "excerptAllowed", label: "Başlık ve kısa özet izni var" },
  { key: "imageUseAllowed", label: "Görsel kullanım izni var" },
  { key: "autoPublish", label: "Yeni haberleri otomatik yayınla" },
  { key: "aiEnabled", label: "Bu kaynakta AI özetleme açık" },
] as const;

const aiFilters = [
  ["WAITING", "Bekliyor"], ["PROCESSING", "İşleniyor"], ["READY", "Hazır"], ["REVIEW_REQUIRED", "İnceleme Gerekli"], ["FAILED", "Hatalı"],
] as const;

export default function AdminNewsSources() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [pendingArticles, setPendingArticles] = useState<AdminNewsArticle[]>([]);
  const [aiFilter, setAiFilter] = useState<AdminNewsArticle['aiStatus']>('REVIEW_REQUIRED');
  const [operations, setOperations] = useState<Awaited<ReturnType<typeof getNewsOperations>> | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof getNewsAnalyticsReport>> | null>(null);
  const [editingArticle, setEditingArticle] = useState<AdminNewsArticle | null>(null);
  const [articleForm, setArticleForm] = useState({ titleTr: '', summaryTr: '', whyItMatters: '', marketImpact: '', watchOuts: '', tags: '' });
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [articleAction, setArticleAction] = useState<{ id: string; type: 'publish' | 'reject' } | null>(null);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(createBlank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4_000);
  }
  const load = async () => {
    try {
      const [sourceItems, articleItems, operationData, analyticsData] = await Promise.all([getNewsSources(), getAdminNewsArticles(aiFilter), getNewsOperations(), getNewsAnalyticsReport(30)]);
      setSources(sourceItems);
      setPendingArticles(articleItems);
      setOperations(operationData);
      setAnalytics(analyticsData);
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Kaynaklar yüklenemedi."));
    }
  };
  useEffect(() => {
    void load();
  }, [aiFilter]);
  const eligible =
    form.isTrusted &&
    form.commercialUseAllowed &&
    form.excerptAllowed &&
    Boolean(form.lastTermsCheckedAt);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = {
        ...form,
        feedUrl: form.feedUrl || null,
        category: form.category || null,
        logoUrl: form.logoUrl || null,
        termsUrl: form.termsUrl || null,
        lastTermsCheckedAt: form.lastTermsCheckedAt || null,
      };
      if (editingId) await updateNewsSource(editingId, input);
      else await createNewsSource(input);
      setForm(createBlank());
      setEditingId(null);
      setOpen(false);
      await load();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Kaynak kaydedilemedi."));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(source: NewsSource) {
    try {
      await updateNewsSource(source.id, { isActive: !source.isActive });
      await load();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Kaynak durumu güncellenemedi."));
    }
  }
  async function reviewArticle(articleId: string, status: "PUBLISHED" | "REJECTED") {
    setArticleAction({ id: articleId, type: status === 'PUBLISHED' ? 'publish' : 'reject' });
    setError("");
    try {
      await updateNewsArticle(articleId, { status });
      setPendingArticles((articles) => articles.filter((article) => article.id !== articleId));
      showNotice(status === 'PUBLISHED' ? 'Haber editoryal olarak onaylandı ve Hazır durumuna alındı.' : 'Haber reddedildi ve işlem listesinden kaldırıldı.');
      await load();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Haber inceleme durumu güncellenemedi."));
    } finally {
      setArticleAction(null);
    }
  }
  function openArticleEditor(article: AdminNewsArticle) {
    setEditingArticle(article);
    setArticleForm({ titleTr: article.title, summaryTr: article.excerpt ?? '', whyItMatters: article.aiSummary?.whyItMatters ?? '', marketImpact: article.aiSummary?.marketImpact ?? '', watchOuts: article.aiSummary?.watchOuts ?? '', tags: article.tags.map((tag) => tag.name).join(', ') });
  }
  async function saveArticleContent(event: React.FormEvent) {
    event.preventDefault(); if (!editingArticle) return; setBusy(true); setError('');
    try { await updateNewsArticleContent(editingArticle.id, { titleTr: articleForm.titleTr, summaryTr: articleForm.summaryTr, whyItMatters: articleForm.whyItMatters || null, marketImpact: articleForm.marketImpact || null, watchOuts: articleForm.watchOuts || null, tags: articleForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }); setEditingArticle(null); showNotice('Manuel düzenleme kaydedildi; worker bu içeriğin üzerine yazmayacak.'); await load(); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Haber içeriği kaydedilemedi.')); } finally { setBusy(false); }
  }
  async function retryArticle(articleId: string) {
    if (retryingId) return; setRetryingId(articleId); setError('');
    try { const result = await relocalizeNewsArticle(articleId); showNotice(result.article.aiStatus === 'READY' ? 'Haber yeniden özetlendi ve kalite kontrolünden geçti.' : 'Haber yeniden özetlendi; manuel kontrol gerektiren uyarılar devam ediyor.'); await load(); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Haber yeniden özetlenemedi.')); } finally { setRetryingId(null); }
  }
  return (
    <div className="space-y-6">
      <section className="kk-gold-panel rounded-[32px] p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-primary">
              İçerik kontrolü
            </p>
            <h1 className="mt-2 font-headline text-4xl font-extrabold text-white">
            Haber Yönetimi
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
              Kaynak, izin kontrolü tamamlanmadan aktif edilemez. Aktif
              kaynaklar otomatik olarak çekilir; diğerleri pasif kalır.
            </p>
          </div>
          <button
            onClick={() => {
              setForm(createBlank());
              setEditingId(null);
              setOpen(!open);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background"
          >
            <Plus size={18} /> Kaynak ekle
          </button>
        </div>
      </section>
      {notice && <div role="status" className="fixed right-5 top-5 z-[140] max-w-md rounded-2xl border border-secondary/30 bg-[#10251d] p-4 text-sm font-bold text-secondary shadow-2xl">{notice}</div>}
      {error && (
        <div role="alert" className="fixed right-5 top-5 z-[150] max-w-md rounded-2xl border border-error/30 bg-[#2b1111] p-4 text-sm font-bold text-error shadow-2xl">
          {error}
        </div>
      )}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-outline/10 bg-surface p-5"><Activity className="text-secondary" size={20}/><p className="mt-3 text-xs font-black uppercase tracking-wider text-on-surface-variant">Worker</p><p className="mt-1 font-bold text-white">{operations?.health?.lastSuccessfulAt ? `Son başarı: ${new Date(operations.health.lastSuccessfulAt).toLocaleString('tr-TR')}` : 'Henüz sağlık kaydı yok'}</p></div>
        <div className="rounded-2xl border border-outline/10 bg-surface p-5"><RefreshCw className="text-primary" size={20}/><p className="mt-3 text-xs font-black uppercase tracking-wider text-on-surface-variant">AI kuyruğu</p><p className="mt-1 text-2xl font-black text-white">{operations?.statuses.WAITING ?? 0} <span className="text-sm text-on-surface-variant">bekliyor</span></p></div>
        <div className="rounded-2xl border border-outline/10 bg-surface p-5"><TriangleAlert className="text-error" size={20}/><p className="mt-3 text-xs font-black uppercase tracking-wider text-on-surface-variant">Hatalar / 429</p><p className="mt-1 text-2xl font-black text-white">{operations?.health?.errorCount ?? 0} / {operations?.health?.rateLimitCount ?? 0}</p></div>
        <div className="rounded-2xl border border-outline/10 bg-surface p-5"><BarChart3 className="text-primary" size={20}/><p className="mt-3 text-xs font-black uppercase tracking-wider text-on-surface-variant">30 gün kaynak CTR</p><p className="mt-1 text-2xl font-black text-white">%{analytics?.engagement.sourceCtr ?? 0}</p></div>
      </section>
      {operations?.quota.limited && <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">{operations.quota.message}</div>}
      {analytics && <section className="rounded-3xl border border-outline/10 bg-surface p-5 md:p-6"><div className="flex items-center gap-2"><BarChart3 className="text-primary"/><h2 className="font-headline text-2xl font-bold text-white">Haber Kalite Özeti</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Özet okuma", analytics.engagement.summaryViews], ["Ort. okuma", `${Math.round(analytics.engagement.averageReadMs / 1000)} sn`], ["İlgili haber CTR", `%${analytics.engagement.relatedCtr}`], ["Teknik index uygunluğu", `%${analytics.quality.technicalIndexEligibilityRate}`], ["AI hata", analytics.quality.aiErrors]].map(([label,value]) => <div key={label} className="rounded-2xl bg-surface-high p-4"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>)}</div><div className="mt-4 text-xs text-on-surface-variant">Core Web Vitals p75 — LCP: {analytics.webVitalsP75.LCP ?? 'veri yok'} ms · CLS: {analytics.webVitalsP75.CLS ?? 'veri yok'} · INP: {analytics.webVitalsP75.INP ?? 'veri yok'} ms</div></section>}
      <section className="rounded-3xl border border-outline/10 bg-surface p-5 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-primary">Editoryal kapı</p>
            <h2 className="mt-1 font-headline text-2xl font-bold text-white">AI İçerik İşlemleri</h2>
            <p className="mt-2 text-sm text-on-surface-variant">İşlem durumunu filtreleyin; kalite kontrolü, manuel düzenleme ve yeniden özetleme işlemlerini buradan yönetin.</p>
          </div>
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{pendingArticles.length} kayıt</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">{aiFilters.map(([value,label]) => <button key={value} onClick={() => setAiFilter(value)} className={aiFilter === value ? 'rounded-xl bg-primary px-3 py-2 text-xs font-black text-background' : 'rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-on-surface-variant'}>{label} <span className="ml-1 opacity-70">{operations?.statuses[value] ?? 0}</span></button>)}</div>
        <div className="mt-5 grid gap-3">
          {pendingArticles.length ? pendingArticles.map((article) => (
            <article key={article.id} className="grid gap-4 rounded-2xl bg-surface-high p-4 lg:grid-cols-[96px_1fr_auto] lg:items-center">
              <div className="h-20 overflow-hidden rounded-xl bg-background">
                {article.coverImageUrl ? <img src={article.coverImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-primary"><Radio size={24} /></div>}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <span className="text-primary">{article.source?.name ?? "Kaynak yok"}</span>
                  <span className={article.aiSummary?.needsReview ? "text-error" : "text-secondary"}>{article.aiSummary?.needsReview ? "Manuel kontrol gerekli" : "Kalite kontrolü geçti"}</span>
                </div>
                <h3 className="mt-1 line-clamp-2 font-headline text-lg font-bold text-white">{article.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{article.excerpt ?? "İzinli kaynak özeti bulunmuyor."}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-on-surface-variant"><span>AI: {article.aiSummary?.provider ?? '—'} / {article.aiSummary?.model ?? '—'}</span><span>{article.aiSummary?.wordCount ?? 0} kelime</span><span>{article.localizationAttempts} deneme</span>{article.manualEditedAt && <span className="text-secondary">Manuel düzenlendi</span>}</div>
                {article.aiSummary?.qualityFlags?.length ? <div className="mt-2 flex flex-wrap gap-1">{article.aiSummary.qualityFlags.map((flag) => <span key={flag} className="rounded bg-error/10 px-2 py-1 text-[9px] font-bold text-error">{flag}</span>)}</div> : null}
                {article.localizationError && <p className="mt-2 line-clamp-2 text-xs text-error">{article.localizationError}</p>}
              </div>
              <div className="flex flex-wrap gap-2 lg:flex-col">
                <button type="button" disabled={Boolean(articleAction) || Boolean(retryingId)} onClick={() => openArticleEditor(article)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-2 text-sm font-bold text-on-surface disabled:opacity-40"><Pencil size={16}/> Düzenle</button>
                <button type="button" disabled={Boolean(articleAction) || Boolean(retryingId) || article.aiStatus === 'PROCESSING'} onClick={() => void retryArticle(article.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40"><RefreshCw size={16} className={retryingId === article.id ? 'animate-spin' : ''}/> {retryingId === article.id ? 'Özetleniyor…' : 'Yeniden özetle'}</button>
                <button type="button" disabled={Boolean(articleAction) || Boolean(retryingId) || !article.isLocalized} onClick={() => void reviewArticle(article.id, "PUBLISHED")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-background disabled:opacity-40"><ShieldCheck size={16} /> {articleAction?.id === article.id && articleAction.type === 'publish' ? 'Yayınlanıyor…' : 'Yayınla'}</button>
                <button type="button" disabled={Boolean(articleAction) || Boolean(retryingId)} onClick={() => void reviewArticle(article.id, "REJECTED")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-error/15 px-4 py-2 text-sm font-bold text-error disabled:opacity-40"><XCircle size={16} /> {articleAction?.id === article.id && articleAction.type === 'reject' ? 'Reddediliyor…' : 'Reddet'}</button>
              </div>
            </article>
          )) : <div className="rounded-2xl bg-surface-high p-6 text-center text-sm text-on-surface-variant">Bu AI durumunda haber bulunmuyor.</div>}
        </div>
      </section>
      {editingArticle && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"><form onSubmit={(event) => void saveArticleContent(event)} className="max-h-[92vh] w-full max-w-6xl space-y-4 overflow-y-auto rounded-3xl border border-secondary/25 bg-surface p-6 shadow-2xl"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-secondary">Manuel editoryal düzenleme</p><h2 className="mt-1 font-headline text-2xl font-bold text-white">{editingArticle.originalTitle}</h2></div><button type="button" aria-label="Düzenleyiciyi kapat" onClick={() => setEditingArticle(null)} className="rounded-xl bg-surface-high p-2 text-on-surface"><XCircle/></button></div><label className="block text-sm font-bold text-on-surface-variant">Türkçe başlık<input value={articleForm.titleTr} onChange={(event) => setArticleForm({ ...articleForm, titleTr: event.target.value })} minLength={5} maxLength={500} required className="mt-2 w-full rounded-xl bg-surface-high px-4 py-3 text-white"/></label><label className="block text-sm font-bold text-on-surface-variant">Türkçe özet<textarea value={articleForm.summaryTr} onChange={(event) => setArticleForm({ ...articleForm, summaryTr: event.target.value })} minLength={20} maxLength={4000} required rows={6} className="mt-2 w-full rounded-xl bg-surface-high px-4 py-3 text-white"/></label><div className="grid gap-4 lg:grid-cols-3">{([['whyItMatters','Neden önemli?'],['marketImpact','Olası etkiler'],['watchOuts','Takip edilecekler']] as const).map(([key,label]) => <label key={key} className="text-sm font-bold text-on-surface-variant">{label}<textarea value={articleForm[key]} onChange={(event) => setArticleForm({ ...articleForm, [key]: event.target.value })} rows={5} className="mt-2 w-full rounded-xl bg-surface-high px-4 py-3 text-white"/></label>)}</div><label className="block text-sm font-bold text-on-surface-variant">Etiketler (virgülle ayırın)<input value={articleForm.tags} onChange={(event) => setArticleForm({ ...articleForm, tags: event.target.value })} className="mt-2 w-full rounded-xl bg-surface-high px-4 py-3 text-white"/></label><div className="flex flex-col gap-3 sm:flex-row"><button disabled={busy} className="rounded-xl bg-secondary px-5 py-3 text-sm font-black text-background disabled:opacity-40">{busy ? 'Kaydediliyor…' : 'Manuel düzenlemeyi kaydet'}</button><p className="self-center text-xs text-on-surface-variant">Kaydedilen manuel içerik otomatik worker tarafından değiştirilmez.</p></div></form></div>}
      {open && (
        <form
          onSubmit={(event) => void submit(event)}
          className="grid gap-4 rounded-3xl border border-primary/25 bg-surface p-6 md:grid-cols-2"
        >
          <h2 className="md:col-span-2 font-headline text-xl font-bold text-white">
            {editingId ? "Kaynağı düzenle" : "Yeni kaynak"}
          </h2>
          {(
            [
              ["name", "Kaynak adı"],
              ["slug", "Benzersiz kısa ad"],
              ["websiteUrl", "Web sitesi (https)"],
              ["feedUrl", "RSS adresi (https)"],
              ["termsUrl", "Kullanım şartları adresi (https)"],
              ["category", "Varsayılan kategori"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="text-sm font-bold text-on-surface-variant"
            >
              {label}
              <input
                required={key !== "termsUrl" && key !== "category"}
                value={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
                className="mt-2 w-full rounded-xl bg-surface-high px-3 py-3 text-white"
              />
            </label>
          ))}
          <label className="text-sm font-bold text-on-surface-variant">
            Şartlar kontrol tarihi
            <input
              type="date"
              value={form.lastTermsCheckedAt}
              onChange={(event) =>
                setForm({ ...form, lastTermsCheckedAt: event.target.value })
              }
              className="mt-2 w-full rounded-xl bg-surface-high px-3 py-3 text-white"
            />
          </label>
          <label className="text-sm font-bold text-on-surface-variant">
            Çekim aralığı (dk)
            <input
              type="number"
              min="5"
              value={form.fetchIntervalMinutes}
              onChange={(event) =>
                setForm({
                  ...form,
                  fetchIntervalMinutes: Number(event.target.value),
                })
              }
              className="mt-2 w-full rounded-xl bg-surface-high px-3 py-3 text-white"
            />
          </label>
          <label className="text-sm font-bold text-on-surface-variant">Minimum manuel yabancı haber incelemesi<input type="number" min="0" max="100" value={form.minimumManualReviews} onChange={(event) => setForm({ ...form, minimumManualReviews: Number(event.target.value) })} className="mt-2 w-full rounded-xl bg-surface-high px-3 py-3 text-white"/></label>
          <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
            {checks.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-xl bg-surface-high p-3 text-sm text-on-surface"
              >
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.checked })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm font-bold text-white">
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={!eligible}
              onChange={(event) =>
                setForm({ ...form, isActive: event.target.checked })
              }
            />
            Kaynağı etkinleştir{" "}
            {!eligible && "(önce zorunlu doğrulamaları tamamlayın)"}
          </label>
          <div className="md:col-span-2 flex gap-3">
            <button
              disabled={busy}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background"
            >
              {busy ? "Kaydediliyor…" : "Kaynağı kaydet"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-surface-high px-5 py-3 text-sm font-bold text-on-surface"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}
      <section className="space-y-4">
        {sources.length ? (
          sources.map((source) => {
            const ready =
              source.isTrusted &&
              source.commercialUseAllowed &&
              source.excerptAllowed &&
              Boolean(source.lastTermsCheckedAt);
            return (
              <article
                key={source.id}
                className="rounded-3xl border border-outline/10 bg-surface p-5 md:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-headline text-xl font-bold text-white">
                        {source.name}
                      </h2>
                      <span
                        className={
                          source.isActive
                            ? "rounded-full bg-secondary/15 px-2 py-1 text-xs font-bold text-secondary"
                            : "rounded-full bg-surface-high px-2 py-1 text-xs font-bold text-on-surface-variant"
                        }
                      >
                        {source.isActive ? "Aktif / çekiliyor" : "Pasif"}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-sm text-on-surface-variant">
                      {source.feedUrl ?? source.websiteUrl}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      {[
                        [source.isTrusted, "Güvenilir"],
                        [source.commercialUseAllowed, "Ticari izin"],
                        [source.excerptAllowed, "Özet izni"],
                        [source.imageUseAllowed, "Görsel izni"],
                        [source.aiEnabled, "AI açık"],
                        [
                          Boolean(source.lastTermsCheckedAt),
                          "Şartlar incelendi",
                        ],
                      ].map(([ok, label]) => (
                        <span
                          key={String(label)}
                          className={
                            ok
                              ? "inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-1 text-secondary"
                              : "rounded-full bg-error/10 px-2 py-1 text-error"
                          }
                        >
                          {Boolean(ok) && <CheckCircle2 size={12} />} {label}
                        </span>
                      ))}
                    </div>
                    {source.lastError && (
                      <p className="mt-3 text-xs text-error">
                        Son hata: {source.lastError}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={source.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-surface-high p-3 text-primary"
                    >
                      <ExternalLink size={18} />
                    </a>
                    <button
                      onClick={() => {
                        setEditingId(source.id);
                        setForm({
                          name: source.name,
                          slug: source.slug,
                          websiteUrl: source.websiteUrl,
                          feedUrl: source.feedUrl ?? "",
                          integrationType: source.integrationType,
                          language: source.language,
                          category: source.category ?? "",
                          logoUrl: source.logoUrl ?? "",
                          isActive: source.isActive,
                          isTrusted: source.isTrusted,
                          autoPublish: source.autoPublish,
                          aiEnabled: source.aiEnabled,
                          minimumManualReviews: source.minimumManualReviews,
                          commercialUseAllowed: source.commercialUseAllowed,
                          excerptAllowed: source.excerptAllowed,
                          imageUseAllowed: source.imageUseAllowed,
                          attributionRequired: source.attributionRequired,
                          termsUrl: source.termsUrl ?? "",
                          lastTermsCheckedAt:
                            source.lastTermsCheckedAt?.slice(0, 10) ?? "",
                          fetchIntervalMinutes: source.fetchIntervalMinutes,
                          priority: source.priority,
                        });
                        setOpen(true);
                      }}
                      className="rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface"
                    >
                      Düzenle
                    </button>
                    <button
                      disabled={!ready}
                      onClick={() => void toggle(source)}
                      className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {source.isActive
                        ? "Kaynağı durdur"
                        : "Kaynağı etkinleştir"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl bg-surface p-10 text-center">
            <Radio className="mx-auto text-primary" />
            <p className="mt-4 font-bold text-white">
              Henüz haber kaynağı eklenmedi
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              İzinleri doğrulanmış bir RSS veya API kaynağı ekleyerek başlayın.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
