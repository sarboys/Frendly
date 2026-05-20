import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, MoreHorizontal, Users, Calendar, MapPin, Sparkles, Plus, MessageCircle, Lock, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import cover from "@/assets/event-rooftop.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";
import ev from "@/assets/event-art.jpg";
import ev2 from "@/assets/event-coffee.jpg";

export const Route = createFileRoute("/communities/$id")({
  head: () => ({ meta: [{ title: "Сообщество — Frendly" }] }),
  component: CommunityDetail,
});

const tabs = ["Лента","Встречи","Участники","Правила"];

function CommunityDetail() {
  const [tab, setTab] = useState(0);
  const [joined, setJoined] = useState(false);

  const toggleJoin = () => {
    setJoined((j) => !j);
    toast.success(joined ? "Вышел из сообщества" : "Заявка отправлена", {
      description: joined ? undefined : "Хост одобрит за пару минут",
    });
  };

  return (
    <PhoneFrame>
      <div className="relative h-56">
        <img src={cover} className="size-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background" />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link to="/communities" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
            <ChevronLeft className="size-5" />
          </Link>
          <button onClick={() => toast("Меню сообщества скоро")} className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
            <MoreHorizontal className="size-5" />
          </button>
        </div>
      </div>

      <div className="px-5 -mt-10 relative">
        <div className="size-20 rounded-3xl bg-lime-gradient grid place-items-center text-lime-foreground text-3xl font-bold shadow-glow border-4 border-background">
          🎶
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Wine & vinyl</h1>
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2 mt-1">
          <Lock className="size-3.5" /> Закрытый · <Users className="size-3.5" /> 248 участников
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Каждую пятницу — пластинки, бокал и разговоры до утра. Локации меняются, формат — нет.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={toggleJoin}
            className={"flex-1 rounded-2xl py-3 font-bold inline-flex items-center justify-center gap-1.5 transition " + (joined ? "glass border border-lime/40 text-lime" : "bg-lime-gradient text-lime-foreground shadow-glow")}
          >
            {joined ? <><Check className="size-4" /> Вы вступили</> : <><Plus className="size-4" /> Вступить</>}
          </button>
          <Link to="/communities/$id/chat" params={{ id: "1" }} className="size-12 rounded-2xl glass border border-white/10 grid place-items-center">
            <MessageCircle className="size-5" />
          </Link>
          <Link to="/ai-builder" className="size-12 rounded-2xl glass border border-white/10 grid place-items-center">
            <Sparkles className="size-5 text-lime" />
          </Link>
        </div>
      </div>

      <div className="px-5 mt-5 flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`rounded-full px-4 py-2 text-sm whitespace-nowrap transition ${i === tab ? "bg-foreground text-background font-semibold" : "glass border border-white/10"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Ближайшие встречи</p>
        <div className="space-y-2">
          {[
            { img: ev, t: "Винил-вечер у Рустама", when: "Пт · 21:00", where: "Patriki" },
            { img: ev2, t: "Утро спешелти", when: "Сб · 10:00", where: "Brew Lab" },
          ].map((m) => (
            <Link to="/meetings/$meetingId" params={{ meetingId: "1" }} key={m.t} className="rounded-2xl glass border border-white/10 overflow-hidden flex">
              <img src={m.img} alt="" className="size-20 object-cover" />
              <div className="p-3 flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.t}</p>
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 mt-0.5">
                  <Calendar className="size-3" /> {m.when} · <MapPin className="size-3" /> {m.where}
                </p>
                <div className="mt-2 flex -space-x-1.5">
                  {[p1,p2,p3].map((p,i)=>(
                    <img key={i} src={p} className="size-5 rounded-full border-2 border-background object-cover" alt="" />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-2.5 self-center">+8 идут</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-5 mt-5">
        <div className="flex justify-between items-end">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Лента</p>
          <button onClick={() => toast("Создание поста скоро")} className="text-xs text-lime font-semibold">+ Пост</button>
        </div>
        <div className="mt-2 space-y-2">
          {[
            { who: "Рустам", txt: "Привёз новый Aphex Twin, ждёт в пятницу 🎧", img: p1, when: "2ч" },
            { who: "Алина", txt: "Кто за акустический винил-сет в субботу?", img: p2, when: "5ч" },
          ].map((p) => (
            <div key={p.who} className="rounded-2xl glass border border-white/10 p-3">
              <div className="flex items-center gap-2">
                <img src={p.img} className="size-8 rounded-full object-cover" alt="" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{p.who}</p>
                  <p className="text-[10px] text-muted-foreground">{p.when}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.txt}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="h-16" />
    </PhoneFrame>
  );
}
