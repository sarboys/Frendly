import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { ChevronLeft, Heart, Users, Calendar, Sparkles, MessageCircle, Settings as Cog } from "lucide-react";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Уведомления — Dateasy" }] }),
  component: NotificationsPage,
});

const today = [
  { icon: Heart, c: "pink", who: "Нина", text: "лайкнула тебя", time: "5м", img: p1, cta: "Ответить", to: "/u/$userId", params: { userId: "1" } },
  { icon: Users, c: "lime", who: "Марк", text: "присоединился к твоей встрече «Винил-вечер»", time: "1ч", img: p2, cta: "Открыть", to: "/meetings/$meetingId", params: { meetingId: "1" } },
  { icon: MessageCircle, c: "lilac", who: "Ева", text: "написала в чат «Wine & vinyl»", time: "2ч", img: p3, cta: "Чат", to: "/chats" },
];

const earlier = [
  { icon: Calendar, c: "lime", who: "Brew Lab", text: "новая встреча рядом · спешелти-завтрак", time: "вчера" },
  { icon: Sparkles, c: "pink", who: "AI-вайб", text: "обновил подборку под твой вечер пятницы", time: "вчера" },
  { icon: Heart, c: "pink", who: "Лия", text: "лайкнула тебя", time: "2 дня", img: p2 },
];

function NotificationsPage() {
  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Уведомления</span>
        <Link to="/settings" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <Cog className="size-5" />
        </Link>
      </header>

      <div className="px-5 mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {["Все","Мэтчи","Встречи","Чаты","Система"].map((t, i) => (
          <button key={t} className={`rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap ${i===0 ? "bg-foreground text-background font-semibold" : "glass border border-white/10"}`}>
            {t}
          </button>
        ))}
      </div>

      <Section title="Сегодня">
        {today.map((n, i) => <Row key={i} n={n} unread />)}
      </Section>
      <Section title="Ранее">
        {earlier.map((n, i) => <Row key={i} n={n} />)}
      </Section>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 mt-6">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ n, unread }: { n: any; unread?: boolean }) {
  const Icon = n.icon;
  const body = (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 ${unread ? "bg-lime/5 border-lime/20" : "glass border-white/10"}`}>
      <div className="relative">
        {n.img ? (
          <img src={n.img} className="size-11 rounded-2xl object-cover" alt="" />
        ) : (
          <div className={`size-11 rounded-2xl grid place-items-center ${
            n.c === "lime" ? "bg-lime-gradient text-lime-foreground" :
            n.c === "pink" ? "bg-pink-gradient text-pink-foreground" :
            "bg-lilac text-lilac-foreground"
          }`}>
            <Icon className="size-5" />
          </div>
        )}
        {n.img && (
          <span className={`absolute -bottom-1 -right-1 size-5 rounded-full grid place-items-center border-2 border-background ${
            n.c === "lime" ? "bg-lime text-lime-foreground" :
            n.c === "pink" ? "bg-pink text-pink-foreground" :
            "bg-lilac text-lilac-foreground"
          }`}>
            <Icon className="size-3" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm"><b>{n.who}</b> <span className="text-muted-foreground">{n.text}</span></p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{n.time}</p>
      </div>
      {n.cta && (
        <span className="rounded-xl bg-lime-gradient text-lime-foreground text-xs font-bold px-3 py-1.5">{n.cta}</span>
      )}
      {unread && !n.cta && <span className="size-2 rounded-full bg-lime" />}
    </div>
  );
  return n.to ? <Link to={n.to} params={n.params}>{body}</Link> : body;
}
