import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/dateasy/TopBar";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { X, Heart, Star, MapPin, Briefcase, Music2, Coffee, Sparkles, Coins, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTokens } from "@/lib/tokens";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

export const Route = createFileRoute("/dating")({
  head: () => ({
    meta: [
      { title: "Дейтинг — Frendly" },
      { name: "description", content: "Свайпай, мэтчись и зови на встречу — дейтинг по-новому." },
    ],
  }),
  component: DatingPage,
});

const interests = [
  { label: "Speciality coffee", icon: Coffee },
  { label: "Винил", icon: Music2 },
  { label: "Архитектура", icon: Sparkles },
];

const deck = [
  { name: "Нина", age: 26, img: p1, match: 94, job: "Product designer" },
  { name: "Марк", age: 28, img: p2, match: 88, job: "Music producer" },
  { name: "Лия", age: 24, img: p3, match: 91, job: "Барист, Brew Lab" },
];

function DatingPage() {
  const { balance, spend } = useTokens();
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const card = deck[idx % deck.length];

  const next = () => setIdx((i) => i + 1);

  const onPass = () => { toast(`Пропустил · ${card.name}`); next(); };
  const onLike = () => {
    toast.success(`Лайк · ${card.name}`, { description: "Если совпадёт — будет мэтч" });
    if (Math.random() > 0.5) setTimeout(() => navigate({ to: "/match" }), 350);
    else next();
  };
  const onSuper = () => {
    if (spend(5, `Super-like · ${card.name}`)) {
      setTimeout(() => navigate({ to: "/match" }), 400);
    }
  };
  return (
    <PhoneFrame>
      <TopBar />

      <div className="px-5 pt-6 flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">12 рядом · в радиусе 2 км</p>
          <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold">
            Свайпай <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3 pb-1 inline-block leading-[1.1]">с умом</span>
          </h1>
        </div>
        <Link to="/dating/filter" aria-label="Фильтры" className="relative size-11 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
          <SlidersHorizontal className="size-5" />
          <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-pink border-2 border-background" />
        </Link>
      </div>

      {/* Card stack */}
      <div className="px-5 mt-6 relative">
        <div className="absolute inset-x-8 top-4 h-[480px] rounded-[32px] bg-surface-2/60 border border-white/5 scale-[0.96] -z-10" />
        <div className="absolute inset-x-12 top-8 h-[480px] rounded-[32px] bg-surface/60 border border-white/5 scale-[0.92] -z-20" />

        <article className="relative rounded-[32px] overflow-hidden border border-white/10 shadow-soft h-[520px]">
          <img src={card.img} alt={card.name} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="rounded-full glass border border-white/15 px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-lime" /> онлайн
            </span>
            <span className="rounded-full bg-lime-gradient text-lime-foreground px-3 py-1.5 text-xs font-bold">
              {card.match}% мэтч
            </span>
          </div>

          <div className="absolute left-4 right-4 bottom-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-semibold">{card.name}, {card.age}</h2>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3" />1.2 км</span>
                  <span className="inline-flex items-center gap-1"><Briefcase className="size-3" />{card.job}</span>
                </div>
              </div>
              <Link to="/u/$userId" params={{ userId: card.name.toLowerCase() }} className="rounded-2xl bg-foreground text-background px-3 py-2 text-xs font-semibold">
                Профиль
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {interests.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full glass border border-white/15 px-3 py-1.5 text-xs"
                >
                  <Icon className="size-3.5 text-lime" />
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-3 rounded-2xl glass border border-white/10 p-3 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-pink-gradient grid place-items-center text-pink-foreground font-bold">
                ☕
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Идёт на встречу</p>
                <p className="text-sm font-semibold truncate">Speciality coffee · Сегодня 19:30</p>
              </div>
              <button
                onClick={() => toast.success("Заявка отправлена", { description: "Хост получит уведомление" })}
                className="rounded-xl bg-lime-gradient text-lime-foreground text-xs font-bold px-3 py-2 shadow-glow"
              >
                +Я
              </button>
            </div>
          </div>
        </article>

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <button onClick={onPass} aria-label="Пропустить" className="size-14 rounded-full glass border border-white/10 grid place-items-center text-muted-foreground hover:text-foreground active:scale-95 transition">
            <X className="size-6" />
          </button>
          <button onClick={onSuper} aria-label="Super-like" className="relative size-12 rounded-full bg-lilac text-lilac-foreground grid place-items-center shadow-soft active:scale-95 transition">
            <Star className="size-5" />
            <span className="absolute -top-1 -right-1 rounded-full bg-foreground text-background text-[9px] font-bold px-1.5 py-0.5 inline-flex items-center gap-0.5">
              <Coins className="size-2.5" />5
            </span>
          </button>
          <button onClick={onLike} aria-label="Лайк" className="size-16 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow active:scale-95 transition">
            <Heart className="size-7 fill-current" />
          </button>
          <Link to="/ai-builder" aria-label="AI" className="size-14 rounded-full glass border border-white/10 grid place-items-center">
            <Sparkles className="size-5 text-lime" />
          </Link>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          Баланс: <span className="text-foreground font-semibold">{balance} FT</span> · <Link to="/wallet" className="text-lime underline">пополнить</Link>
        </p>
      </div>

      <section className="px-5 mt-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">Следующие в подборке</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Появятся после текущей карточки</p>
          </div>
          <button onClick={() => toast("Подборка обновлена")} className="text-sm text-muted-foreground">Обновить</button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[p2, p3, p1].map((src, i) => (
            <Link
              key={i}
              to="/u/$userId"
              params={{ userId: ["mark","liya","eva"][i] }}
              className="relative rounded-2xl overflow-hidden h-32 border border-white/10 block"
            >
              <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-semibold truncate">{["Марк, 28","Лия, 24","Ева, 27"][i]}</p>
                <p className="text-[10px] text-muted-foreground">{[88,91,82][i]}% мэтч</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
