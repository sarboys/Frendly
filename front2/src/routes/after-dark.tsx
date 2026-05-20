import { createFileRoute, Link } from "@tanstack/react-router";
import { Moon, ChevronLeft, Lock, Eye, ShieldCheck, KeyRound, Heart, Sparkles, BellRing } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/after-dark")({
  head: () => ({ meta: [{ title: "After Dark — Frendly" }] }),
  component: AfterDark,
});

const features = [
  { i: Eye, t: "Закрытая лента After Dark", d: "Найтлайф, свидания, wellness и Inner Circle" },
  { i: ShieldCheck, t: "Только верифицированные", d: "Все участники прошли проверку возраста и фото" },
  { i: Lock, t: "Скрытые локации", d: "Адрес открывается за 4 часа до старта" },
  { i: KeyRound, t: "NDA · кодекс молчания", d: "Что было ночью — остаётся в круге" },
  { i: Heart, t: "Безопасность 360°", d: "SOS, сопровождение, доверенные лица — всегда под рукой" },
];

function AfterDark() {
  const [notify, setNotify] = useState(false);

  return (
    <div
      className="mx-auto w-full max-w-[420px] min-h-screen relative overflow-hidden"
      style={{ background: "linear-gradient(160deg,oklch(0.12 0.08 295),oklch(0.06 0.04 295))" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-16 size-72 rounded-full blur-3xl opacity-40 bg-pink-gradient" />
        <div className="absolute bottom-0 -left-16 size-72 rounded-full blur-3xl opacity-30"
             style={{ background: "radial-gradient(circle,oklch(0.6 0.2 280),transparent)" }} />
      </div>

      <div className="relative z-10 px-5 pt-4 pb-10">
        <header className="flex items-center justify-between">
          <Link to="/" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
            <ChevronLeft className="size-5" />
          </Link>
          <span className="font-display text-lg font-semibold inline-flex items-center gap-2">
            <Moon className="size-4" /> After Dark
          </span>
          <span className="rounded-full bg-pink-gradient text-pink-foreground px-2 py-1 text-[10px] font-bold">18+</span>
        </header>

        <div className="mt-8 text-center">
          <h1 className="text-[34px] leading-[1.05] font-semibold">
            Ночной круг для тех,<br />кто живёт интенсивнее.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-[320px] mx-auto">
            Свидания, найтлайф, wellness и closed play — в защищённом, верифицированном кругу.
          </p>
        </div>

        {/* Locked hero card */}
        <div className="mt-7 rounded-3xl glass border border-white/10 p-6 relative overflow-hidden">
          <div className="flex items-center justify-center gap-4 mb-6 opacity-60">
            <span className="size-12 rounded-full bg-pink-gradient blur-xl" />
            <span className="size-12 rounded-full blur-xl" style={{background:"oklch(0.65 0.18 60)"}} />
            <span className="size-12 rounded-full blur-xl" style={{background:"oklch(0.5 0.22 285)"}} />
          </div>
          <div className="flex flex-col items-center">
            <div className="size-16 rounded-full bg-pink/15 border border-pink/40 grid place-items-center shadow-glow">
              <Lock className="size-7 text-pink" />
            </div>
            <p className="mt-4 text-lg font-semibold text-center">8 событий сегодня ночью</p>
            <p className="mt-1 text-xs text-muted-foreground">Раздел откроется скоро</p>
          </div>
        </div>

        {/* Features */}
        <section className="mt-6 space-y-2">
          {features.map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-3xl glass border border-white/10 p-4 flex items-center gap-3">
              <div className="size-12 rounded-2xl grid place-items-center" style={{background:"linear-gradient(135deg,oklch(0.3 0.12 320 / 0.5),oklch(0.2 0.08 295 / 0.5))"}}>
                <Icon className="size-5 text-pink" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{d}</p>
              </div>
              <Sparkles className="size-4 text-pink/60 shrink-0" />
            </div>
          ))}
        </section>

        {/* CTA — notify */}
        <button
          onClick={() => {
            setNotify(true);
            toast.success("Подписан на открытие", { description: "Сообщим, как только After Dark откроется в твоём городе" });
          }}
          disabled={notify}
          className={
            "mt-7 w-full rounded-2xl py-4 font-bold shadow-glow inline-flex items-center justify-center gap-2 transition active:scale-[0.99] " +
            (notify ? "glass border border-pink/40 text-pink" : "bg-pink-gradient text-pink-foreground")
          }
        >
          <BellRing className="size-5" />
          {notify ? "Ты в листе ожидания" : "Следить за открытием"}
        </button>

        <p className="mt-4 text-center text-[11px] text-muted-foreground max-w-[280px] mx-auto">
          Доступ — только по приглашению и после полной верификации.
        </p>
      </div>
    </div>
  );
}
