import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import {
  ArrowLeft, Share2, Bookmark, Clock, MapPin, Users, MessageCircle, CheckCircle2,
  Pencil, Zap, UserPlus, Ticket, Percent, Route as RouteIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTokens } from "@/lib/tokens";
import cover from "@/assets/event-coffee.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/meetings/$meetingId/")({
  head: () => ({
    meta: [
      { title: "Встреча — Frendly" },
      { name: "description", content: "Детали встречи: место, состав, чат и расписание." },
    ],
  }),
  component: MeetingDetailPage,
});

const going = [
  { name: "Лия", img: p3, role: "Хост" },
  { name: "Нина", img: p1 },
  { name: "Марк", img: p2 },
  { name: "Тим", img: p2 },
];

const agenda = [
  { time: "19:30", title: "Встречаемся у бара", done: true },
  { time: "19:45", title: "Дегустация 3 фильтров", done: false },
  { time: "20:30", title: "Прогулка по бульвару", done: false },
];

// mock: this meeting has both an afisha ticket and a venue
const attachments = {
  afisha: { title: "Coffee tasting · билет", sub: "Brew Lab · 19:30" },
  venue: { title: "Brew Lab", sub: "−20% по Frendly · до 22:00" },
  route: null as null | { title: string; sub: string },
};

// mock viewer
const isHost = true;

