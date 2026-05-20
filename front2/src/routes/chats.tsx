import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/dateasy/TopBar";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { Search, Plus, Check, CheckCheck } from "lucide-react";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/chats")({
  head: () => ({
    meta: [
      { title: "Чаты — Dateasy" },
      { name: "description", content: "Сообщения, мэтчи и обсуждения встреч в Dateasy." },
    ],
  }),
  component: ChatsPage,
});

const matches = [
  { name: "Нина", img: p1, online: true },
  { name: "Марк", img: p2, online: false },
  { name: "Лия", img: p3, online: true },
  { name: "Тим", img: p2, online: false },
  { name: "Ева", img: p1, online: true },
];

const chats = [
  {
    name: "Лия",
    img: p3,
    last: "Окей, тогда в 19:30 у Brew Lab ✨",
    time: "только что",
    unread: 2,
    status: "online",
    tag: { label: "Speciality coffee", tone: "lime" },
  },
  {
    name: "Марк",
    img: p2,
    last: "Ты слышала тот сет на крыше?",
    time: "12:40",
    unread: 0,
    status: "read",
    tag: { label: "Винил-вечер", tone: "pink" },
  },
  {
    name: "Нина",
    img: p1,
    last: "Печатает…",
    time: "11:02",
    unread: 5,
    status: "typing",
    tag: { label: "Утренний раннинг", tone: "lilac" },
  },
  {
    name: "Тим",
    img: p2,
    last: "Голосовое сообщение · 0:24",
    time: "Вчера",
    unread: 0,
    status: "delivered",
    tag: null,
  },
  {
    name: "Ева",
    img: p1,
    last: "Прислала фото с галереи 🎨",
    time: "Вчера",
    unread: 0,
    status: "read",
    tag: { label: "Art night", tone: "lime" },
  },
];

const toneMap = {
  lime: "bg-lime/20 text-lime border-lime/30",
  pink: "bg-pink/20 text-pink border-pink/30",
  lilac: "bg-lilac/20 text-lilac border-lilac/30",
} as const;

function ChatsPage() {
  return (
    <PhoneFrame>
      <TopBar />

      <div className="px-5 pt-6">
        <p className="text-sm text-muted-foreground">5 новых мэтчей сегодня</p>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold">
          Твои <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3 pb-1 inline-block leading-[1.1]">чаты</span>
        </h1>
      </div>

      <div className="px-5 mt-5">
        <div className="glass border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            placeholder="Найти диалог или встречу"
            className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Matches row */}
      <section className="mt-6">
        <div className="px-5 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Новые мэтчи</h2>
          <button className="text-sm text-muted-foreground">Все</button>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar px-5">
          <button className="shrink-0 w-16 flex flex-col items-center gap-1.5">
            <span className="size-16 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
              <Plus className="size-6" />
            </span>
            <span className="text-[11px] text-muted-foreground">Свайпать</span>
          </button>
          {matches.map((m) => (
            <button key={m.name} className="shrink-0 w-16 flex flex-col items-center gap-1.5">
              <span className="relative">
                <span className="block p-[2px] rounded-full bg-pink-gradient">
                  <img src={m.img} alt={m.name} className="size-16 rounded-full object-cover ring-2 ring-background" />
                </span>
                {m.online && (
                  <span className="absolute bottom-0 right-0 size-3.5 rounded-full bg-lime ring-2 ring-background" />
                )}
              </span>
              <span className="text-[11px] truncate w-full text-center">{m.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Chat list */}
      <section className="mt-7 px-5">
        <div className="flex items-center gap-2">
          <button className="rounded-full px-3.5 py-1.5 text-xs font-medium bg-foreground text-background">Все</button>
          <button className="rounded-full px-3.5 py-1.5 text-xs font-medium glass border border-white/10">Встречи</button>
          <button className="rounded-full px-3.5 py-1.5 text-xs font-medium glass border border-white/10">Личные</button>
          <button className="rounded-full px-3.5 py-1.5 text-xs font-medium glass border border-white/10">Непрочитанные</button>
        </div>

        <div className="mt-4 space-y-2">
          {chats.map((c, idx) => (
            <Link
              key={c.name}
              to="/meetings/$meetingId/chat"
              params={{ meetingId: String(idx + 1) }}
              className="rounded-3xl p-3 glass border border-white/10 flex items-center gap-3"
            >
              <div className="relative shrink-0">
                <img src={c.img} alt={c.name} className="size-14 rounded-2xl object-cover" />
                {c.status === "online" || c.status === "typing" ? (
                  <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-lime ring-2 ring-background" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <span className="text-[11px] text-muted-foreground shrink-0">{c.time}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {c.status === "read" && <CheckCheck className="size-3.5 text-lime" />}
                  {c.status === "delivered" && <Check className="size-3.5" />}
                  <span className={"truncate " + (c.status === "typing" ? "text-lime" : "")}>{c.last}</span>
                </div>
                {c.tag && (
                  <span
                    className={
                      "mt-2 inline-block text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border " +
                      toneMap[c.tag.tone as keyof typeof toneMap]
                    }
                  >
                    {c.tag.label}
                  </span>
                )}
              </div>
              {c.unread > 0 && (
                <span className="size-6 rounded-full bg-lime-gradient text-lime-foreground text-xs font-bold grid place-items-center shadow-glow">
                  {c.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
