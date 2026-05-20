import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Search, Coffee, Wine, Ticket, Pizza, Music2, Sparkles, MapPin, Percent } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ev from "@/assets/event-rooftop.jpg";
import ev2 from "@/assets/event-coffee.jpg";
import ev3 from "@/assets/event-art.jpg";

export const Route = createFileRoute("/perks")({
  head: () => ({ meta: [{ title: "Perks — Frendly" }] }),
  component: PerksPage,
});

const cats = [
  { t: "Кофе", icon: Coffee, c: "lime" },
  { t: "Бары", icon: Wine, c: "pink" },
  { t: "Кино", icon: Ticket, c: "lilac" },
  { t: "Еда", icon: Pizza, c: "lime" },
  { t: "Музыка", icon: Music2, c: "pink" },
];

const groups = [
  { cat: "Кофе и завтраки", items: [
    { t: "Brew Lab", off: "−30% второй напиток", cond: "Будни до 12:00", img: ev2 },
    { t: "Slow Coffee", off: "Десерт в подарок", cond: "За check-in", img: ev2 },
  ]},
  { cat: "Бары и крыши", items: [
    { t: "Rooftop 17", off: "Welcome drink", cond: "Для пары · по брони", img: ev },
    { t: "Noor Bar", off: "−20% коктейли", cond: "Чт–Сб", img: ev },
  ]},
  { cat: "Афиша", items: [
    { t: "Art Gallery Nuit", off: "Билет за 490 ₽", cond: "Вместо 890 ₽", img: ev3 },
  ]},
];

function PerksPage() {
  const [cat, setCat] = useState<string | null>(null);
  const claim = (t: string, off: string) => toast.success(`Перк забран · ${t}`, { description: `${off}. Промокод в кошельке` });
  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Perks</span>
        <Link to="/wallet" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <Percent className="size-5" />
        </Link>
      </header>

      <div className="px-5 mt-5">
        <h1 className="text-3xl font-semibold">Бонусы <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3 pb-1 inline-block leading-[1.1]">по городу</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">Скидки и подарки для встреч Frendly</p>
      </div>

      <Link to="/search" className="block mx-5 mt-4 rounded-2xl glass border border-white/10 px-4 py-3 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground flex-1">Найти место</span>
        <MapPin className="size-4 text-lime" />
      </Link>

      <div className="px-5 mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {cats.map(({t,icon:Icon,c}) => (
          <button
            key={t}
            onClick={() => setCat(cat === t ? null : t)}
            className={`shrink-0 rounded-2xl glass border px-3 py-2 flex items-center gap-2 text-sm transition ${cat === t ? "border-lime shadow-glow" : "border-white/10"}`}
          >
            <span className={`size-7 rounded-lg grid place-items-center ${
              c==="lime"?"bg-lime-gradient text-lime-foreground":
              c==="pink"?"bg-pink-gradient text-pink-foreground":
              "bg-lilac text-lilac-foreground"
            }`}>
              <Icon className="size-3.5" />
            </span>
            {t}
          </button>
        ))}
      </div>

      <div className="px-5 mt-5">
        <div className="relative rounded-3xl overflow-hidden h-40 border border-white/10">
          <img src={ev} className="absolute inset-0 size-full object-cover" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div>
              <span className="rounded-full bg-pink-gradient text-pink-foreground px-2 py-0.5 text-[10px] font-bold">−40% сегодня</span>
              <p className="mt-1 text-lg font-semibold">Rooftop 17 · Welcome drink + закат</p>
            </div>
            <button onClick={() => claim("Rooftop 17", "−40% сегодня")} className="rounded-xl bg-lime-gradient text-lime-foreground text-xs font-bold px-3 py-2">Забрать</button>
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.cat} className="px-5 mt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{g.cat}</p>
          <div className="space-y-2">
            {g.items.map((i) => (
              <div key={i.t} className="rounded-2xl glass border border-white/10 overflow-hidden flex">
                <img src={i.img} className="size-20 object-cover" alt="" />
                <div className="flex-1 p-3 min-w-0">
                  <p className="text-sm font-semibold truncate">{i.t}</p>
                  <p className="text-xs text-lime font-semibold">{i.off}</p>
                  <p className="text-[11px] text-muted-foreground">{i.cond}</p>
                </div>
                <button
                  onClick={() => claim(i.t, i.off)}
                  className="m-3 rounded-xl bg-lime-gradient text-lime-foreground text-xs font-bold px-3 self-center"
                >
                  Забрать
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Link to="/paywall" className="mx-5 mt-6 mb-10 rounded-3xl p-4 bg-pink-gradient text-pink-foreground flex items-center gap-3 shadow-soft">
        <Sparkles className="size-5" />
        <p className="text-sm flex-1">С Plus — все perks без лимита</p>
        <span className="rounded-full bg-background/20 px-3 py-1 text-xs font-bold">Открыть</span>
      </Link>
    </PhoneFrame>
  );
}
