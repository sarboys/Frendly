import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Flame, Gift, Check, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTokens } from "@/lib/tokens";

export const Route = createFileRoute("/streak")({
  head: () => ({ meta: [{ title: "Streak — Frendly" }] }),
  component: StreakPage,
});

const days = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

type Reward = { n: number; t: string; g: string; got: boolean; ready?: boolean; ft?: number };
const initialRewards: Reward[] = [
  { n: 1, t: "Знакомство", g: "Стикер-пак", got: true },
  { n: 5, t: "Постоянный", g: "+3 буст-свайпа", got: true },
  { n: 10, t: "Тусовщик", g: "1 неделя Plus · 50 FT", got: false, ready: true, ft: 50 },
  { n: 15, t: "Звезда", g: "Скидка 20% на встречи", got: false },
  { n: 25, t: "Легенда", g: "Эксклюзивный бейдж", got: false },
];

function StreakPage() {
  const { reward } = useTokens();
  const [checks, setChecks] = useState([true, true, true, true, true, false, false]);
  const [rewards, setRewards] = useState(initialRewards);
  const checkedToday = checks[5] || checks[6];

  const onCheckin = () => {
    if (checkedToday) {
      toast("Сегодня уже отмечено");
      return;
    }
    const idx = checks.findIndex((c) => !c);
    if (idx === -1) return;
    setChecks((c) => c.map((v, i) => (i === idx ? true : v)));
    toast.success("Check-in засчитан · +1 день streak", { description: "Так держать 🔥" });
  };

  const claim = (n: number, ft?: number) => {
    setRewards((r) => r.map((x) => (x.n === n ? { ...x, got: true, ready: false } : x)));
    if (ft) reward(ft, `Streak ${n} — награда`);
    else toast.success("Награда забрана");
  };

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/profile" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Streak</span>
        <span className="size-11" />
      </header>

      <section className="px-5 mt-6 flex flex-col items-center text-center">
        <div className="relative size-44 rounded-full grid place-items-center">
          <div className="absolute inset-0 rounded-full bg-pink-gradient opacity-30 blur-2xl" />
          <Flame className="size-24 text-pink relative z-10 drop-shadow-[0_0_20px_oklch(0.78_0.19_0)]" />
        </div>
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">streak</p>
        <p className="mt-1 text-6xl font-bold bg-lime-gradient text-lime-foreground rounded-3xl px-6 py-1 inline-block shadow-glow">
          7
        </p>
        <p className="mt-3 text-sm text-muted-foreground max-w-[260px]">
          Ты собираешь встречи 7 недель подряд. Ещё 3 — и подарок
        </p>
      </section>

      <section className="px-5 mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Эта неделя</p>
        <div className="rounded-3xl glass border border-white/10 p-3 grid grid-cols-7 gap-1.5">
          {days.map((d, i) => (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">{d}</span>
              <span className={`size-9 rounded-xl grid place-items-center ${checks[i] ? "bg-lime-gradient text-lime-foreground" : "bg-white/5 text-muted-foreground"}`}>
                {checks[i] ? <Check className="size-4" /> : <span className="text-xs">·</span>}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onCheckin}
          disabled={checkedToday}
          className="mt-3 w-full rounded-2xl bg-lime-gradient text-lime-foreground py-3 font-bold shadow-glow disabled:opacity-40 disabled:shadow-none"
        >
          {checkedToday ? "Сегодня отмечено ✓" : "Check-in сегодня"}
        </button>
      </section>

      <section className="px-5 mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Награды</p>
        <div className="space-y-2">
          {rewards.map((r) => (
            <div key={r.n} className={`rounded-2xl border p-3 flex items-center gap-3 ${r.ready ? "border-lime bg-lime/10 shadow-glow" : "border-white/10 glass"}`}>
              <div className={`size-12 rounded-2xl grid place-items-center font-bold ${r.got ? "bg-lime text-lime-foreground" : r.ready ? "bg-lime-gradient text-lime-foreground" : "bg-white/5 text-muted-foreground"}`}>
                {r.got ? <Check className="size-5" /> : r.ready ? <Gift className="size-5" /> : r.n}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{r.n} встреч · {r.t}</p>
                <p className="text-[11px] text-muted-foreground">{r.g}</p>
              </div>
              {r.got ? (
                <span className="text-xs text-muted-foreground">Получено</span>
              ) : r.ready ? (
                <button onClick={() => claim(r.n, r.ft)} className="rounded-xl bg-lime-gradient text-lime-foreground text-xs font-bold px-3 py-1.5">Забрать</button>
              ) : (
                <Lock className="size-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="h-12" />
    </PhoneFrame>
  );
}
