import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Plus, ArrowDownLeft, ArrowUpRight, Gift, Crown, Coins, Zap, Sparkles } from "lucide-react";
import { useTokens } from "@/lib/tokens";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Кошелёк — Frendly" }] }),
  component: WalletPage,
});

const packs = [
  { ft: 100, rub: 199, label: "Старт" },
  { ft: 300, rub: 499, label: "Хит", badge: "+10%" },
  { ft: 700, rub: 999, label: "Лучшее", badge: "+30%" },
  { ft: 2000, rub: 2490, label: "Большой", badge: "+60%" },
];

const spendIdeas = [
  { icon: Crown, title: "Plus подписка", sub: "от 250 FT / мес", to: "/paywall" as const },
  { icon: Zap, title: "Буст встречи", sub: "50 FT / 24ч", to: "/meetings" as const },
  { icon: Sparkles, title: "Super-like", sub: "5 FT / шт", to: "/dating" as const },
];

function WalletPage() {
  const { balance, tx, topUp } = useTokens();

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/settings" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Кошелёк</span>
        <button
          onClick={() => toast("История очищена локально не будет — это мок")}
          className="size-11 rounded-2xl glass border border-white/10 grid place-items-center text-xs"
        >
          ?
        </button>
      </header>

      <div className="px-5 mt-6">
        <div className="rounded-3xl p-5 bg-lime-gradient text-lime-foreground shadow-glow">
          <div className="flex items-center gap-1.5 text-xs opacity-80">
            <Coins className="size-3.5" /> Frendly Tokens
          </div>
          <p className="mt-1 text-4xl font-bold tabular-nums">{balance} <span className="text-xl font-semibold opacity-70">FT</span></p>
          <p className="mt-1 text-xs opacity-70">Используй для подписки, бустов и super-like</p>
        </div>
      </div>

      {/* Packs */}
      <section className="px-5 mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Пополнить</p>
        <div className="grid grid-cols-2 gap-2.5">
          {packs.map((p) => (
            <button
              key={p.ft}
              onClick={() => topUp(p.ft, `Пакет «${p.label}» · ${p.rub} ₽`)}
              className="rounded-2xl glass border border-white/10 p-3.5 text-left active:scale-[0.98] transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.label}</span>
                {p.badge && (
                  <span className="rounded-md bg-pink-gradient text-pink-foreground text-[9px] px-1.5 py-0.5 font-bold">{p.badge}</span>
                )}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {p.ft} <span className="text-xs text-muted-foreground font-medium">FT</span>
              </p>
              <div className="mt-2 rounded-xl bg-lime-gradient text-lime-foreground py-1.5 text-center text-xs font-bold inline-flex items-center justify-center gap-1 w-full">
                <Plus className="size-3" /> {p.rub} ₽
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Spend ideas */}
      <section className="px-5 mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">На что потратить</p>
        <div className="space-y-2">
          {spendIdeas.map(({ icon: Icon, title, sub, to }) => (
            <Link
              key={title}
              to={to}
              className="rounded-2xl glass border border-white/10 p-3 flex items-center gap-3"
            >
              <div className="size-10 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center">
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>

      <div className="px-5 mt-5 grid grid-cols-2 gap-2.5">
        <Link to="/paywall" className="rounded-2xl glass border border-white/10 p-3 flex items-center gap-2">
          <Crown className="size-5 text-pink" />
          <div>
            <p className="text-sm font-semibold">Plus</p>
            <p className="text-[11px] text-muted-foreground">Подписка</p>
          </div>
        </Link>
        <button
          onClick={() => toast.success("Промокод применён", { description: "+25 FT начислено" }) || topUp(25, "Промокод FRIEND25")}
          className="rounded-2xl glass border border-white/10 p-3 flex items-center gap-2"
        >
          <Gift className="size-5 text-lime" />
          <div className="text-left">
            <p className="text-sm font-semibold">Промокод</p>
            <p className="text-[11px] text-muted-foreground">Активировать</p>
          </div>
        </button>
      </div>

      <section className="px-5 mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">История</p>
        <div className="rounded-2xl glass border border-white/10 divide-y divide-white/5 overflow-hidden">
          {tx.map((row) => (
            <div key={row.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className={`size-9 rounded-xl grid place-items-center ${row.amount > 0 ? "bg-lime/20 text-lime" : "bg-pink/20 text-pink"}`}>
                {row.amount > 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{row.title}</p>
                <p className="text-[11px] text-muted-foreground">{row.when}</p>
              </div>
              <p className={`text-sm font-bold tabular-nums ${row.amount > 0 ? "text-lime" : "text-foreground"}`}>
                {row.amount > 0 ? "+" : ""}{row.amount} FT
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="h-16" />
    </PhoneFrame>
  );
}
