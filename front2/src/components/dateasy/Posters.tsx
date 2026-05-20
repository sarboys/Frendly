import { Link } from "@tanstack/react-router";
import rooftop from "@/assets/event-rooftop.jpg";
import art from "@/assets/event-art.jpg";
import coffee from "@/assets/event-coffee.jpg";

const posters = [
  { id: "rooftop", img: rooftop, tag: "Tonight", title: "Sunset rooftop set", meta: "21:00 · 18+ · 240 ₽" },
  { id: "art", img: art, tag: "Hot", title: "Neon Art Opening", meta: "Сб · бесплатно" },
  { id: "coffee", img: coffee, tag: "New", title: "Coffee speed dating", meta: "Вс · 11:00" },
];

export function Posters() {
  return (
    <section className="mt-8">
      <div className="px-5 flex items-end justify-between">
        <h2 className="text-2xl font-semibold">Афиша</h2>
        <Link to="/posters" className="text-sm text-muted-foreground">Все события</Link>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar px-5 pb-2">
        {posters.map((p) => (
          <Link
            key={p.id}
            to="/meetings/$meetingId"
            params={{ meetingId: p.id }}
            className="shrink-0 w-[230px] rounded-3xl overflow-hidden relative border border-white/10 shadow-soft block"
          >
            <img src={p.img} alt={p.title} loading="lazy" className="h-[290px] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <span className="absolute top-3 left-3 text-[11px] font-semibold uppercase tracking-wider bg-lime text-lime-foreground rounded-full px-2.5 py-1">
              {p.tag}
            </span>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="font-display text-lg font-semibold leading-tight">{p.title}</h3>
              <p className="mt-1 text-xs text-white/70">{p.meta}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
