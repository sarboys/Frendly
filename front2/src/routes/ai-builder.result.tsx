import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import {
  ArrowLeft, Sparkles, MapPin, Clock, Ticket, Wallet, Share2, RefreshCw,
  Wine, Music2, Coffee, Heart, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import coverA from "@/assets/event-coffee.jpg";
import coverB from "@/assets/event-art.jpg";
import coverC from "@/assets/event-rooftop.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/ai-builder/result")({
  head: () => ({
    meta: [
      { title: "Маршрут вечера — Frendly" },
      { name: "description", content: "Готовый маршрут вечера с бронированием и билетами." },
    ],
  }),
  component: ResultPage,
});

const stops = [
  { time: "19:30", duration: "45 мин", title: "Speciality coffee tasting", place: "Brew Lab, Патрики", price: "от 600 ₽", cover: coverA, icon: Coffee, cta: "Забронировать", tone: "lime" as const },
  { time: "20:45", duration: "1.5 ч", title: "Винил-вечер на крыше", place: "Rooftop 17", price: "1200 ₽", cover: coverC, icon: Music2, cta: "Купить билет", tone: "pink" as const },
  { time: "22:30", duration: "до закрытия", title: "Natural wine bar", place: "Noor, Тверская", price: "депозит 1500 ₽", cover: coverB, icon: Wine, cta: "Забронировать стол", tone: "lilac" as const },
];

const toneBtn = {
  lime: "bg-lime text-lime-foreground",
  pink: "bg-pink text-pink-foreground",
  lilac: "bg-lilac text-lilac-foreground",
} as const;

function ResultPage() {
  const [seed, setSeed] = useState(1);
  const regen = () => { setSeed((s) => s + 1); toast.success("Перегенерили маршрут", { description: "Новый сценарий готов" }); };
  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to="/ai-builder" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-lime" />
          <span className="font-display text-lg font-semibold">Маршрут вечера</span>
        </div>
        <Link to="/share" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <Share2 className="size-5" />
        </Link>
      </div>

      <section className="px-5 mt-5">
        <div className="rounded-3xl p-5 glass border border-white/10 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-lime/30 blur-3xl" />
          <div className="text-xs font-semibold uppercase tracking-wider text-lime flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> Готово · 3 точки · v{seed}
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold leading-tight">
            Уютный пятничный вечер <br /> на Патриках
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-background/60 px-3 py-1.5 inline-flex items-center gap-1"><Clock className="size-3" /> 19:30 – 23:30</span>
            <span className="rounded-full bg-background/60 px-3 py-1.5 inline-flex items-center gap-1"><Wallet className="size-3" /> ~3300 ₽</span>
            <span className="rounded-full bg-background/60 px-3 py-1.5 inline-flex items-center gap-1"><MapPin className="size-3" /> 1.4 км пешком</span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex -space-x-2">
              {[p1, p2, p3].map((p, i) => (
                <img key={i} src={p} alt="" className="size-7 rounded-full object-cover ring-2 ring-background" />
              ))}
              <div className="size-7 rounded-full bg-background grid place-items-center text-[10px] font-semibold ring-2 ring-background">+5</div>
            </div>
            <button onClick={regen} className="text-xs rounded-full glass border border-white/10 px-3 py-1.5 inline-flex items-center gap-1.5">
              <RefreshCw className="size-3" /> Перегенерить
            </button>
          </div>
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-2xl font-semibold">Маршрут</h2>
        <div className="mt-4 space-y-3">
          {stops.map((s, i) => (
            <article key={s.title} className="rounded-3xl overflow-hidden glass border border-white/10 relative">
              <div className="flex">
                <div className="relative w-28 shrink-0">
                  <img src={s.cover} alt="" className="absolute inset-0 size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/40" />
                  <div className="absolute top-3 left-3 rounded-full bg-background/80 backdrop-blur px-2 py-1 text-[10px] font-bold">
                    {i + 1}
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {s.time} · {s.duration}
                  </div>
                  <h3 className="mt-1 font-semibold leading-tight">{s.title}</h3>
                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {s.place}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{s.price}</span>
                    <button
                      onClick={() => toast.success(`${s.cta} · ${s.title}`, { description: s.place })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 ${toneBtn[s.tone]}`}
                    >
                      <Ticket className="size-3.5" /> {s.cta}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 mt-8 space-y-3">
        <button
          onClick={() => toast.success("Бронь всего маршрута оформлена", { description: "3 подтверждения придут в чат" })}
          className="w-full h-14 rounded-2xl bg-lime-gradient text-lime-foreground font-semibold flex items-center justify-center gap-2 shadow-glow"
        >
          <Ticket className="size-5" /> Забронировать всё сразу
        </button>
        <Link to="/meetings/new" className="w-full h-12 rounded-2xl glass border border-white/10 font-medium flex items-center justify-center gap-2">
          <Heart className="size-4" /> Позвать друзей
          <ChevronRight className="size-4" />
        </Link>
      </section>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
