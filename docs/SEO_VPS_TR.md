# SEO HTML sunumu

Haber HTML'i `frontend/server.mjs` üzerinden sunulur. `deploy.sh` artık
`kriptokeyfi-seo` PM2 sürecini başlatır ve yeniden başlatmalarda korur.
Servis yalnız `127.0.0.1:4173` üzerinde dinler; dışarıya Nginx açılır.
Backend ve Go motorunun portları değişmez.

## VPS'de ilk geçiş

Mevcut Nginx dosyasını bulmak için `sudo nginx -T` çıktısındaki ilgili domainin
server bloğunu inceleyin. Sertifika ve HTTPS ayarlarını koruyun. Domaini sunan
blokta mevcut `location /` içindeki SPA `try_files` kuralını şu blokla değiştirin:

```nginx
location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
}
```

`/api/`, `/socket.io/`, sertifika ve statik dosya konumlarını koruyun.
Örnek dosya: `deploy/nginx/kriptokeyfi.conf.example`. Dosyanın tamamını mevcut
HTTPS yapılandırmasının üzerine kopyalamayın. SEO_PORT değişirse proxy portunu
da aynı yapın. Nginx dosyasını hazırladıktan sonra `sudo nginx -t` ile kontrol edin.

`backend/.env` içindeki `FRONTEND_URL`, sitenin gerçek HTTPS origin'i olmalıdır.
Canonical adresi için gerekirse `PUBLIC_SITE_URL` tanımlanabilir. Deploy SEO
servisine `SEO_API_BASE_URL=http://127.0.0.1:<backend-port>/api` aktarır.

Güncellenmiş kodla `./deploy.sh` çalıştırın. İlk geçişte Nginx reload ile SEO
servisinin başlangıcı arasında kısa erişim kesintisi olabilir. Varsayılan deploy
Nginx'i reload eder; RELOAD_NGINX=false kullanıyorsanız yönlendirmeyi ayrıca
devreye almalısınız.

## Doğrulama

Deploy hem yerel SEO portunu hem sitenin dış adresini kontrol eder:
haber başlığı, canonical, CollectionPage, robots, sitemap ve varsa sitemap'teki
ilk haberin NewsArticle bilgisi kontrol edilir. HTTP 200 dönen boş SPA şablonu
başarılı kabul edilmez. Sitemap boşsa haber detayının kontrol edilemediği yazılır.

```bash
pm2 status
curl -I http://127.0.0.1:4173/haberler
node frontend/seo/verify.mjs https://ALAN_ADINIZ https://ALAN_ADINIZ
```

Nginx statik şablonu sunmaya devam ederse deploy doğrulamada durur; bakım için
duraklattığı botları otomatik devam ettirmez. Yönlendirmeyi düzelttikten sonra
deploy'u yeniden çalıştırın; `.deploy-maintenance-bots.json` dosyasını silmeyin.
Bu kontrol Search Console indekslenme veya sıralama garantisi vermez.
