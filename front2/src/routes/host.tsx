import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import {
  ChevronLeft, Check, X, Users, Calendar, MapPin, Eye, Heart, MessageCircle,
  TrendingUp, Star, Pencil, Zap, Settings2, Crown, BadgeCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";
import ev1 from "@/assets/event-rooftop.jpg";
import ev2 from "@/assets/event-coffee.jpg";
import ev3 from "@/assets/event-art.jpg";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Host dashboard — Frendly" },
      { name: "description", content: "Управляй встречами, одобряй заявки и смотри аналитику." },
    ],
  }),
  component: HostDashboard,
});

type Req = { id: string; name: string; age: number; img: string; meeting: string; when: string; verified?: boolean; plus?: boolean; note?: string };

const initialReqs: Req[] = [
  { id: "r1", name: "Нина", age: 26, img: p1, meeting: "Винил-вечер на крыше", when: "Пт 21:00", verified: true, plus: true, note: "Принесу пластинки 🎶" },
  { id: "r2", name: "Марк", age: 28, img: p2, meeting: "Coffee tasting", when: "Сб 10:00", verified: true },
  { id: "r3", name: "Лия", age: 24, img: p3, meeting: "Винил-вечер на крыше", when: "Пт 21:00", plus: true, note: "Впервые на Frendly" },
];

const myEvents = [
  { id: "e1", title: "Винил-вечер на крыше", img: ev1, when: "Пт · 21:00", where: "Patriki", going: 8, cap: 12, views: 312, status: "live" as const },
  { id: "e2", title: "Speciality coffee tasting", img: ev2, when: "Сб · 10:00", where: "Brew Lab", going: 4, cap: 6, views: 128, status: "live" as const },
  { id: "e3", title: "Galleries hop", img: ev3, when: "Вс · 14:00", where: "Винзавод", going: 2, cap: 8, views: 41, status: "draft" as const },
];

