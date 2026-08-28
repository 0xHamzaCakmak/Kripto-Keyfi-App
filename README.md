# Kripto Keyfi

Kripto Keyfi; kripto ekosistemi, eğitim, topluluk, portföy ve yönetim
araçlarını tek bir web uygulamasında bir araya getiren full-stack bir projedir.

## Teknolojiler

- Frontend: React, TypeScript, Vite ve Tailwind CSS
- Backend: Node.js, Express ve TypeScript
- Veritabanı: MySQL, Prisma ORM ve migration dosyaları
- Kimlik doğrulama: JWT access token ve HttpOnly refresh cookie
- Trading engine: Go tabanlı bağımsız servis
- Production: Nginx ve PM2

## Proje yapısı

```text
.
├── frontend/                 React web uygulaması
├── backend/                  REST API, Prisma ve authentication
├── services/
│   └── trading-engine/       Go tabanlı trading servisi
└── README.md
```

Alt bileşenlere ait ayrıntılı bilgiler için:

- [Frontend dokümantasyonu](frontend/README.md)
- [Backend dokümantasyonu](backend/README.md)
- [Trading engine dokümantasyonu](services/trading-engine/README.md)

## Gereksinimler

- Node.js 20 veya üzeri
- npm
- MySQL 8 veya üzeri
- Trading engine geliştirilecekse Go 1.26 veya üzeri

## Environment dosyaları

Örnek environment dosyalarını kopyalayın:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Trading engine kullanılacaksa:

```bash
cp services/trading-engine/.env.example services/trading-engine/.env
```

`.env` dosyaları Git'e gönderilmez. Gerçek şifre, token, API anahtarı,
veritabanı bağlantısı veya private key dokümantasyona ve kaynak koda
yazılmamalıdır.

## Yerel geliştirme

Backend kurulumu:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Frontend kurulumu, ayrı bir terminalde:

```bash
cd frontend
npm install
npm run dev
```

Varsayılan geliştirme adresleri:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api`
- Trading engine: `http://localhost:8081`

Frontend geliştirme sunucusu `/api` isteklerini yerel backend'e yönlendirir.

## Kontroller

Backend:

```bash
cd backend
npm run typecheck
npm test
npm run build
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Trading engine:

```bash
cd services/trading-engine
go test ./...
go vet ./...
go build ./cmd/trading-engine
```

## Veritabanı migration

Development ortamında:

```bash
cd backend
npx prisma migrate dev
```

Production ortamında yalnızca hazırlanmış migration dosyalarını uygulayın:

```bash
cd backend
npx prisma migrate deploy
```

Seed işlemi yalnızca kontrollü ilk kurulumda çalıştırılmalıdır:

```bash
npx prisma db seed
```

## Production deployment

Production deployment sunucu üzerindeki `deploy.sh` ile gerçekleştirilir:

```bash
./deploy.sh
```

Deploy akışı genel olarak şu işlemleri yapar:

1. Ana branch'in son commit'ini çeker.
2. Backend bağımlılıklarını kurar ve kontrolleri çalıştırır.
3. Prisma migration dosyalarını uygular.
4. Backend'i build eder ve PM2 servisini günceller.
5. Frontend'i `VITE_API_URL=/api` ile build eder.
6. Önceki frontend sürümünü yedekler ve yeni çıktıyı yayınlar.
7. Nginx yapılandırmasını ve health endpoint'lerini doğrular.
8. Yapılandırılmışsa trading engine'i test eder, build eder ve günceller.

Production `.env`, DNS, SSL ve Nginx yapılandırmaları repoya eklenmez.

VPS üzerinde deploy öncesi, deploy ve deploy sonrası kullanılacak sabit komut sırası için [standart TESTNET deploy akışına](docs/DEPLOY_STANDARD_TR.md) bakın.

## Temel health endpoint'leri

```text
GET /api/health
GET /health/live       Trading engine
GET /health/ready      Trading engine
```

## Güvenlik

- Secret değerlerini yalnızca environment veya güvenli secret yönetimiyle verin.
- `.env`, log, ekran görüntüsü ve dokümantasyon içinde secret paylaşmayın.
- JWT access ve refresh secret değerlerini birbirinden farklı tutun.
- Production cookie'lerinde HTTPS ve `COOKIE_SECURE=true` kullanın.
- Veritabanı kullanıcısına yalnızca ihtiyaç duyduğu yetkileri verin.
- İlk admin şifresini deployment sonrasında değiştirin.
- Yanlışlıkla paylaşılan her secret değeri silinmiş olsa bile açığa çıkmış kabul
  edilmeli ve hemen yenilenmelidir.

## Katkı akışı

1. Değişiklik için ayrı bir branch açın.
2. Secret veya `.env` dosyası eklemediğinizi kontrol edin.
3. İlgili typecheck, test ve build komutlarını çalıştırın.
4. Açıklayıcı bir commit oluşturun.
5. Pull request üzerinden değişikliği incelemeye gönderin.
