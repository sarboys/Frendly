import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/dateasy/TopBar";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { Search, Plus, Users, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import evRoof from "@/assets/event-rooftop.jpg";
import evArt from "@/assets/event-art.jpg";
import evCoffee from "@/assets/event-coffee.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/communities/")({
  head: () => ({
    meta: [
      { title: "Сообщества — Frendly" },
      { name: "description", content: "Сообщества по интересам и встречи внутри них." },
    ],
  }),
  component: CommunitiesPage,
});

const featured = [
  { id: "wine", title: "Wine & vinyl", members: 432, cover: evRoof, tone: "pink" },
  { id: "run", title: "Morning runners", members: 1280, cover: evCoffee, tone: "lime" },
  { id: "art", title: "Neon art club", members: 318, cover: evArt, tone: "lilac" },
];

const mine = [
  { id: "coffee", title: "Coffee snobs", members: 84, people: [p1, p3, p2] },
  { id: "book",   title: "Книжный клуб", members: 56, people: [p3, p2] },
  { id: "pet",    title: "Pet parents", members: 210, people: [p2, p1, p3] },
];

const trending = [
  { title: "Padel weekends", growth: "+24%", emoji: "🎾" },
  { title: "Indie cinema", growth: "+18%", emoji: "🎬" },
  { title: "Yoga at sunrise", growth: "+12%", emoji: "🧘" },
];

const toneCls = {
  pink: "bg-pink text-pink-foreground",
  lime: "bg-lime text-lime-foreground",
  lilac: "bg-lilac text-lilac-foreground",
} as const;

function CommunitiesPage() {
  const [q, setQ] = useState("");
  return (
    <PhoneFrame>
      <TopBar />

      <section className="px-5 mt-5">
        <div className="flex items-end justify-between">
          <h1 className="font-display text-3xl font-semibold leading-tight">
            Сообщества
          </h1>
          <Link
            to="/communities/new"
            className="size-11 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow"
            aria-label="Создать"
          >
            <Plus className="size-5" />
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Найди своих по вайбу</p>
      </section>

      <section className="px-5 mt-4">
        <div className="rounded-2xl glass border border-white/10 px-4 h-12 flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Йога, гастро, музыка..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="px-5 text-lg font-semibold">Популярные</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar px-5 pb-2">
          {featured.map((c) => (
            <Link
              to="/communities/$id"
              params={{ id: c.id }}
              key={c.id}
              className="shrink-0 w-[230px] rounded-3xl overflow-hidden relative border border-white/10 shadow-soft block"
            >
              <img src={c.cover} alt="" className="h-[260px] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <span className={`absolute top-3 left-3 text-[11px] font-semibold rounded-full px-2.5 py-1 ${toneCls[c.tone as keyof typeof toneCls]}`}>
                Сообщество
              </span>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="font-display text-lg font-semibold leading-tight">{c.title}</h3>
                <div className="mt-1 text-xs text-white/70 inline-flex items-center gap-1">
                  <Users className="size-3" /> {c.members} участников
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-lg font-semibold">Мои сообщества</h2>
        <div className="mt-3 space-y-3">
          {mine.map((c) => (
            <Link
              to="/communities/$id"
              params={{ id: c.id }}
              key={c.id}
              className="rounded-3xl p-4 glass border border-white/10 flex items-center gap-4"
            >
              <div className="size-12 rounded-2xl bg-lilac/30 grid place-items-center">
                <Users className="size-5 text-lilac" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{c.title}</h3>
                <div className="mt-1 text-xs text-muted-foreground">{c.members} участников</div>
              </div>
              <div className="flex -space-x-2">
                {c.people.map((p, i) => (
                  <img key={i} src={p} alt="" className="size-7 rounded-full object-cover ring-2 ring-background" />
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="size-5 text-lime" /> В тренде недели
        </h2>
        <div className="mt-3 space-y-2">
          {trending.map((t) => (
            <button
              key={t.title}
              onClick={() => toast(`${t.title} · рост ${t.growth} за неделю`)}
              className="w-full text-left rounded-2xl glass border border-white/10 p-3 flex items-center gap-3"
            >
              <div className="size-10 rounded-xl bg-background/60 grid place-items-center text-xl">{t.emoji}</div>
              <div className="flex-1">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">за 7 дней</div>
              </div>
              <span className="text-xs font-semibold text-lime">{t.growth}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <Link to="/ai-builder" className="block rounded-3xl bg-pink-gradient p-5 text-pink-foreground shadow-soft">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="size-4" /> AI подбор
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold leading-tight">
            Подобрать сообщество <br /> по твоим интересам
          </h3>
        </Link>
      </section>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
