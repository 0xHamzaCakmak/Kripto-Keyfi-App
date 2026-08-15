# Admin modül navigasyon şablonu

KriptoKeyfi admin panelinde sidebar yalnızca üst seviye çalışma alanlarını gösterir. Bir modülün alt ekranları sidebar'a eklenmez; modül route'u altında iç içe route ve yatay tab navigasyonu olarak tanımlanır.

## Mevcut modüller

- Trading Bot: `/admin/trading/*`
- KOL Intelligence: `/admin/kol/*`

Her iki modül `frontend/src/components/AdminModuleLayout.tsx` içindeki ortak `AdminModuleLayout` bileşenini kullanır. Modüle özel tab listesi aynı dosyada tanımlanır; sayfa içerikleri React Router `Outlet` üzerinden değişir.

## Yeni modül ekleme

1. `AdminModuleTab[]` tipinde modülün tab listesini oluşturun.
2. Ortak `AdminModuleLayout` bileşenini bu listeyle saran küçük bir modül layout'u dışa aktarın.
3. `frontend/src/App.tsx` içinde modülün ana route'unu layout ile tanımlayın ve alt sayfaları child route olarak ekleyin.
4. `frontend/src/components/AdminLayout.tsx` içindeki `primaryLinks` listesine yalnızca modülün tek üst seviye bağlantısını ekleyin.
5. Eski bir URL değişiyorsa `Navigate replace` ile kalıcı uyumluluk yönlendirmesi bırakın.

Örnek route biçimi:

```tsx
<Route path="module" element={<ExampleModuleLayout />}>
  <Route index element={<ModuleOverview />} />
  <Route path="records" element={<ModuleRecords />} />
</Route>
```

Sidebar bağlantısında `end` kullanılmadığında modülün bütün alt route'larında üst seviye satır aktif görünür. Genel admin bağlantısında ise yalnızca `/admin` adresinde aktif kalması için `end: true` kullanılır.
