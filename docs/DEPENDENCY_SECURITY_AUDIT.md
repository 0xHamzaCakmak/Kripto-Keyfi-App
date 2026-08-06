# Bağımlılık güvenlik denetimi

Tarih: 7 Ağustos 2026

## Uygulanan işlemler

- Kullanılmayan `@google/genai` kaldırıldı; taşıdığı kritik `protobufjs` zinciri production paketlerinden çıkarıldı.
- Frontend Express `4.22.2`, React Router DOM `7.18.2`, Vite `6.4.3` ve Tailwind Vite eklentisi `4.3.3` sürümüne güncellendi.
- Babel ve PostCSS güvenlik yamaları `npm audit fix` ile uygulandı.
- Backend `npm audit --omit=dev`: 0 açık.
- Repository secret taraması: başarılı. Yerel `.env` bilinçli olarak tarama dışında, `.env.example` ve kaynak dosyaları tarama kapsamındadır.

## Kalan npm uyarısı

Frontend production audit'i React Router'ın RSC Mode action isteklerine ait `GHSA-qwww-vcr4-c8h2` uyarısını göstermektedir. KriptoKeyfi RSC, React Router data action veya framework action endpoint'i kullanmaz; yalnızca istemci tarafı `BrowserRouter` ve ayrı Express API kullanır. Bu nedenle bildirilen saldırı yolu mevcut mimaride çalışmaz.

Audit'in önerdiği `7.11.0` sürümüne zorla düşürme, daha yeni güvenlik düzeltmelerini geri alacağı için uygulanmadı. React Router düzeltme sürümü yayımlandığında normal dependency güncellemesiyle alınmalıdır. Production sunucusunda Vite/tsx geliştirme sunucusu çalıştırılmaz.
