import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Send, Smile, Paperclip, Users, Pin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/communities/$id/chat")({
  head: () => ({ meta: [{ title: "Чат сообщества — Frendly" }] }),
  component: CommunityChat,
});

type Msg = { id: number; who: string; img: string; text: string; time: string; me?: boolean };

const seed: Msg[] = [
  { id: 1, who: "Рустам", img: p1, text: "Привёз новый Aphex Twin 🎧", time: "12:04" },
  { id: 2, who: "Алина", img: p2, text: "Кто в пятницу на винил?", time: "12:10" },
  { id: 3, who: "Я", img: p3, text: "Я в деле 🙌", time: "12:12", me: true },
  { id: 4, who: "Лия", img: p3, text: "Закину сет на разогрев", time: "12:15" },
];

function CommunityChat() {
  const { id } = Route.useParams();
  const [msgs, setMsgs] = useState<Msg[]>(seed);
  const [val, setVal] = useState("");

  const send = () => {
    const v = val.trim();
    if (!v) return;
    setMsgs((m) => [...m, { id: Date.now(), who: "Я", img: p3, text: v, time: "сейчас", me: true }]);
    setVal("");
  };

  return (
    <PhoneFrame>
      <header className="px-4 pt-4 flex items-center gap-2">
        <Link to="/communities/$id" params={{ id }} className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <Link to="/communities/$id" params={{ id }} className="flex-1 min-w-0 rounded-2xl glass border border-white/10 px-3 h-11 flex items-center gap-2.5">
          <div className="size-7 rounded-xl bg-lime-gradient grid place-items-center text-lime-foreground text-sm">🎶</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-none">Wine & vinyl</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
              <Users className="size-2.5" /> 248 участников · 12 онлайн
            </p>
          </div>
        </Link>
      </header>

      {/* Pinned */}
      <div className="mx-4 mt-3 rounded-2xl bg-lime/10 border border-lime/30 px-3 py-2 flex items-center gap-2">
        <Pin className="size-3.5 text-lime shrink-0" />
        <p className="text-[11px] text-muted-foreground truncate">
          Пт 21:00 · Винил-вечер у Рустама · 8 идут
        </p>
      </div>

      {/* Messages */}
      <div className="px-4 mt-3 space-y-3 pb-32">
        {msgs.map((m) => (
          <div key={m.id} className={"flex items-end gap-2 " + (m.me ? "flex-row-reverse" : "")}>
            <img src={m.img} alt="" className="size-8 rounded-full object-cover" />
            <div className={"max-w-[75%] rounded-2xl px-3 py-2 " + (m.me ? "bg-lime-gradient text-lime-foreground rounded-br-md" : "glass border border-white/10 rounded-bl-md")}>
              {!m.me && <p className="text-[10px] font-semibold text-lime mb-0.5">{m.who}</p>}
              <p className="text-sm leading-snug">{m.text}</p>
              <p className={"text-[9px] mt-1 " + (m.me ? "text-lime-foreground/70" : "text-muted-foreground")}>{m.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[min(100%,420px)] p-3 pb-5 bg-gradient-to-t from-background via-background to-transparent">
        <div className="rounded-2xl glass border border-white/10 px-3 h-12 flex items-center gap-2">
          <button onClick={() => toast("Прикрепить файл")} className="text-muted-foreground"><Paperclip className="size-5" /></button>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Сообщение в чат сообщества..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button onClick={() => toast("Эмодзи")} className="text-muted-foreground"><Smile className="size-5" /></button>
          <button onClick={send} className="size-9 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}
