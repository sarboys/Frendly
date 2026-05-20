import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/dateasy/TopBar";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { Search, MapPin, Clock, Ticket, Heart, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import evRoof from "@/assets/event-rooftop.jpg";
import evArt from "@/assets/event-art.jpg";
import evCoffee from "@/assets/event-coffee.jpg";

export const Route = createFileRoute("/posters")({
  head: () => ({
    meta: [
      { title: "Афиша — Frendly" },
      { name: "description", content: "Афиша концертов, выставок и вечеринок рядом." },
    ],
  }),
  component: PostersPage,
});

const days = ["Сегодня", "Завтра", "Сб", "Вс", "Эта неделя"];
const cats = ["Все", "Концерты", "Бары", "Выставки", "Кино", "Спорт"];

const featured = {
  title: "Sunset rooftop set",
  meta: "Сегодня · 21:00 · 18+",
  place: "Rooftop 17, Тверская",
  price: "1200 ₽",
  cover: evRoof,
  tag: "Tonight",
};

const events = [
  { title: "Neon Art Opening", meta: "Сб · 19:00", place: "Винзавод", price: "Бесплатно", cover: evArt, tag: "Hot", tone: "pink" },
  { title: "Coffee speed dating", meta: "Вс · 11:00", place: "Brew Lab", price: "от 600 ₽", cover: evCoffee, tag: "New", tone: "lime" },
  { title: "Vinyl & Jazz night", meta: "Пт · 22:00", place: "Noor bar", price: "800 ₽", cover: evRoof, tag: "18+", tone: "lilac" },
  { title: "Sunrise yoga rooftop", meta: "Сб · 07:30", place: "Loft Sky", price: "от 900 ₽", cover: evCoffee, tag: "Утро", tone: "lime" },
  { title: "Street photo walk", meta: "Вс · 14:00", place: "Хохловка", price: "Бесплатно", cover: evArt, tag: "Free", tone: "pink" },
];

const toneCls = {
  pink: "bg-pink text-pink-foreground",
  lime: "bg-lime text-lime-foreground",
  lilac: "bg-lilac text-lilac-foreground",
} as const;

function PostersPage() {
  const [day, setDay] = useState(0);
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState("");
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const buy = (title: string, price: string) => toast.success(`Билет · ${title}`, { description: `Бронь подтверждена, ${price}` });
  const toggleLike = (title: string) => {
    setLiked((l) => ({ ...l, [title]: !l[title] }));
    toast(liked[title] ? "Убрали из избранного" : "Добавили в избранное");
  };

  return (
    <PhoneFrame>
      <TopBar />

      <section className="px-5 mt-5">
        <h1 className="font-display text-3xl font-semibold leading-tight">Афиша</h1>
        <p className="mt-1 text-sm text-muted-foreground">События рядом с тобой</p>
      </section>

      <section className="px-5 mt-4">
        <div className="rounded-2xl glass border border-white/10 px-4 h-12 flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Концерты, бары, выставки..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button onClick={() => toast("Календарь скоро")} className="size-8 rounded-xl bg-lime text-lime-foreground grid place-items-center">
            <Calendar className="size-4" />
          </button>
        </div>
      </section>

      <section className="mt-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-5">
          {days.map((d, i) => (
            <button
              key={d}
              onClick={() => setDay(i)}
              className={
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition " +
                (i === day
                  ? "bg-foreground text-background border-foreground"
                  : "glass border-white/10 text-foreground/80")
              }
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <article className="rounded-3xl overflow-hidden relative border border-white/10 shadow-soft">
          <img src={featured.cover} alt="" className="h-80 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <span className="absolute top-4 left-4 text-[11px] font-semibold uppercase tracking-wider bg-lime text-lime-foreground rounded-full px-2.5 py-1">
            {featured.tag}
          </span>
          <button onClick={() => toggleLike(featured.title)} className={`absolute top-4 right-4 size-10 rounded-full glass border border-white/20 grid place-items-center ${liked[featured.title] ? "text-pink" : ""}`}>
            <Heart className={"size-4 " + (liked[featured.title] ? "fill-current" : "")} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="font-display text-2xl font-semibold leading-tight">{featured.title}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/80">
              <span className="inline-flex items-center gap-1"><Clock className="size-3" />{featured.meta}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{featured.place}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{featured.price}</span>
              <button onClick={() => buy(featured.title, featured.price)} className="rounded-full bg-lime-gradient text-lime-foreground px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5 shadow-glow">
                <Ticket className="size-4" /> Купить билет
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-5">
          {cats.map((c, i) => (
            <button
              key={c}
              onClick={() => setCat(i)}
              className={
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition " +
                (i === cat
                  ? "bg-lilac text-lilac-foreground border-lilac"
                  : "glass border-white/10 text-foreground/80")
              }
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 mt-5 space-y-3">
        {events.map((e) => (
          <article key={e.title} className="rounded-3xl glass border border-white/10 overflow-hidden flex">
            <div className="relative w-28 shrink-0">
              <img src={e.cover} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/30" />
              <span className={`absolute top-2 left-2 text-[10px] font-bold rounded-full px-2 py-0.5 ${toneCls[e.tone as keyof typeof toneCls]}`}>
                {e.tag}
              </span>
            </div>
            <div className="flex-1 p-3">
              <h3 className="font-semibold leading-tight">{e.title}</h3>
              <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="size-3" />{e.meta}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{e.place}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-semibold">{e.price}</span>
                <button onClick={() => buy(e.title, e.price)} className="rounded-full bg-foreground text-background px-3 py-1 text-xs font-semibold inline-flex items-center gap-1">
                  <Ticket className="size-3" /> Билет
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
