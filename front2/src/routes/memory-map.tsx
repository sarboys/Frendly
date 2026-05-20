import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Heart, Users, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/memory-map")({
  head: () => ({ meta: [{ title: "Memory Map — Frendly" }] }),
  component: MemoryMap,
});

const pins = [
  { x: 25, y: 30, t: "Brew Lab", date: "5 мая" },
  { x: 60, y: 25, t: "Rooftop 17", date: "12 мая", heart: true },
  { x: 45, y: 55, t: "Noor Bar", date: "20 апр" },
  { x: 75, y: 65, t: "Art Gallery", date: "3 мая", heart: true },
  { x: 30, y: 75, t: "Park Run", date: "18 мая" },
];

const memories = [
  { img: p1, t: "Нина · Винил-вечер", when: "12 мая" },
  { img: p2, t: "Марк · Кофе утром", when: "5 мая" },
  { img: p3, t: "Ева · Галерея Nuit", when: "3 мая" },
];

function MemoryMap() {
  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/profile" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Memory Map</span>
        <Link to="/share" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center text-xs font-semibold text-lime">
          Шер
        </Link>
      </header>

      <div className="px-5 mt-5">
        <h1 className="text-2xl font-semibold">Твой <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3 pb-1 inline-block leading-[1.1]">город встреч</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">23 вечера · 17 людей · 12 мест</p>
      </div>

      <div className="mx-5 mt-5 relative h-[340px] rounded-3xl overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_30%_20%,oklch(0.35_0.12_295),transparent_60%),radial-gradient(circle_at_70%_70%,oklch(0.32_0.13_320),transparent_60%),oklch(0.18_0.08_295)]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" preserveAspectRatio="none">
          <path d="M25,30 Q40,20 60,25 T75,65 Q50,70 45,55 T25,30" stroke="oklch(0.92 0.2 130 / 0.4)" strokeWidth="0.4" fill="none" strokeDasharray="1 1" />
        </svg>
        {pins.map((p, i) => (
          <button
            key={i}
            onClick={() => toast(p.t, { description: p.date })}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{left:`${p.x}%`,top:`${p.y}%`}}
          >
            <div className={`size-9 rounded-full grid place-items-center shadow-soft ${p.heart ? "bg-pink-gradient text-pink-foreground" : "bg-lime-gradient text-lime-foreground"}`}>
              {p.heart ? <Heart className="size-4 fill-current" /> : <MapPin className="size-4" />}
            </div>
            <span className="block mt-1 rounded-md glass border border-white/10 px-2 py-0.5 text-[9px] whitespace-nowrap">{p.t}</span>
          </button>
        ))}
      </div>

      <section className="px-5 mt-5 grid grid-cols-3 gap-2.5">
        <Stat n="23" l="Вечера" c="lime" />
        <Stat n="17" l="Людей" c="pink" />
        <Stat n="12" l="Мест" c="lilac" />
      </section>

      <section className="px-5 mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Места героев</p>
        <div className="rounded-2xl glass border border-white/10 divide-y divide-white/5 overflow-hidden">
          {[
            { t: "Rooftop 17", n: 5 },
            { t: "Brew Lab", n: 4 },
            { t: "Noor Bar", n: 3 },
          ].map((s, i) => (
            <button key={s.t} onClick={() => toast(`${s.t} · ${s.n} вечера`)} className="w-full text-left flex items-center gap-3 px-4 py-3">
              <span className="size-8 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center text-sm font-bold">{i+1}</span>
              <span className="flex-1 text-sm font-semibold">{s.t}</span>
              <span className="text-xs text-muted-foreground">{s.n} вечера</span>
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Воспоминания</p>
        <div className="space-y-2">
          {memories.map((m) => (
            <button key={m.t} onClick={() => toast(m.t, { description: m.when })} className="w-full text-left flex items-center gap-3 rounded-2xl glass border border-white/10 p-2.5">
              <img src={m.img} className="size-11 rounded-xl object-cover" alt="" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{m.t}</p>
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Calendar className="size-3" /> {m.when}</p>
              </div>
              <Users className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <div className="h-12" />
    </PhoneFrame>
  );
}

function Stat({n,l,c}:{n:string;l:string;c:"lime"|"pink"|"lilac"}) {
  const cls = { lime: "bg-lime text-lime-foreground", pink: "bg-pink text-pink-foreground", lilac: "bg-lilac text-lilac-foreground" }[c];
  return (
    <div className={`rounded-2xl p-3 ${cls}`}>
      <p className="text-2xl font-bold">{n}</p>
      <p className="text-[11px] opacity-80">{l}</p>
    </div>
  );
}
