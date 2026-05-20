import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/dateasy/TopBar";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { Clock, MapPin, Sparkles, SlidersHorizontal, ArrowUpRight, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";
import evRoof from "@/assets/event-rooftop.jpg";
import evArt from "@/assets/event-art.jpg";
import evCoffee from "@/assets/event-coffee.jpg";

export const Route = createFileRoute("/meetings/")({
  head: () => ({
    meta: [
      { title: "Встречи — Dateasy" },
      { name: "description", content: "Список встреч рядом: кофе, спорт, музыка и спонтанные движухи." },
    ],
  }),
  component: MeetingsPage,
});

const tabs = ["Сегодня", "Завтра", "Эти выходные", "Все"];
const categories = [
  { label: "Все", count: 32, active: true },
  { label: "Кофе", count: 8 },
  { label: "Музыка", count: 6 },
  { label: "Спорт", count: 5 },
  { label: "Бар", count: 7 },
  { label: "Арт", count: 4 },
];

const meetings = [
  {
    id: "coffee",
    title: "Speciality coffee tasting",
    cover: evCoffee,
    time: "Сегодня · 19:30",
    place: "Brew Lab, Патрики",
    going: 4,
    total: 6,
    people: [p1, p3, p2],
    host: "Лия",
    tone: "lime",
    boosted: true,
  },
  {
    id: "vinyl",
    title: "Винил-вечер на крыше",
    cover: evRoof,
    time: "Пт · 21:00",
    place: "Rooftop 17",
    going: 9,
    total: 12,
    people: [p2, p3, p1],
    host: "Марк",
    tone: "pink",
    boosted: true,
  },
  {
    id: "art",
    title: "Art night в галерее",
    cover: evArt,
    time: "Сб · 18:00",
    place: "Винзавод",
    going: 6,
    total: 10,
    people: [p3, p1],
    host: "Ева",
    tone: "lilac",
  },
  {
    id: "run",
    title: "Утренний раннинг в парке",
    cover: evCoffee,
    time: "Вс · 08:00",
    place: "Парк Горького",
    going: 6,
    total: 8,
    people: [p1, p2, p3],
    host: "Тим",
    tone: "lime",
  },
];

const toneMap = {
  lime: "bg-lime text-lime-foreground",
  lilac: "bg-lilac text-lilac-foreground",
  pink: "bg-pink text-pink-foreground",
} as const;

function MeetingsPage() {
  const [day, setDay] = useState(0);
  const [cat, setCat] = useState("Все");
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  return (
    <PhoneFrame>
      <TopBar />

      <div className="px-5 pt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">32 встречи рядом</p>
          <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold">
            Список <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3 pb-1 inline-block leading-[1.1]">встреч</span>
          </h1>
        </div>
        <Link to="/dating/filter" aria-label="Фильтры" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center shrink-0">
          <SlidersHorizontal className="size-5" />
        </Link>
      </div>

      {/* Day tabs */}
      <div className="px-5 mt-5 flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setDay(i)}
            className={
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition " +
              (i === day
                ? "bg-foreground text-background border-transparent"
                : "border-white/10 text-foreground/80 glass")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* Category pills */}
      <div className="px-5 mt-3 flex gap-2 overflow-x-auto no-scrollbar">
        {categories.map((c) => {
          const on = cat === c.label;
          return (
            <button
              key={c.label}
              onClick={() => setCat(c.label)}
              className={
                "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium border inline-flex items-center gap-2 transition " +
                (on
                  ? "bg-lime-gradient text-lime-foreground border-transparent shadow-glow"
                  : "border-white/10 text-foreground/80 glass")
              }
            >
              {c.label}
              <span
                className={
                  "text-[10px] font-bold rounded-full px-1.5 py-0.5 " +
                  (on ? "bg-lime-foreground/15" : "bg-white/10")
                }
              >
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* AI suggest */}
      <Link to="/ai-builder" className="mx-5 mt-6 rounded-3xl p-4 bg-pink-gradient text-pink-foreground flex items-center gap-3 shadow-soft">
        <div className="size-10 rounded-2xl bg-background/20 grid place-items-center">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight">AI подберёт встречу под вечер</p>
          <p className="text-xs opacity-80">Расскажи настроение — соберём план</p>
        </div>
        <span className="rounded-full bg-background/20 px-3 py-1.5 text-xs font-semibold">
          Собрать
        </span>
      </Link>

      {/* List */}
      <section className="px-5 mt-6 space-y-4">
        {meetings.map((m) => (
          <article
            key={m.id}
            className={
              "relative rounded-3xl overflow-hidden " +
              (m.boosted
                ? "ring-2 ring-pink/50 shadow-[0_0_40px_-10px] shadow-pink/60 bg-gradient-to-br from-pink/10 via-background to-background border border-pink/30"
                : "glass border border-white/10")
            }
          >
            {m.boosted && (
              <>
                <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-pink/30 blur-3xl" />
                <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-pink-gradient text-pink-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-glow">
                  <Zap className="size-3 fill-current" /> Boost
                </span>
              </>
            )}
            <Link to="/meetings/$meetingId" params={{ meetingId: m.id }} className="relative h-36 block">
              <img src={m.cover} alt={m.title} className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
              <span className={`absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] font-bold ${toneMap[m.tone as keyof typeof toneMap]}`}>
                {m.going}/{m.total} идут
              </span>
              {!m.boosted && (
                <span className="absolute top-3 right-3 size-9 rounded-full glass border border-white/15 grid place-items-center">
                  <ArrowUpRight className="size-4" />
                </span>
              )}
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-lg font-semibold leading-tight">{m.title}</h3>
              </div>
            </Link>
            <div className="px-4 pt-3 pb-4">
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="mt-3 flex items-center gap-3">
                <div className="flex -space-x-2 shrink-0">
                  {m.people.map((p, i) => (
                    <img key={i} src={p} alt="" className="size-8 rounded-full object-cover ring-2 ring-background" />
                  ))}
                  <span className="size-8 rounded-full bg-foreground text-background text-[10px] font-bold grid place-items-center ring-2 ring-background">
                    +{m.total - m.people.length}
                  </span>
                </div>
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    <Clock className="size-3.5 text-lime" />
                    <span>{m.time}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{m.place}</span>
                    <span className="opacity-40">·</span>
                    <span className="truncate">Хост · {m.host}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setJoined((j) => ({ ...j, [m.id]: !j[m.id] }));
                    toast.success(joined[m.id] ? "Отменили участие" : "Ты в списке гостей");
                  }}
                  className={
                    "shrink-0 rounded-full text-xs font-bold px-4 h-9 inline-flex items-center gap-1.5 transition active:scale-95 " +
                    (joined[m.id]
                      ? "glass border border-lime/40 text-lime"
                      : "bg-lime-gradient text-lime-foreground shadow-glow")
                  }
                >
                  {joined[m.id] ? "✓ Иду" : "Иду"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
