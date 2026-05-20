import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/dateasy/TopBar";
import { BottomNav } from "@/components/dateasy/BottomNav";
import {
  Sparkles, Clock, MapPin, Wallet, ArrowUpRight, Flame, Heart, Wine, Music2, Coffee,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import evRoof from "@/assets/event-rooftop.jpg";
import evArt from "@/assets/event-art.jpg";
import evCoffee from "@/assets/event-coffee.jpg";

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Маршруты вечера — Frendly" },
      { name: "description", content: "Готовые маршруты вечера от AI и сообщества." },
    ],
  }),
  component: RoutesPage,
});

const filters = ["Все", "Романтика", "С друзьями", "Соло", "Бюджет"];

const routesList = [
  { id: "patriki", title: "Пятница на Патриках", tag: "Романтика", cover: evRoof, stops: 3, duration: "4 ч", price: "~3300 ₽", distance: "1.4 км", icons: [Coffee, Music2, Wine], likes: 248, tone: "pink" as const },
  { id: "gastro",  title: "Гастро-тур по Хохловке", tag: "С друзьями", cover: evCoffee, stops: 4, duration: "5 ч", price: "~4500 ₽", distance: "2.1 км", icons: [Coffee, Wine, Music2], likes: 412, tone: "lime" as const },
  { id: "art",     title: "Арт-вечер на Винзаводе", tag: "Соло", cover: evArt, stops: 3, duration: "3 ч", price: "~1800 ₽", distance: "0.8 км", icons: [Coffee, Music2], likes: 156, tone: "lilac" as const },
];

const toneCls = {
  pink: "bg-pink text-pink-foreground",
  lime: "bg-lime text-lime-foreground",
  lilac: "bg-lilac text-lilac-foreground",
} as const;

function RoutesPage() {
  const [filter, setFilter] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setLiked((l) => ({ ...l, [id]: !l[id] }));
    toast(liked[id] ? "Убрали из сохранённых" : "Сохранили маршрут");
  };
  return (
    <PhoneFrame>
      <TopBar />

      <section className="px-5 mt-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight">
              Маршруты вечера
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Готовые сценарии — бронируй в один клик</p>
          </div>
          <Link to="/ai-builder" className="size-11 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
            <Sparkles className="size-5" />
          </Link>
        </div>
      </section>

      <section className="mt-5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-5">
          {filters.map((f, i) => (
            <button
              key={f}
              onClick={() => setFilter(i)}
              className={
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition " +
                (i === filter
                  ? "bg-foreground text-background border-foreground"
                  : "glass border-white/10 text-foreground/80")
              }
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <Link to="/ai-builder" className="block rounded-3xl bg-lime-gradient text-lime-foreground p-5 shadow-glow relative overflow-hidden">
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/40 blur-3xl" />
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="size-4" /> AI
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold leading-tight">
            Собрать персональный <br /> маршрут под настроение
          </h3>
        </Link>
      </section>

      <section className="px-5 mt-7">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Flame className="size-5 text-pink" /> Сегодня горячо
        </h2>
        <div className="mt-3 space-y-4">
          {routesList.map((r) => (
            <Link
              key={r.id}
              to="/routes/$routeId"
              params={{ routeId: r.id }}
              className="block rounded-3xl overflow-hidden glass border border-white/10 shadow-soft"
            >
              <div className="relative h-40">
                <img src={r.cover} alt="" className="absolute inset-0 size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className={`absolute top-3 left-3 text-[11px] font-semibold rounded-full px-2.5 py-1 ${toneCls[r.tone]}`}>
                  {r.tag}
                </span>
                <button
                  onClick={(e) => toggleLike(r.id, e)}
                  className={`absolute top-3 right-3 size-9 rounded-full glass border border-white/20 grid place-items-center ${liked[r.id] ? "text-pink" : ""}`}
                >
                  <Heart className={"size-4 " + (liked[r.id] ? "fill-current" : "")} />
                </button>
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <h3 className="font-display text-xl font-semibold leading-tight max-w-[70%]">{r.title}</h3>
                  <div className="flex -space-x-1.5">
                    {r.icons.map((I, i) => (
                      <div key={i} className="size-7 rounded-full bg-background/80 backdrop-blur grid place-items-center ring-2 ring-background">
                        <I className="size-3.5" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between text-xs">
                <div className="flex flex-wrap gap-3 text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{r.stops} точки · {r.distance}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="size-3" />{r.duration}</span>
                  <span className="inline-flex items-center gap-1"><Wallet className="size-3" />{r.price}</span>
                </div>
                <div className="size-9 rounded-2xl bg-foreground text-background grid place-items-center">
                  <ArrowUpRight className="size-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
