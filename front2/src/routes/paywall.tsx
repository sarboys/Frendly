import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Crown, X, Check, Sparkles, Heart, Zap, Eye, Coins } from "lucide-react";
import { useState } from "react";
import { useTokens } from "@/lib/tokens";

export const Route = createFileRoute("/paywall")({
  head: () => ({ meta: [{ title: "Frendly Plus" }] }),
  component: Paywall,
});

const perks = [
  { icon: Heart, label: "Безлимит лайков и свайпов" },
  { icon: Eye, label: "Кто тебя лайкнул" },
  { icon: Zap, label: "5 буст-вечеров в месяц" },
  { icon: Sparkles, label: "AI-маршруты без лимитов" },
];

const plans = [
  { id: "m", title: "1 месяц", ft: 250, per: "в месяц" },
  { id: "q", title: "3 месяца", ft: 600, per: "200 FT/мес", badge: "−20%" },
  { id: "y", title: "12 месяцев", ft: 1800, per: "150 FT/мес", badge: "Лучшее" },
];

function Paywall() {
  const [sel, setSel] = useState("q");
  const { balance, spend } = useTokens();
  const navigate = useNavigate();
  const chosen = plans.find((p) => p.id === sel)!;
  const enough = balance >= chosen.ft;

  return (
    <div className="mx-auto w-full max-w-[420px] min-h-screen bg-hero relative overflow-hidden">
      <div className="absolute -top-20 -right-16 size-72 rounded-full blur-3xl opacity-40 bg-pink-gradient" />
      <div className="absolute -bottom-20 -left-16 size-72 rounded-full blur-3xl opacity-30 bg-lime-gradient" />

      <div className="relative z-10 min-h-screen flex flex-col px-5 pt-4 pb-6">
        <div className="flex justify-between items-center">
          <Link to="/wallet" className="rounded-full glass border border-white/10 px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold">
            <Coins className="size-3.5 text-lime" /> {balance} FT
          </Link>
          <Link to="/profile" className="size-10 rounded-2xl glass border border-white/10 grid place-items-center">
            <X className="size-5" />
          </Link>
        </div>

        <div className="mt-2 flex flex-col items-center text-center">
          <div className="size-16 rounded-3xl bg-pink-gradient grid place-items-center shadow-glow">
            <Crown className="size-7 text-pink-foreground" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold">Frendly <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3">Plus</span></h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">Больше встреч, лайков и приоритет в радаре</p>
        </div>

        <div className="mt-6 rounded-3xl glass border border-white/10 p-4 space-y-3">
          {perks.map(({icon: Icon, label}) => (
            <div key={label} className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center">
                <Icon className="size-4" />
              </span>
              <span className="text-sm flex-1">{label}</span>
              <Check className="size-4 text-lime" />
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          {plans.map((p) => {
            const on = sel === p.id;
            return (
              <button key={p.id} onClick={()=>setSel(p.id)}
                className={`w-full rounded-2xl border p-4 flex items-center gap-3 text-left transition ${on ? "border-lime bg-lime/10 shadow-glow" : "border-white/10 glass"}`}>
                <span className={`size-5 rounded-full border-2 ${on ? "border-lime bg-lime" : "border-white/30"}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold inline-flex items-center gap-2">
                    {p.title}
                    {p.badge && <span className="rounded-md bg-pink-gradient text-pink-foreground text-[10px] px-1.5 py-0.5 font-bold">{p.badge}</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{p.per}</p>
                </div>
                <p className="text-base font-bold tabular-nums inline-flex items-center gap-1">
                  {p.ft} <span className="text-xs text-muted-foreground">FT</span>
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-auto pt-4">
          {enough ? (
            <button
              onClick={() => {
                if (spend(chosen.ft, `Plus · ${chosen.title}`)) {
                  setTimeout(() => navigate({ to: "/profile" }), 500);
                }
              }}
              className="w-full rounded-2xl bg-lime-gradient text-lime-foreground py-4 font-bold shadow-glow active:scale-[0.99] transition"
            >
              Активировать за {chosen.ft} FT
            </button>
          ) : (
            <Link
              to="/wallet"
              className="w-full rounded-2xl bg-pink-gradient text-pink-foreground py-4 font-bold shadow-glow grid place-items-center"
            >
              Не хватает {chosen.ft - balance} FT · Пополнить
            </Link>
          )}
          <p className="text-center text-[10px] text-muted-foreground mt-3">
            Списание токенов · отмена в настройках
          </p>
        </div>
      </div>
    </div>
  );
}