function MeetingDetailPage() {
  const [saved, setSaved] = useState(false);
  const [joined, setJoined] = useState(false);
  const { spend } = useTokens();

  const promote = () => {
    if (!spend(50, "Буст встречи · 24ч")) return;
    toast.success("Встреча в топе радара на 24 часа");
  };
  const invite = () => toast.success("Ссылка-приглашение скопирована");

  return (
    <PhoneFrame>
      {/* Hero */}
      <div className="relative">
        <div className="relative h-72 overflow-hidden">
          <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background" />
        </div>

        <div className="absolute top-4 left-5 right-5 flex items-center justify-between">
          <Link to="/meetings" className="size-11 rounded-2xl glass border border-white/15 grid place-items-center">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSaved((s) => !s); toast(saved ? "Удалено из сохранённых" : "Сохранено"); }}
              className={"size-11 rounded-2xl border border-white/15 grid place-items-center " + (saved ? "bg-lime text-lime-foreground" : "glass")}
            >
              <Bookmark className={"size-5 " + (saved ? "fill-current" : "")} />
            </button>
            <button
              onClick={() => toast.success("Ссылка скопирована")}
              className="size-11 rounded-2xl glass border border-white/15 grid place-items-center"
            >
              <Share2 className="size-5" />
            </button>
          </div>
        </div>

        <div className="absolute left-5 right-5 bottom-4">
          <span className="rounded-full bg-lime-gradient text-lime-foreground px-3 py-1 text-[11px] font-bold">
            Сегодня · 19:30
          </span>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight">Speciality coffee tasting</h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />Brew Lab, Патрики</span>
            <span className="inline-flex items-center gap-1"><Users className="size-3" />4 из 6</span>
          </div>
        </div>
      </div>

      {/* Host actions */}
      {isHost && (
        <div className="px-5 mt-3">
          <div className="rounded-2xl bg-lime/10 border border-lime/30 p-2 grid grid-cols-3 gap-2">
            <Link to="/meetings/new" className="rounded-xl glass border border-white/10 px-2 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold">
              <Pencil className="size-3.5 text-lime" /> Редактировать
            </Link>
            <button onClick={promote} className="rounded-xl glass border border-white/10 px-2 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold">
              <Zap className="size-3.5 text-pink" /> Продвинуть
            </button>
            <button onClick={invite} className="rounded-xl glass border border-white/10 px-2 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold">
              <UserPlus className="size-3.5 text-lilac" /> Пригласить
            </button>
          </div>
        </div>
      )}

      {/* Host */}
      <div className="px-5 mt-3">
        <div className="rounded-3xl glass border border-white/10 p-3 flex items-center gap-3">
          <img src={p3} alt="Лия" className="size-12 rounded-2xl object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Хост</p>
            <p className="text-sm font-semibold">Лия · 4.9 ★</p>
          </div>
          <Link to="/u/$userId" params={{ userId: "liya" }} className="rounded-xl bg-foreground text-background px-3 py-2 text-xs font-semibold">
            Профиль
          </Link>
        </div>
      </div>

      {/* Attachments */}
      {(attachments.afisha || attachments.venue || attachments.route) && (
        <section className="px-5 mt-5 space-y-2">
          {attachments.afisha && (
            <div className="rounded-2xl glass border border-white/10 p-3 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-pink-gradient text-pink-foreground grid place-items-center"><Ticket className="size-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Афиша</p>
                <p className="text-sm font-semibold truncate">{attachments.afisha.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{attachments.afisha.sub}</p>
              </div>
              <button onClick={() => toast.success("Билет куплен · в кошельке")} className="rounded-xl bg-pink-gradient text-pink-foreground px-3 py-2 text-xs font-bold shadow-glow">Билет</button>
            </div>
          )}
          {attachments.venue && (
            <div className="rounded-2xl glass border border-white/10 p-3 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center"><Percent className="size-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Заведение</p>
                <p className="text-sm font-semibold truncate">{attachments.venue.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{attachments.venue.sub}</p>
              </div>
              <button onClick={() => toast.success("Столик забронирован")} className="rounded-xl bg-lime-gradient text-lime-foreground px-3 py-2 text-xs font-bold shadow-glow">Забронировать</button>
            </div>
          )}
          {attachments.route && (
            <Link to="/routes/$routeId" params={{ routeId: "1" }} className="rounded-2xl glass border border-white/10 p-3 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-lilac/30 text-lilac grid place-items-center"><RouteIcon className="size-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Маршрут</p>
                <p className="text-sm font-semibold truncate">{attachments.route.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{attachments.route.sub}</p>
              </div>
              <span className="rounded-xl bg-foreground text-background px-3 py-2 text-xs font-bold">Открыть</span>
            </Link>
          )}
        </section>
      )}

      {/* About */}
      <section className="px-5 mt-5">
        <h2 className="text-lg font-semibold">О встрече</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Пробуем 3 альтернативных способа заваривания, делимся впечатлениями и
          идём гулять по бульвару. Без снобства, с хорошей музыкой и лёгкими
          разговорами.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Coffee", "Small talk", "Walk", "18+"].map((t) => (
            <span key={t} className="rounded-full glass border border-white/10 px-3 py-1.5 text-xs">{t}</span>
          ))}
        </div>
      </section>

      {/* Going */}
      <section className="px-5 mt-6">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Кто идёт</h2>
          <button className="text-sm text-muted-foreground">Все</button>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar">
          {going.map((g) => (
            <div key={g.name} className="shrink-0 w-20 flex flex-col items-center gap-1.5">
              <img src={g.img} alt={g.name} className="size-16 rounded-2xl object-cover" />
              <p className="text-xs font-medium truncate w-full text-center">{g.name}</p>
              {g.role && <span className="text-[10px] text-lime">{g.role}</span>}
            </div>
          ))}
          <button onClick={invite} className="shrink-0 w-20 flex flex-col items-center gap-1.5">
            <div className="size-16 rounded-2xl border border-dashed border-white/15 grid place-items-center text-muted-foreground">
              +2
            </div>
            <p className="text-xs text-muted-foreground">мест</p>
          </button>
        </div>
      </section>

      {/* Agenda */}
      <section className="px-5 mt-6">
        <h2 className="text-lg font-semibold">План вечера</h2>
        <div className="mt-3 rounded-3xl glass border border-white/10 p-2">
          {agenda.map((a, i) => (
            <div key={a.time} className={"flex items-center gap-3 p-3 " + (i ? "border-t border-white/5" : "")}>
              <div className={"size-9 rounded-xl grid place-items-center " + (a.done ? "bg-lime text-lime-foreground" : "bg-surface-2 text-muted-foreground")}>
                {a.done ? <CheckCircle2 className="size-5" /> : <Clock className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{a.title}</p>
                <p className="text-[11px] text-muted-foreground">{a.time}</p>
              </div>
              <Link to="/map" className="shrink-0 rounded-full glass border border-white/10 px-2.5 h-8 inline-flex items-center gap-1 text-[11px] font-medium">
                <MapPin className="size-3 text-lime" /> На карте
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Location */}
      <section className="px-5 mt-6">
        <h2 className="text-lg font-semibold">Место</h2>
        <div className="mt-3 relative h-40 rounded-3xl overflow-hidden border border-white/10 bg-surface">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,oklch(0.92_0.2_130/0.25),transparent_60%),radial-gradient(circle_at_70%_70%,oklch(0.82_0.16_320/0.25),transparent_60%)]" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="size-12 rounded-full bg-lime-gradient grid place-items-center text-lime-foreground shadow-glow">
              <MapPin className="size-5" />
            </div>
          </div>
          <div className="absolute left-3 right-3 bottom-3 rounded-2xl glass border border-white/10 px-3 py-2 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Brew Lab</p>
              <p className="text-[11px] text-muted-foreground truncate">Цветной бульвар, 12 · 1.2 км</p>
            </div>
            <Link to="/map" className="rounded-xl bg-foreground text-background px-3 py-1.5 text-xs font-semibold">Маршрут</Link>
          </div>
        </div>
      </section>

      {/* Sticky action */}
      <div className="px-5 mt-6 flex items-center gap-3">
        <Link
          to="/meetings/$meetingId/chat"
          params={{ meetingId: "1" }}
          className="size-14 rounded-2xl glass border border-white/10 grid place-items-center"
        >
          <MessageCircle className="size-5" />
        </Link>
        <button
          onClick={() => { setJoined((j) => !j); toast.success(joined ? "Вы отменили участие" : "Вы в списке гостей · бесплатно"); }}
          className={"flex-1 rounded-2xl py-4 text-base font-bold shadow-glow transition active:scale-[0.99] " + (joined ? "bg-pink text-pink-foreground" : "bg-lime-gradient text-lime-foreground")}
        >
          {joined ? "✓ Я иду · отменить" : "Я иду · бесплатно"}
        </button>
      </div>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
