import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PhoneFrame } from "@/components/PhoneFrame";
import {
  ArrowLeft, MoreHorizontal, Plus, Smile, Send, Sparkles, MapPin, Clock,
  Mic, Play, Image as ImageIcon, MapPinned, BarChart3, FileText, X, Bell, BellOff, LogOut, Flag, Pin, Search, Users,
} from "lucide-react";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/meetings/$meetingId/chat")({
  head: () => ({
    meta: [
      { title: "Чат встречи — Frendly" },
      { name: "description", content: "Групповой чат участников встречи." },
    ],
  }),
  component: MeetingChatPage,
});

type Msg =
  | { id: number; type: "system"; text: string }
  | { id: number; type: "msg"; mine?: boolean; userId?: string; name?: string; img?: string; text: string; time: string }
  | { id: number; type: "voice"; mine?: boolean; userId?: string; name?: string; img?: string; duration: string; time: string; played?: boolean };

const participants = [
  { id: "lia", name: "Лия", img: p3, role: "Хост", online: true },
  { id: "mark", name: "Марк", img: p2, role: "Гость", online: true },
  { id: "nina", name: "Нина", img: p1, role: "Гость", online: false },
  { id: "you", name: "Вы", img: p2, role: "Гость", online: true },
];

const messages: Msg[] = [
  { id: 1, type: "system", text: "Встреча создана · сегодня 12:04" },
  { id: 2, type: "msg", userId: "lia", name: "Лия", img: p3, text: "Привеет! Я хост, очень рада всем 🤍", time: "12:05" },
  { id: 4, type: "msg", userId: "mark", name: "Марк", img: p2, text: "Буду в 19:25, займу столик у окна", time: "12:18" },
  { id: 41, type: "voice", userId: "mark", name: "Марк", img: p2, duration: "0:14", time: "12:19" },
  { id: 5, type: "msg", mine: true, text: "Огонь, я тогда подтянусь к 19:30 ✌️", time: "12:20" },
  { id: 51, type: "voice", mine: true, duration: "0:08", time: "12:21", played: true },
  { id: 6, type: "msg", userId: "nina", name: "Нина", img: p1, text: "Можно с подругой? Она тоже кофеманка", time: "13:02" },
  { id: 7, type: "msg", userId: "lia", name: "Лия", img: p3, text: "Конечно, ещё 2 места есть!", time: "13:04" },
  { id: 71, type: "voice", userId: "lia", name: "Лия", img: p3, duration: "0:22", time: "13:05" },
];

const attachments = [
  { icon: ImageIcon, label: "Фото/видео", tone: "bg-lime-gradient text-lime-foreground" },
  { icon: MapPinned, label: "Локация", tone: "bg-pink-gradient text-pink-foreground" },
  { icon: BarChart3, label: "Опрос", tone: "glass border border-white/10" },
  { icon: FileText, label: "Файл", tone: "glass border border-white/10" },
];

