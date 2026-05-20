import { Clock, MapPin, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

const meetings = [
  {
    title: "Утренний раннинг в парке",
    time: "Завтра · 08:00",
    place: "Парк Горького",
    people: [p1, p3, p2],
    count: 6,
    tone: "lime",
  },
  {
    title: "Speciality coffee tasting",
    time: "Сегодня · 19:30",
    place: "Brew Lab, Патрики",
    people: [p3, p1],
    count: 4,
    tone: "lilac",
  },
  {
    title: "Винил-вечер на крыше",
    time: "Пт · 21:00",
    place: "Rooftop 17",
    people: [p2, p3, p1],
    count: 9,
    tone: "pink",
  },
];

const toneMap = {
  lime: "bg-lime text-lime-foreground",
  lilac: "bg-lilac text-lilac-foreground",
  pink: "bg-pink text-pink-foreground",
} as const;

export function MeetingsList() {
  return (
    <section className="px-5 mt-8">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold">Ближайшие встречи</h2>
        <Link to="/meetings" className="text-sm text-muted-foreground">Все</Link>
      </div>

      <div className="mt-4 space-y-3">
        {meetings.map((m) => (
          <article
            key={m.title}
            className="rounded-3xl p-4 glass border border-white/10 flex items-center gap-4"
          >
            <div className={`size-14 rounded-2xl grid place-items-center font-display text-lg font-bold ${toneMap[m.tone as keyof typeof toneMap]}`}>
              {m.count}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{m.title}</h3>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="size-3" />{m.time}</span>
                <span className="inline-flex items-center gap-1 truncate"><MapPin className="size-3" />{m.place}</span>
              </div>
              <div className="mt-2 flex -space-x-2">
                {m.people.map((p, i) => (
                  <img key={i} src={p} alt="" loading="lazy"
                       className="size-6 rounded-full object-cover ring-2 ring-background" />
                ))}
              </div>
            </div>
            <button className="size-10 rounded-2xl bg-foreground text-background grid place-items-center">
              <ArrowUpRight className="size-4" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
