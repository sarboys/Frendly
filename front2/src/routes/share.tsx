import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Download, Copy, Send, MessageCircle, Camera, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import me from "@/assets/person-3.jpg";

export const Route = createFileRoute("/share")({
  head: () => ({ meta: [{ title: "Поделиться — Frendly" }] }),
  component: ShareCard,
});

const themes = [
  { id: "lime", name: "Lime",  bg: "bg-lime-gradient", fg: "text-lime-foreground" },
  { id: "pink", name: "Pink",  bg: "bg-pink-gradient", fg: "text-pink-foreground" },
  { id: "dark", name: "Night", bg: "bg-[oklch(0.18_0.08_295)]", fg: "text-foreground" },
];

function ShareCard() {
  const [theme, setTheme] = useState(themes[0]);

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/profile" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Share card</span>
        <button
          onClick={() => toast.success("Карточка сохранена в галерею")}
          className="size-11 rounded-2xl glass border border-white/10 grid place-items-center"
        >
          <Download className="size-5" />
        </button>
      </header>

      {/* Card preview */}
      <div className="px-5 mt-6">
        <div className={`relative aspect-[9/16] rounded-3xl overflow-hidden shadow-glow ${theme.bg} ${theme.fg} p-6 flex flex-col`}>
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-background/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 size-40 rounded-full bg-background/10 blur-2xl" />

          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Frendly</span>
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-[10px] font-bold">Plus</span>
          </div>

          <div className="mt-auto relative z-10">
            <img src={me} className="size-20 rounded-3xl object-cover ring-4 ring-background/40" alt="" />
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Алекс, 27
            </h1>
            <p className="mt-1 text-sm opacity-80">Дизайнер · Москва</p>
            <p className="mt-4 text-lg font-semibold leading-snug">
              «Собираю встречи там, где играет хорошая музыка»
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {[{n:"12",l:"встреч"},{n:"48",l:"мэтчей"},{n:"4.9",l:"рейтинг"}].map((s)=>(
                <div key={s.l} className="rounded-2xl bg-background/15 p-2 text-center">
                  <p className="text-lg font-bold">{s.n}</p>
                  <p className="text-[10px] opacity-80">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs opacity-80">frendly.app/u/alex</p>
              <div className="size-12 rounded-xl bg-background/15 grid place-items-center text-[10px] font-bold">
                QR
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Themes */}
      <section className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Тема</p>
        <div className="flex gap-2">
          {themes.map((t) => (
            <button key={t.id} onClick={()=>setTheme(t)}
              className={`flex-1 rounded-2xl border p-3 ${theme.id===t.id ? "border-lime shadow-glow" : "border-white/10"}`}>
              <div className={`h-10 rounded-xl ${t.bg}`} />
              <p className="mt-2 text-xs font-semibold">{t.name}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Share actions */}
      <section className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Поделиться</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { t: "Stories", icon: Camera, c:"pink" },
            { t: "Telegram", icon: Send, c:"lime" },
            { t: "Сообщение", icon: MessageCircle, c:"lilac" },
            { t: "Копировать", icon: Copy, c:"lime" },
          ].map((a)=>(
            <button
              key={a.t}
              onClick={() => toast.success(a.t === "Копировать" ? "Ссылка скопирована" : `Открываем ${a.t}…`)}
              className="rounded-2xl glass border border-white/10 p-3 flex flex-col items-center gap-1.5"
            >
              <span className={`size-10 rounded-xl grid place-items-center ${
                a.c==="lime"?"bg-lime-gradient text-lime-foreground":
                a.c==="pink"?"bg-pink-gradient text-pink-foreground":
                "bg-lilac text-lilac-foreground"
              }`}>
                <a.icon className="size-4" />
              </span>
              <span className="text-[10px] font-semibold text-center">{a.t}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="mx-5 mt-5 mb-10 rounded-3xl glass border border-white/10 p-4 flex items-center gap-3">
        <Sparkles className="size-5 text-lime" />
        <p className="text-xs text-muted-foreground flex-1">Получи Plus за 3 друзей, перешедших по карте</p>
        <span className="text-xs text-lime font-bold">+7 дней</span>
      </div>
    </PhoneFrame>
  );
}
