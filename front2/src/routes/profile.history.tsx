import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Star, Calendar, MapPin } from "lucide-react";
import evRoof from "@/assets/event-rooftop.jpg";
import evArt from "@/assets/event-art.jpg";
import evCoffee from "@/assets/event-coffee.jpg";

export const Route = createFileRoute("/profile/history")({
  head: () => ({
    meta: [
      { title: "История встреч — Профиль" },
      { name: "description", content: "Все твои прошлые встречи и роли." },
    ],
  }),
  component: HistoryPage,
});

type Item = {
  title: string;
  date: string;
  place: string;
  role: "Хост" | "Гость";
  rating?: number;
  cover: string;
  status: "Состоялась" | "Отменена";
};

const items: Item[] = [
  { title: "Винил-вечер на крыше", date: "12 мая · 21:00", place: "Roof 12", role: "Гость", rating: 5, cover: evRoof, status: "Состоялась" },
  { title: "Art night в галерее", date: "5 мая · 18:00", place: "Winzavod", role: "Хост", rating: 4.8, cover: evArt, status: "Состоялась" },
  { title: "Утренний кофе", date: "28 апр · 09:30", place: "Surf Coffee", role: "Хост", rating: 4.9, cover: evCoffee, status: "Состоялась" },
  { title: "Прогулка по Патрикам", date: "20 апр · 19:00", place: "Патриаршие", role: "Гость", cover: evArt, status: "Отменена" },
  { title: "Speciality tasting", date: "12 апр · 11:00", place: "Brew Lab", role: "Гость", rating: 5, cover: evCoffee, status: "Состоялась" },
];

function HistoryPage() {
  const total = items.filter((i) => i.status === "Состоялась").length;
  const avg = (
    items.filter((i) => i.rating).reduce((s, i) => s + (i.rating || 0), 0) /
    items.filter((i) => i.rating).length
  ).toFixed(1);

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to="/profile" aria-label="Назад" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">История</span>
        <span className="size-11" />
      </div>

      <div className="px-5 mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl glass border border-white/10 p-3">
          <p className="font-display text-2xl font-semibold">{total}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Встреч завершено</p>
        </div>
        <div className="rounded-2xl glass border border-white/10 p-3">
          <p className="font-display text-2xl font-semibold inline-flex items-center gap-1">
            <Star className="size-4 fill-current text-lilac" /> {avg}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Средний рейтинг</p>
        </div>
      </div>

      <section className="px-5 mt-5 space-y-2">
        {items.map((m, i) => (
          <div key={i} className="rounded-2xl glass border border-white/10 p-2.5 flex items-center gap-3">
            <img src={m.cover} alt="" className="size-14 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${m.role === "Хост" ? "bg-lime/20 text-lime" : "bg-pink/20 text-pink"}`}>{m.role}</span>
                {m.status === "Отменена" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground">Отменена</span>
                )}
              </div>
              <p className="text-sm font-semibold truncate mt-0.5">{m.title}</p>
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{m.date}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{m.place}</span>
              </p>
            </div>
            {m.rating && (
              <div className="text-right">
                <p className="inline-flex items-center gap-1 text-sm font-semibold">
                  <Star className="size-3.5 fill-current text-lilac" />
                  {m.rating}
                </p>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="h-24" />
    </PhoneFrame>
  );
}
