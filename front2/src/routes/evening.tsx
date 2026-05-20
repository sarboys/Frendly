import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { Sparkles, Calendar, MapPin, Moon, Music2, Ticket, Coffee, Flame, ChevronRight } from "lucide-react";
import ev from "@/assets/event-rooftop.jpg";
import ev2 from "@/assets/event-art.jpg";
import ev3 from "@/assets/event-coffee.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/evening")({
  head: () => ({ meta: [{ title: "Сегодня вечером — Dateasy" }] }),
  component: EveningHub,
});

function EveningHub() {
  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Пятница · 16 мая</p>
          <h1 className="text-2xl font-semibold">Сегодня <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3 pb-1 inline-block leading-[1.1]">вечером</span></h1>
        </div>
        <Link to="/after-dark" className="size-11 rounded-2xl bg-pink-gradient text-pink-foreground grid place-items-center shadow-soft">
          <Moon className="size-5" />
        </Link>
      </header>

      {/* AI suggestion */}
      <Link to="/ai-builder/result" className="block mx-5 mt-5 rounded-3xl p-4 bg-lime-gradient text-lime-foreground shadow-glow">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <span className="text-xs font-bold uppercase tracking-wider">AI собрал маршрут</span>
        </div>
        <p className="mt-2 text-lg font-semibold">Кофе → Галерея → Винил на крыше</p>
        <p className="text-xs opacity-80 mt-1">3 точки · 4 ч · ≈ 1 190 ₽</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-bold inline-flex items-center gap-1">Открыть <ChevronRight className="size-3" /></span>
          <div className="flex -space-x-1">
            {[ev3,ev2,ev].map((i,idx)=><img key={idx} src={i} className="size-7 rounded-lg object-cover border-2 border-background" alt="" />)}
          </div>
        </div>
      </Link>

      {/* Quick categories */}
      <section className="px-5 mt-5 grid grid-cols-4 gap-2">
        {[
          { t:"Кофе", icon: Coffee, c:"lime", to:"/perks" },
          { t:"Афиша", icon: Ticket, c:"pink", to:"/posters" },
          { t:"Винил", icon: Music2, c:"lilac", to:"/communities" },
          { t:"Жара", icon: Flame, c:"pink", to:"/after-dark" },
        ].map((q) => (
          <Link to={q.to} key={q.t} className="rounded-2xl glass border border-white/10 p-3 flex flex-col items-center gap-1.5">
            <span className={`size-10 rounded-2xl grid place-items-center ${
              q.c === "lime" ? "bg-lime-gradient text-lime-foreground" :
              q.c === "pink" ? "bg-pink-gradient text-pink-foreground" :
              "bg-lilac text-lilac-foreground"
            }`}>
              <q.icon className="size-4" />
            </span>
            <span className="text-[11px] font-semibold">{q.t}</span>
          </Link>
        ))}
      </section>

      {/* Time slots */}
      <section className="px-5 mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">По часам</p>
        <div className="space-y-2">
          {[
            { time: "18:00", img: ev3, t: "Slow Coffee · ламповый закат", who: [p1,p2] },
            { time: "20:30", img: ev2, t: "Art Gallery Nuit · открытие", who: [p3,p1,p2] },
            { time: "22:00", img: ev, t: "Rooftop 17 · винил-сет", who: [p2,p3] },
          ].map((s) => (
            <Link to="/meetings/$meetingId" params={{meetingId:"1"}} key={s.time} className="flex gap-3 rounded-2xl glass border border-white/10 overflow-hidden">
              <div className="w-14 bg-lime-gradient text-lime-foreground grid place-items-center text-sm font-bold">{s.time}</div>
              <img src={s.img} className="size-20 object-cover" alt="" />
              <div className="flex-1 p-3 min-w-0">
                <p className="text-sm font-semibold truncate">{s.t}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {s.who.map((w,i)=><img key={i} src={w} className="size-5 rounded-full border-2 border-background object-cover" alt="" />)}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{s.who.length + 3} идут</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Weather mood */}
      <div className="mx-5 mt-6 rounded-3xl glass border border-white/10 p-4 flex items-center gap-3">
        <span className="text-3xl">🌇</span>
        <div className="flex-1">
          <p className="text-sm font-semibold">+18° · ясно</p>
          <p className="text-[11px] text-muted-foreground">Идеально для крыш и прогулок</p>
        </div>
        <MapPin className="size-4 text-lime" />
      </div>

      <Link to="/meetings/new" className="mx-5 mt-4 mb-2 rounded-3xl glass border border-white/10 p-4 flex items-center gap-3">
        <Calendar className="size-5 text-lime" />
        <p className="text-sm flex-1">Не нашёл вайб? <b>Собери свою встречу</b></p>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
