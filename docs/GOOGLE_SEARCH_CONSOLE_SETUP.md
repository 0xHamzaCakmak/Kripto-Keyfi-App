# Google Search Console yayın sonrası adımları

1. Üretim alan adını `PUBLIC_SITE_URL=https://alanadiniz.com` olarak ayarla.
2. SEO sunucusunu `npm run build && npm run start` ile çalıştır ve `/haberler/...` ilk HTML cevabını doğrula.
   - Aynı sunucu `/api/*` isteklerini `SEO_API_BASE_URL` adresindeki backend'e güvenli biçimde yönlendirir. Yerelde varsayılan değer `http://127.0.0.1:4000/api` olur.
   - Login kontrolü için önce `http://localhost:4173/api/health` adresinin `database: connected` döndürdüğünü doğrula.
3. `https://alanadiniz.com/robots.txt`, `/sitemap.xml`, `/sitemaps/news-1.xml` ve `/sitemaps/taxonomy.xml` adreslerinin `200` döndüğünü kontrol et.
4. Google Search Console'da alan adı mülkünü DNS kaydıyla doğrula.
5. **Dizin oluşturma > Site haritaları** bölümünden `https://alanadiniz.com/sitemap.xml` adresini gönder.
6. Bir haber, kategori ve etiket URL'sini **URL Denetleme** ile canlı test et; dönen HTML'de canonical ve yapılandırılmış verinin algılandığını kontrol et.
7. Yayından sonraki ilk hafta dizine ekleme, tarama ve zengin sonuç raporlarını günlük; sonrasında haftalık izle.
