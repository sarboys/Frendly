import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Search as SearchIcon, X, Clock, TrendingUp, MapPin, Users, Calendar, Sparkles } from "lucide-react";
import { useState } from "react";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import ev from "@/assets/event-rooftop.jpg";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Поиск — Dateasy" }] }),
  component: SearchPage,
});

const recent = ["винил", "rooftop", "speciality coffee", "Нина"];
const trending = ["#patriki", "#nightrun", "#wineFriday", "#cinemaclub", "#artnight"];

function SearchPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "ppl" | "meet" | "place" | "tag">("all");

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center gap-2">
        <div className="flex-1 rounded-2xl glass border border-white/10 px-4 py-3 flex items-center gap-2">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Места, события, люди, теги"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {q && <button onClick={() => setQ("")}><X className="size-4 text-muted-foreground" /></button>}
        </div>
        <Link to="/" className="text-sm font-semibold text-lime">Отмена</Link>
      </header>

      <div className="px-5 mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {[
          ["all","Всё"],["ppl","Люди"],["meet","Встречи"],["place","Места"],["tag","Теги"],
        ].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k as never)}
            className={`rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap ${tab===k ? "bg-foreground text-background font-semibold" : "glass border border-white/10"}`}>
            {l}
          </button>
        ))}
      </div>

      {!q ? (
        <>
          <section className="px-5 mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <Clock className="size-3" /> Недавнее
            </p>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button key={r} className="rounded-full glass border border-white/10 px-3 py-1.5 text-sm">{r}</button>
              ))}
            </div>
          </section>
          <section className="px-5 mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <TrendingUp className="size-3" /> В тренде
            </p>
            <div className="flex flex-wrap gap-2">
              {trending.map((r) => (
                <button key={r} className="rounded-full bg-lime/20 text-lime border border-lime/30 px-3 py-1.5 text-sm font-semibold">{r}</button>
              ))}
            </div>
          </section>
          <section className="px-5 mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <Sparkles className="size-3" /> Подбери AI
            </p>
            <Link to="/ai-builder" className="block rounded-3xl p-4 bg-lime-gradient text-lime-foreground shadow-glow">
              <p className="text-sm font-semibold">Опиши вайб — соберу маршрут</p>
              <p className="text-xs opacity-80">«Тёплый вечер у воды, спешелти и винил»</p>
            </Link>
          </section>
        </>
      ) : (
        <section className="px-5 mt-5 space-y-2">
          <ResultRow icon={<Users className="size-4" />} title="Нина, 26" sub="Дизайнер · 1.2 км" img={p1} to="/u/$userId" params={{userId:"1"}} />
          <ResultRow icon={<Users className="size-4" />} title="Марк, 28" sub="Бариста · 0.9 км" img={p2} to="/u/$userId" params={{userId:"2"}} />
          <ResultRow icon={<Calendar className="size-4" />} title="Винил-вечер на крыше" sub="Пт · 21:00" img={ev} to="/meetings/$meetingId" params={{meetingId:"1"}} />
          <ResultRow icon={<MapPin className="size-4" />} title="Rooftop 17" sub="Бар · 0.8 км" img={ev} to="/meetings" />
        </section>
      )}

      <div className="h-16" />
    </PhoneFrame>
  );
}

function ResultRow({ icon, title, sub, img, to, params }: any) {
  return (
    <Link to={to} params={params} className="flex items-center gap-3 rounded-2xl glass border border-white/10 p-2.5">
      <div className="relative size-12 rounded-xl overflow-hidden">
        <img src={img} className="size-full object-cover" alt="" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">{icon}{sub}</p>
      </div>
    </Link>
  );
}
