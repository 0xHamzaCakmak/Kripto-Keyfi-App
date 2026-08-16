import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, getApiErrorMessage } from "../services/apiClient";

type DashboardData = {
  userCount: number;
  activeBotCount: number;
  connectedExchangeCount: number;
  systemStatus: string;
};
export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get<{ data: DashboardData }>("/admin/dashboard")
      .then((response) => setData(response.data.data))
      .catch((reason) =>
        setError(getApiErrorMessage(reason, "Dashboard bilgileri alınamadı.")),
      );
  }, []);
  const metrics = [
    ["Toplam kullanıcı", data?.userCount ?? "—", Users],
    ["Aktif bot", data?.activeBotCount ?? 0, Bot],
    ["Bağlı borsa hesabı", data?.connectedExchangeCount ?? 0, Building2],
    ["Sistem durumu", data?.systemStatus ?? "Yükleniyor", Activity],
  ] as const;
  const modules = [
    {
      title: "Trading operasyonları",
      description: "Botlar, borsa hesapları, risk ve sistem durumu.",
      to: "/admin/trading",
      icon: Bot,
      accent: "text-primary",
    },
    {
      title: "Haber Yönetimi",
      description:
        "İzinleri, kaynak durumunu ve otomatik yayın akışını yönetin.",
      to: "/admin/news/sources",
      icon: Radio,
      accent: "text-secondary",
    },
    {
      title: "Kullanıcı yönetimi",
      description: "Kullanıcı hesaplarını, rollerini ve erişim durumlarını yönetin.",
      to: "/admin/users",
      icon: Users,
      accent: "text-primary",
    },
    {
      title: "Sistem güvenliği",
      description: "Denetim, erişim ve servis sağlığı için kontrol alanı.",
      to: "/admin/trading/system",
      icon: ShieldCheck,
      accent: "text-primary",
    },
  ];
  return (
    <div className="space-y-6">
      <section className="kk-gold-panel flex flex-col gap-5 rounded-[32px] p-6 md:flex-row md:items-end md:justify-between md:p-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.25em] text-primary">
            Süper yönetici
          </p>
          <h1 className="mt-2 font-headline text-4xl font-extrabold text-white">
            Kontrol merkezi
          </h1>
          <p className="mt-3 text-sm text-on-surface-variant">
            Hoş geldiniz, {user?.fullName}. Yönetmek istediğiniz alanı seçin.
          </p>
        </div>
        <Link
          to="/admin/news/sources"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background"
        >
          Haber Yönetimini aç <ArrowRight size={18} />
        </Link>
      </section>
      {error && (
        <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">
          {error}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <article
            key={label}
            className="rounded-[28px] border border-outline/5 bg-surface p-6"
          >
            <Icon className="text-primary" />
            <p className="mt-6 text-sm text-on-surface-variant">{label}</p>
            <p className="mt-2 font-headline text-3xl font-black text-white">
              {value}
            </p>
          </article>
        ))}
      </div>
      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[.22em] text-primary">
            Yönetim alanları
          </p>
          <h2 className="mt-1 font-headline text-2xl font-extrabold text-white">
            Bir modül seçin
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {modules.map(
            ({ title, description, to, icon: Icon, accent }) => (
              <Link
                key={title}
                to={to}
                className="group rounded-[28px] border border-outline/10 bg-surface p-6 transition hover:-translate-y-1 hover:border-primary/35 hover:bg-surface-high"
              >
                <Icon className={accent} size={28} />
                <h3 className="mt-8 font-headline text-2xl font-extrabold text-white">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {description}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary">
                  Alanı aç <ArrowRight size={16} />
                </span>
              </Link>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