function HostDashboard() {
  const [reqs, setReqs] = useState(initialReqs);
  const [tab, setTab] = useState<"all" | "live" | "drafts">("all");

  const decide = (id: string, approve: boolean) => {
    const r = reqs.find((x) => x.id === id);
    setReqs((rs) => rs.filter((x) => x.id !== id));
    if (r) toast.success(approve ? `${r.name} в списке гостей` : `Заявка ${r.name} отклонена`);
  };

  const events = myEvents.filter((e) =>
    tab === "all" ? true : tab === "live" ? e.status === "live" : e.status === "draft",
  );

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center gap-2">
        <Link to="/profile" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Host dashboard</p>
          <h1 className="font-display text-xl font-semibold leading-tight">Алекс · хост</h1>
        </div>
        <Link to="/settings" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <Settings2 className="size-5" />
        </Link>
      </header>

      {/* KPI */}
      <section className="px-5 mt-5 grid grid-cols-3 gap-2">
        {[
          { v: "12", l: "встреч", icon: <Calendar className="size-3.5 text-lime" /> },
          { v: "4.9", l: "рейтинг", icon: <Star className="size-3.5 text-pink fill-current" /> },
          { v: "287", l: "гостей", icon: <Users className="size-3.5 text-lilac" /> },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl glass border border-white/10 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{s.icon}{s.l}</div>
            <p className="mt-1 font-display text-xl font-bold">{s.v}</p>
          </div>
        ))}
      </section>

      {/* Join requests */}
      <section className="px-5 mt-6">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold inline-flex items-center gap-2">
            Заявки
            {reqs.length > 0 && (
              <span className="rounded-full bg-pink text-pink-foreground text-[10px] font-bold px-2 py-0.5">{reqs.length}</span>
            )}
          </h2>
          <button onClick={() => toast("Откроется фильтр")} className="text-xs text-muted-foreground">Фильтр</button>
        </div>

        <div className="mt-3 space-y-2">
          {reqs.length === 0 && (
            <div className="rounded-2xl glass border border-white/10 p-6 text-center text-sm text-muted-foreground">
              Все заявки разобраны 🎉
            </div>
          )}
          {reqs.map((r) => (
            <div key={r.id} className="rounded-2xl glass border border-white/10 p-3">
              <div className="flex items-start gap-3">
                <Link to="/u/$userId" params={{ userId: r.id }}>
                  <img src={r.img} alt="" className="size-12 rounded-2xl object-cover" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold">{r.name}, {r.age}</p>
                    {r.verified && <BadgeCheck className="size-3.5 text-lime" />}
                    {r.plus && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-pink-gradient text-pink-foreground px-1.5 py-0.5 text-[9px] font-bold">
                        <Crown className="size-2.5" /> +
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    → {r.meeting} · {r.when}
                  </p>
                  {r.note && <p className="mt-1 text-xs text-muted-foreground italic">«{r.note}»</p>}
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => decide(r.id, false)}
                  className="rounded-xl glass border border-white/10 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 text-muted-foreground"
                >
                  <X className="size-3.5" /> Отклонить
                </button>
                <button
                  onClick={() => decide(r.id, true)}
                  className="rounded-xl bg-lime-gradient text-lime-foreground py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-glow"
                >
                  <Check className="size-3.5" /> Одобрить
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* My events */}
      <section className="px-5 mt-7">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Мои встречи</h2>
          <Link to="/meetings/new" className="text-xs text-lime font-bold">+ Новая</Link>
        </div>

        <div className="mt-3 flex gap-2">
          {(["all","live","drafts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"rounded-full px-3.5 py-1.5 text-xs font-semibold transition " + (tab === t ? "bg-foreground text-background" : "glass border border-white/10 text-muted-foreground")}
            >
              {t === "all" ? "Все" : t === "live" ? "Активные" : "Черновики"}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {events.map((e) => (
            <div key={e.id} className="rounded-2xl glass border border-white/10 overflow-hidden">
              <div className="flex">
                <img src={e.img} alt="" className="size-24 object-cover" />
                <div className="p-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate flex-1">{e.title}</p>
                    {e.status === "draft" && (
                      <span className="text-[9px] rounded-full bg-muted px-1.5 py-0.5 uppercase tracking-wider text-muted-foreground">Черновик</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 mt-0.5">
                    <Calendar className="size-3" /> {e.when} · <MapPin className="size-3" /> {e.where}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Users className="size-3 text-lime" />{e.going}/{e.cap}</span>
                    <span className="inline-flex items-center gap-1"><Eye className="size-3" />{e.views}</span>
                    <span className="inline-flex items-center gap-1"><Heart className="size-3 text-pink" />{Math.round(e.views * 0.18)}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 border-t border-white/5 divide-x divide-white/5 text-[11px] font-semibold">
                <Link to="/meetings/$meetingId" params={{ meetingId: e.id }} className="py-2.5 inline-flex items-center justify-center gap-1 text-muted-foreground">
                  <Eye className="size-3" /> Открыть
                </Link>
                <Link to="/meetings/new" className="py-2.5 inline-flex items-center justify-center gap-1 text-muted-foreground">
                  <Pencil className="size-3" /> Изменить
                </Link>
                <Link to="/meetings/$meetingId/chat" params={{ meetingId: e.id }} className="py-2.5 inline-flex items-center justify-center gap-1 text-muted-foreground">
                  <MessageCircle className="size-3" /> Чат
                </Link>
                <button onClick={() => toast.success("Встреча в топе радара · 24ч")} className="py-2.5 inline-flex items-center justify-center gap-1 text-pink">
                  <Zap className="size-3" /> Буст
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Insights */}
      <section className="px-5 mt-7">
        <h2 className="text-lg font-semibold inline-flex items-center gap-2">
          <TrendingUp className="size-5 text-lime" /> Инсайты недели
        </h2>
        <div className="mt-3 rounded-3xl glass border border-white/10 p-4 space-y-2.5">
          {[
            { l: "Просмотры встреч", v: "+38%", tone: "text-lime" },
            { l: "Одобрено заявок", v: "24 из 31", tone: "text-foreground" },
            { l: "Среднее время ответа", v: "12 мин", tone: "text-foreground" },
            { l: "Конверсия в участие", v: "67%", tone: "text-lime" },
          ].map((row) => (
            <div key={row.l} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.l}</span>
              <span className={"font-bold " + row.tone}>{row.v}</span>
            </div>
          ))}
        </div>
      </section>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
