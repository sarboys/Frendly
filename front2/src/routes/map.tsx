import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { Search, SlidersHorizontal, MapPin, Users, Calendar, Navigation, ArrowLeft, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Карта — Frendly" }] }),
  component: MapPage,
});

const pins = [
  { x: 22, y: 30, t: "lime", label: "Brew Lab", sub: "8 идут" },
  { x: 60, y: 22, t: "pink", label: "Rooftop 17", sub: "12 идут" },
  { x: 45, y: 55, t: "lilac", label: "Noor Bar", sub: "5 идут" },
  { x: 75, y: 68, t: "lime", label: "Art Gallery", sub: "3 встречи" },
  { x: 30, y: 75, t: "pink", label: "Park Run", sub: "сб · 8:00" },
];

const nearby = [
  { t: "Rooftop 17 · винил-вечер", sub: "Сегодня 21:00 · 0.8 км", c: "pink" as const },
  { t: "Brew Lab · спешелти", sub: "Сейчас · 0.4 км", c: "lime" as const },
  { t: "Noor Bar · cocktails", sub: "Сегодня 22:30 · 1.1 км", c: "lilac" as const },
  { t: "Park Run · 5K", sub: "Сб 8:00 · 2.4 км", c: "lime" as const },
  { t: "Art Gallery · открытие", sub: "Пт 19:00 · 1.7 км", c: "pink" as const },
];

function MapPage() {
  const [open, setOpen] = useState(true);
  const startY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy > 30) setOpen(false);
    if (dy < -30) setOpen(true);
    startY.current = null;
  };

  return (
    <PhoneFrame>
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.35_0.12_295)_0%,transparent_50%),radial-gradient(circle_at_70%_70%,oklch(0.32_0.13_280)_0%,transparent_50%),linear-gradient(135deg,oklch(0.22_0.09_295),oklch(0.18_0.08_295))]">
          <svg className="absolute inset-0 size-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)" />
          </svg>
          <svg className="absolute inset-0 size-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,50 Q30,30 60,55 T100,40" stroke="oklch(0.6 0.05 295)" strokeWidth="0.5" fill="none" />
            <path d="M40,0 Q45,40 50,60 T55,100" stroke="oklch(0.6 0.05 295)" strokeWidth="0.5" fill="none" />
            <path d="M0,80 L100,80" stroke="oklch(0.6 0.05 295)" strokeWidth="0.3" fill="none" />
          </svg>
        </div>

        {/* Top bar with back */}
        <div className="relative z-10 px-5 pt-4 flex items-center gap-2">
          <Link to="/" aria-label="Назад" className="size-12 rounded-2xl glass border border-white/10 grid place-items-center shrink-0">
            <ArrowLeft className="size-5" />
          </Link>
          <Link to="/" className="flex-1 rounded-2xl glass border border-white/10 px-4 py-3 flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Места, события, люди</span>
          </Link>
          <button className="size-12 rounded-2xl glass border border-white/10 grid place-items-center shrink-0">
            <SlidersHorizontal className="size-5" />
          </button>
        </div>

        <div className="relative z-10 px-5 mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {["Все","Встречи","Места","Люди","Афиша","Сейчас"].map((t, i) => (
            <button key={t} className={`rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap ${i===0 ? "bg-foreground text-background font-semibold" : "glass border border-white/10"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="relative z-10 mx-5 mt-4 h-[420px] rounded-3xl border border-white/10 overflow-hidden">
          {pins.map((p, i) => (
            <button key={i} className="absolute -translate-x-1/2 -translate-y-full group" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <div className={`relative size-10 rounded-full grid place-items-center shadow-glow ${
                p.t === "lime" ? "bg-lime-gradient text-lime-foreground" :
                p.t === "pink" ? "bg-pink-gradient text-pink-foreground" :
                "bg-lilac text-lilac-foreground"
              }`}>
                <MapPin className="size-5 fill-current" />
                <span className={`absolute inset-0 rounded-full radar-ping ${p.t === "lime" ? "bg-lime" : p.t === "pink" ? "bg-pink" : "bg-lilac"}`} />
              </div>
              <div className="mt-1 rounded-lg glass border border-white/10 px-2 py-0.5 text-[10px] whitespace-nowrap">
                {p.label}
              </div>
            </button>
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="absolute inset-0 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/20 radar-ping" />
            <span className="size-4 rounded-full bg-lime border-2 border-background block" />
          </div>

          <button className="absolute right-3 bottom-3 size-11 rounded-2xl glass border border-white/10 grid place-items-center">
            <Navigation className="size-5 text-lime" />
          </button>
        </div>

        {/* Swipeable nearby carousel */}
        <div
          className="relative z-10 mx-5 mt-4 rounded-3xl glass border border-white/10 overflow-hidden transition-all duration-300"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 pt-3 pb-2"
          >
            <div className="flex items-center gap-2">
              <div className="h-1 w-10 rounded-full bg-white/20" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Рядом сейчас · {nearby.length}</p>
            </div>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "" : "rotate-180"}`} />
          </button>

          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ${open ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory px-3 pb-3 pt-1">
              {nearby.map((c) => (
                <Link
                  to="/meetings"
                  key={c.t}
                  className="snap-start shrink-0 w-[78%] rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3"
                >
                  <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${
                    c.c === "lime" ? "bg-lime-gradient text-lime-foreground" :
                    c.c === "pink" ? "bg-pink-gradient text-pink-foreground" :
                    "bg-lilac text-lilac-foreground"
                  }`}>
                    {c.c === "pink" ? <Calendar className="size-4" /> : <Users className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.t}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.sub}</p>
                  </div>
                  <span className="rounded-xl bg-lime-gradient text-lime-foreground text-xs font-bold px-2.5 py-1.5 shrink-0">+Я</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <BottomNav />
        <div className="h-32" />
      </div>
    </PhoneFrame>
  );
}
