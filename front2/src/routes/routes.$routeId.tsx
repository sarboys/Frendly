import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Share2, MapPin, Clock, Wallet, Sparkles, Users, Ticket, Calendar, Bookmark } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import evRoof from "@/assets/event-rooftop.jpg";
import evArt from "@/assets/event-art.jpg";
import evCoffee from "@/assets/event-coffee.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/routes/$routeId")({
  head: () => ({ meta: [{ title: "Маршрут — Frendly" }] }),
  component: RouteDetail,
});

const stops = [
  { time: "19:00", title: "Brew Lab", sub: "Спешелти-кофе и разговоры", img: evCoffee, cta: "Забронировать", price: "300 ₽", icon: "☕" },
  { time: "20:30", title: "Art Gallery 'Nuit'", sub: "Камерная выставка света", img: evArt, cta: "Купить билет", price: "890 ₽", icon: "🎨" },
  { time: "22:00", title: "Rooftop 17", sub: "Винил-сет с видом на город", img: evRoof, cta: "Забронировать стол", price: "0 ₽", icon: "🎶" },
];

function RouteDetail() {
  const [saved, setSaved] = useState(false);
  const [joined, setJoined] = useState(false);

  return (
    <PhoneFrame>
      <div className="relative h-64">
        <img src={evRoof} className="size-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background" />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link to="/routes" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => { setSaved((s) => !s); toast(saved ? "Убрали из сохранённых" : "Маршрут сохранён"); }}
              className={`size-11 rounded-2xl glass border border-white/10 grid place-items-center ${saved ? "text-lime" : ""}`}
            >
              <Bookmark className={"size-5 " + (saved ? "fill-current" : "")} />
            </button>
            <Link to="/share" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
              <Share2 className="size-5" />
            </Link>
          </div>
        </div>
        <div className="absolute bottom-4 left-5 right-5">
          <span className="rounded-full bg-lime-gradient text-lime-foreground px-3 py-1 text-xs font-bold inline-block shadow-glow">AI-маршрут · вайб «тёплый вечер»</span>
          <h1 className="mt-2 text-3xl font-semibold">Пятница на Патриках</h1>
        </div>
      </div>

      <div className="px-5 mt-5 grid grid-cols-3 gap-2.5">
        <Pill icon={<Clock className="size-3.5" />} label="4 ч" />
        <Pill icon={<MapPin className="size-3.5" />} label="3 точки · 1.4 км" />
        <Pill icon={<Wallet className="size-3.5" />} label="≈ 1 190 ₽" />
      </div>

      <div className="px-5 mt-5 rounded-3xl glass border border-white/10 p-3 flex items-center gap-3">
        <div className="flex -space-x-2">
          {[p1,p2,p3].map((p,i)=>(<img key={i} src={p} className="size-7 rounded-full border-2 border-background object-cover" alt="" />))}
        </div>
        <p className="text-xs text-muted-foreground flex-1">12 человек идут по этому маршруту сегодня</p>
        <button
          onClick={() => { setJoined((j) => !j); toast.success(joined ? "Отменили участие" : "Ты в списке"); }}
          className={"rounded-xl text-xs font-bold px-3 py-1.5 inline-flex items-center gap-1 " + (joined ? "glass border border-lime/40 text-lime" : "bg-lime-gradient text-lime-foreground")}
        >
          <Users className="size-3" /> {joined ? "Иду ✓" : "+Я"}
        </button>
      </div>

      <section className="px-5 mt-6">
        <h2 className="text-lg font-semibold mb-3">Маршрут</h2>
        <div className="relative">
          <div className="absolute left-[22px] top-3 bottom-3 w-px bg-lime/30" />
          <div className="space-y-3">
            {stops.map((s, i) => (
              <div key={i} className="relative pl-12">
                <span className="absolute left-0 top-2 size-11 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center text-lg shadow-glow">
                  {s.icon}
                </span>
                <div className="rounded-2xl glass border border-white/10 overflow-hidden">
                  <div className="relative h-28">
                    <img src={s.img} className="size-full object-cover" alt="" />
                    <span className="absolute top-2 left-2 rounded-md bg-background/70 backdrop-blur px-2 py-0.5 text-[11px] font-bold">{s.time}</span>
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.sub}</p>
                      </div>
                      <p className="text-xs font-bold text-lime whitespace-nowrap">{s.price}</p>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => toast.success(`${s.cta} · ${s.title}`)}
                        className="flex-1 rounded-xl bg-lime-gradient text-lime-foreground text-xs font-bold py-2 inline-flex items-center justify-center gap-1"
                      >
                        <Ticket className="size-3.5" /> {s.cta}
                      </button>
                      <Link to="/map" className="size-9 rounded-xl glass border border-white/10 grid place-items-center">
                        <MapPin className="size-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">На карте</h2>
        <Link to="/map" className="block relative h-40 rounded-3xl overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_30%_30%,oklch(0.35_0.12_295),oklch(0.22_0.09_295))]">
          <svg viewBox="0 0 100 60" className="absolute inset-0 size-full" preserveAspectRatio="none">
            <path d="M15,20 Q40,5 55,30 T85,40" stroke="oklch(0.92 0.2 130)" strokeWidth="0.8" strokeDasharray="2 1.5" fill="none" />
          </svg>
          {[{x:15,y:20,n:1},{x:55,y:30,n:2},{x:85,y:40,n:3}].map(p => (
            <span key={p.n} className="absolute -translate-x-1/2 -translate-y-1/2 size-7 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center text-xs font-bold shadow-glow" style={{left:`${p.x}%`,top:`${p.y * 100 / 60}%`}}>{p.n}</span>
          ))}
        </Link>
      </section>

      <button
        onClick={() => toast.success("Перегенерили AI", { description: "Свежий сценарий готов" })}
        className="mx-5 mt-6 mb-4 w-[calc(100%-2.5rem)] rounded-2xl glass border border-white/10 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
      >
        <Sparkles className="size-4 text-lime" /> Перегенерировать AI
      </button>

      <div className="sticky bottom-0 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <Link to="/meetings/new" className="block w-full text-center rounded-2xl bg-lime-gradient text-lime-foreground py-4 font-bold shadow-glow inline-flex items-center justify-center gap-2">
          <Calendar className="size-5" /> Сделать встречей
        </Link>
      </div>
    </PhoneFrame>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl glass border border-white/10 px-3 py-2.5 text-xs inline-flex items-center gap-1.5 justify-center">
      {icon} {label}
    </div>
  );
}