function MeetingChatPage() {
  const [text, setText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [panel, setPanel] = useState<"people" | "menu" | null>(null);
  const hasText = text.trim().length > 0;

  const send = () => {
    if (!hasText) return;
    toast.success("Сообщение отправлено");
    setText("");
  };

  return (
    <PhoneFrame>
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/meetings/$meetingId" params={{ meetingId: "1" }} className="size-10 rounded-2xl glass border border-white/10 grid place-items-center">
            <ArrowLeft className="size-5" />
          </Link>
          <button
            onClick={() => setPanel("people")}
            className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition"
          >
            <div className="flex -space-x-2">
              <img src={p3} className="size-9 rounded-full object-cover ring-2 ring-background" alt="" />
              <img src={p2} className="size-9 rounded-full object-cover ring-2 ring-background" alt="" />
              <img src={p1} className="size-9 rounded-full object-cover ring-2 ring-background" alt="" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Speciality coffee tasting</p>
              <p className="text-[11px] text-lime">4 онлайн · 6 участников</p>
            </div>
          </button>
          <button onClick={() => setPanel("menu")} className="size-10 rounded-2xl glass border border-white/10 grid place-items-center">
            <MoreHorizontal className="size-4" />
          </button>
        </div>

        {/* Sticky compact meeting bar */}
        <Link
          to="/meetings/$meetingId"
          params={{ meetingId: "1" }}
          className="flex items-center gap-2.5 px-4 pb-2.5 pt-0.5 text-[12px]"
        >
          <div className="size-7 rounded-lg bg-lime-gradient text-lime-foreground grid place-items-center text-sm shrink-0">☕</div>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" /> Сегодня · 19:30
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="inline-flex items-center gap-1 truncate font-medium">
            <MapPin className="size-3 text-lime shrink-0" /> Brew Lab, Патрики
          </span>
          <span className="ml-auto rounded-full bg-foreground text-background px-2.5 py-1 text-[10px] font-semibold shrink-0">Маршрут</span>
        </Link>
      </div>

      {/* Messages */}
      <div className="px-4 pt-4 pb-40 space-y-3">
        {messages.map((m) => {
          if (m.type === "system")
            return (
              <div key={m.id} className="flex justify-center">
                <span className="text-[11px] text-muted-foreground rounded-full bg-surface/60 px-3 py-1">
                  {m.text}
                </span>
              </div>
            );

          if (m.type === "voice") {
            const mine = m.mine;
            return (
              <div key={m.id} className={"flex items-end gap-2 " + (mine ? "justify-end" : "")}>
                {!mine && m.userId && (
                  <Link to="/u/$userId" params={{ userId: m.userId }}>
                    <img src={m.img} alt="" className="size-7 rounded-full object-cover" />
                  </Link>
                )}
                <div className={"max-w-[78%] " + (mine ? "items-end" : "")}>
                  {!mine && m.userId && (
                    <Link to="/u/$userId" params={{ userId: m.userId }} className="block">
                      <p className="text-[11px] text-muted-foreground mb-1 ml-1">{m.name}</p>
                    </Link>
                  )}
                  <VoiceBubble mine={!!mine} duration={m.duration} played={m.played} />
                  <p className={"mt-1 text-[10px] text-muted-foreground " + (mine ? "text-right" : "ml-1")}>{m.time}</p>
                </div>
              </div>
            );
          }

          if (m.mine) {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[78%]">
                  <div className="rounded-2xl rounded-br-md bg-lime-gradient text-lime-foreground px-3.5 py-2.5 text-sm shadow-glow">
                    {m.text}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground text-right">{m.time}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className="flex items-end gap-2">
              {m.userId && (
                <Link to="/u/$userId" params={{ userId: m.userId }}>
                  <img src={m.img} alt="" className="size-7 rounded-full object-cover" />
                </Link>
              )}
              <div className="max-w-[78%]">
                {m.userId && (
                  <Link to="/u/$userId" params={{ userId: m.userId }} className="block">
                    <p className="text-[11px] text-muted-foreground mb-1 ml-1">{m.name}</p>
                  </Link>
                )}
                <div className="rounded-2xl rounded-bl-md glass border border-white/10 px-3.5 py-2.5 text-sm">
                  {m.text}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground ml-1">{m.time}</p>
              </div>
            </div>
          );
        })}

        {/* Typing */}
        <div className="flex items-end gap-2">
          <img src={p1} alt="" className="size-7 rounded-full object-cover" />
          <div className="rounded-2xl rounded-bl-md glass border border-white/10 px-3.5 py-2.5 text-sm inline-flex gap-1">
            <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" />
            <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:120ms]" />
            <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:240ms]" />
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 z-20 px-3 pb-3">
        {/* Attachments popup */}
        {attachOpen && (
          <div className="mb-2 rounded-3xl glass border border-white/10 p-3 shadow-soft animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-4 gap-2">
              {attachments.map(({ icon: Icon, label, tone }) => (
                <button
                  key={label}
                  onClick={() => { setAttachOpen(false); toast(`${label} скоро`); }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition"
                >
                  <div className={"size-12 rounded-2xl grid place-items-center " + tone}>
                    <Icon className="size-5" />
                  </div>
                  <span className="text-[11px] text-foreground/80">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => { setText("За встречу! 🥂"); toast("AI подсказал тост"); }} className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-pink-gradient text-pink-foreground px-3 py-1.5 text-xs font-medium">
            <Sparkles className="size-3.5" /> Предложи тост
          </button>
          <button onClick={() => toast("Перенос встречи — выбери новое время")} className="shrink-0 rounded-full glass border border-white/10 px-3 py-1.5 text-xs">Перенести</button>
          <button onClick={() => toast.success("Локация поделена")} className="shrink-0 rounded-full glass border border-white/10 px-3 py-1.5 text-xs">Поделиться местом</button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="glass border border-white/10 rounded-full px-2 py-2 flex items-center gap-2 shadow-soft"
        >
          <button
            type="button"
            onClick={() => setAttachOpen((v) => !v)}
            className={"size-10 rounded-full grid place-items-center transition " + (attachOpen ? "bg-lime-gradient text-lime-foreground rotate-45" : "bg-surface-2")}
          >
            <Plus className="size-5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение в чат встречи"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground px-1"
          />
          <button type="button" onClick={() => setText((t) => t + " 🔥")} className="size-10 rounded-full bg-surface-2 grid place-items-center">
            <Smile className="size-5" />
          </button>
          {hasText ? (
            <button
              type="submit"
              aria-label="Отправить"
              className="size-10 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow"
            >
              <Send className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Голосовое"
              onPointerDown={() => toast("Запись голосового… (удерживайте)")}
              onPointerUp={() => toast.success("Голосовое отправлено")}
              className="size-10 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow active:scale-95"
            >
              <Mic className="size-4" />
            </button>
          )}
        </form>
      </div>

      {/* Sheets */}
      {panel && (
        <button
          aria-label="Закрыть"
          onClick={() => setPanel(null)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in"
        />
      )}
      {panel === "people" && (
        <PeopleSheet onClose={() => setPanel(null)} />
      )}
      {panel === "menu" && (
        <MenuSheet onClose={() => setPanel(null)} />
      )}
    </PhoneFrame>
  );
}

function VoiceBubble({ mine, duration, played }: { mine: boolean; duration: string; played?: boolean }) {
  // Pseudo-random but stable waveform
  const bars = [4, 8, 12, 16, 10, 6, 14, 18, 12, 8, 5, 11, 16, 9, 6, 13, 17, 10, 7, 4, 9, 14];
  return (
    <div
      className={
        "rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-soft " +
        (mine
          ? "rounded-br-md bg-lime-gradient text-lime-foreground shadow-glow"
          : "rounded-bl-md glass border border-white/10")
      }
    >
      <button
        onClick={() => toast("▶ Воспроизведение")}
        className={
          "size-9 rounded-full grid place-items-center shrink-0 " +
          (mine ? "bg-foreground/15" : "bg-lime-gradient text-lime-foreground shadow-glow")
        }
      >
        <Play className="size-4 fill-current" />
      </button>
      <div className="flex items-center gap-[2px] h-7">
        {bars.map((h, i) => (
          <span
            key={i}
            className={
              "w-[2.5px] rounded-full " +
              (mine ? "bg-lime-foreground/70" : "bg-foreground/60")
            }
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <div className="text-[11px] tabular-nums opacity-90 flex items-center gap-1">
        {duration}
        {!played && !mine && <span className="size-1.5 rounded-full bg-lime inline-block" />}
      </div>
    </div>
  );
}

function PeopleSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-w-[440px] mx-auto rounded-t-3xl bg-background border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-4">
      <div className="px-5 pt-3 pb-2 flex items-center">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15" />
      </div>
      <div className="px-5 pb-2 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold">Участники</h3>
          <p className="text-xs text-muted-foreground">{participants.length} человек · 4 онлайн</p>
        </div>
        <button onClick={onClose} className="size-9 rounded-xl glass border border-white/10 grid place-items-center">
          <X className="size-4" />
        </button>
      </div>
      <div className="px-3 pb-6 max-h-[60vh] overflow-y-auto">
        {participants.map((p) => (
          <Link
            key={p.id}
            to="/u/$userId"
            params={{ userId: p.id }}
            onClick={onClose}
            className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/5 active:scale-[0.99] transition"
          >
            <div className="relative">
              <img src={p.img} alt="" className="size-11 rounded-full object-cover" />
              {p.online && (
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-lime ring-2 ring-background" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">{p.role}{p.online ? " · онлайн" : ""}</p>
            </div>
            {p.role === "Хост" && (
              <span className="text-[10px] uppercase tracking-wider rounded-full bg-lime-gradient text-lime-foreground px-2 py-1 font-bold">Хост</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MenuSheet({ onClose }: { onClose: () => void }) {
  const items: { icon: typeof Bell; label: string; tone?: string; action: () => void }[] = [
    { icon: Users, label: "Участники", action: () => toast("Открыть участников") },
    { icon: Search, label: "Поиск по чату", action: () => toast("Поиск") },
    { icon: Pin, label: "Закреплённые сообщения", action: () => toast("Закреплённые") },
    { icon: BellOff, label: "Отключить уведомления", action: () => toast.success("Уведомления выключены") },
    { icon: Bell, label: "Напомнить о встрече", action: () => toast.success("Напомню за час") },
    { icon: Flag, label: "Пожаловаться", tone: "text-pink", action: () => toast("Жалоба отправлена") },
    { icon: LogOut, label: "Покинуть чат", tone: "text-pink", action: () => toast("Вы вышли из чата") },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-w-[440px] mx-auto rounded-t-3xl bg-background border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-4">
      <div className="px-5 pt-3 pb-2 flex items-center">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15" />
      </div>
      <div className="px-5 pb-2 flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">Меню чата</h3>
        <button onClick={onClose} className="size-9 rounded-xl glass border border-white/10 grid place-items-center">
          <X className="size-4" />
        </button>
      </div>
      <div className="px-3 pb-6">
        {items.map(({ icon: Icon, label, tone, action }) => (
          <button
            key={label}
            onClick={() => { action(); onClose(); }}
            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 active:scale-[0.99] transition text-left"
          >
            <div className={"size-10 rounded-xl glass border border-white/10 grid place-items-center " + (tone ?? "")}>
              <Icon className="size-4" />
            </div>
            <span className={"text-sm font-medium " + (tone ?? "")}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
