import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import {
  ChevronLeft, Ticket, Gift, Shield, Crown, Sparkles, Check, Info,
  Clock, Users, Smartphone, Coins, Share2, UserPlus, CalendarPlus,
  Star, Rocket, ListChecks, History, Trophy, ChevronRight, Lock,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/giveaways")({
  head: () => ({
    meta: [
      { title: "Frendly Drops — призы для активных" },
      {
        name: "description",
        content:
          "Frendly Drops — ежемесячные подарки для активных и верифицированных пользователей Frendly. Получай билеты за задания, без покупки шансов.",
      },
    ],
  }),
  component: GiveawaysPage,
});

// Demo "me" profile — pull from auth/profile store in real app
const ME = { isPlus: false, isVerified: true };

type Drop = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  prize: string;
  drawDate: string;
  daysLeft: number;
  participants: number;
  myTickets: number;
  accent: "lime" | "pink" | "lilac";
  icon: typeof Smartphone;
  requiresVerified: boolean;
  plusOnly?: boolean;
};

const DROPS: Drop[] = [
  {
    id: "june-iphone",
    badge: "Июньский Drop",
    title: "3 × iPhone 16 Pro",
    subtitle: "256 GB · цвет на выбор победителя",
    prize: "3 победителя",
    drawDate: "30 июня, 20:00",
    daysLeft: 12,
    participants: 8420,
    myTickets: 7,
    accent: "lime",
    icon: Smartphone,
    requiresVerified: true,
  },
  {
    id: "free-tokens",
    badge: "Free Drop",
    title: "100 × 500 токенов",
    subtitle: "Для всех верифицированных",
    prize: "100 победителей",
    drawDate: "23 июня",
    daysLeft: 5,
    participants: 12480,
    myTickets: 3,
    accent: "lilac",
    icon: Coins,
    requiresVerified: true,
  },
  {
    id: "plus-drop",
    badge: "Frendly+ Drop",
    title: "10 × Frendly+ на 3 месяца",
    subtitle: "Только для подписчиков",
    prize: "10 победителей",
    drawDate: "27 июня",
    daysLeft: 9,
    participants: 942,
    myTickets: 0,
    accent: "pink",
    icon: Crown,
    requiresVerified: true,
    plusOnly: true,
  },
  {
    id: "partner-drop",
    badge: "Partner Drop",
    title: "Ужины, билеты и сертификаты",
    subtitle: "От партнёров Frendly",
    prize: "25 победителей",
    drawDate: "29 июня",
    daysLeft: 11,
    participants: 3120,
    myTickets: 2,
    accent: "lime",
    icon: Gift,
    requiresVerified: true,
  },
];

type Task = {
  id: string;
  title: string;
  reward: number;
  cap?: string;
  done: boolean;
  icon: typeof Check;
  cta: string;
  to?: string;
};

const TASKS_INITIAL: Task[] = [
  { id: "verify", title: "Пройти верификацию", reward: 3, done: true, icon: Shield, cta: "Готово", to: "/verify" },
  { id: "daily", title: "Ежедневный вход", reward: 1, cap: "до 7 в месяц", done: false, icon: Sparkles, cta: "+1 сегодня" },
  { id: "host", title: "Провести встречу", reward: 1, cap: "до 5 в месяц · после подтверждения участников", done: false, icon: CalendarPlus, cta: "Создать", to: "/meetings/new" },
  { id: "attend", title: "Посетить встречу", reward: 2, cap: "до 10 в месяц · после подтверждения присутствия", done: false, icon: Users, cta: "К афише", to: "/posters" },
  { id: "ticket", title: "Купить билет через афишу", reward: 3, cap: "за каждую покупку", done: false, icon: Ticket, cta: "К афише", to: "/posters" },
  { id: "booking", title: "Забронировать столик на встрече", reward: 3, cap: "за каждую бронь", done: false, icon: ListChecks, cta: "К встречам", to: "/meetings" },
  { id: "rating", title: "Получить рейтинг 4.5+", reward: 1, cap: "до 5 в месяц", done: false, icon: Star, cta: "Профиль", to: "/profile" },
  { id: "invite", title: "Пригласить друга", reward: 3, cap: "за каждого", done: false, icon: UserPlus, cta: "Позвать", to: "/share" },
  { id: "repost", title: "Репост в Telegram / VK", reward: 1, cap: "до 3 в месяц", done: false, icon: Share2, cta: "Поделиться", to: "/share" },
  { id: "plus", title: "Оформить Frendly+", reward: 5, cap: "ежемесячно", done: false, icon: Crown, cta: "Подписка", to: "/paywall" },
  { id: "boost", title: "Продвинуть встречу", reward: 1, cap: "до 5 в месяц", done: false, icon: Rocket, cta: "Услуга", to: "/meetings" },
];

const HISTORY = [
  { id: 1, label: "Верификация профиля", delta: 3, date: "1 июня" },
  { id: 2, label: "Ежедневный вход", delta: 1, date: "2 июня" },
  { id: 3, label: "Приглашённый друг — Аня К.", delta: 3, date: "5 июня" },
  { id: 4, label: "Создание встречи «Кофе в Хамовниках»", delta: 1, date: "8 июня" },
  { id: 5, label: "Ежедневный вход", delta: 1, date: "9 июня" },
];

const WINNERS_PAST = [
  { name: "Анна", city: "Москва", prize: "iPhone 15", ticket: "A8F92" },
  { name: "Максим", city: "Санкт-Петербург", prize: "iPhone 15", ticket: "C19K2" },
  { name: "Илья", city: "Казань", prize: "iPhone 15", ticket: "P7L01" },
];

const MAX_TICKETS_PER_MONTH = 30;

function GiveawaysPage() {
  const [tasks, setTasks] = useState(TASKS_INITIAL);
  const totalTickets = useMemo(
    () => DROPS.reduce((sum, d) => sum + d.myTickets, 0),
    []
  );
  const earnedThisMonth = useMemo(
    () => HISTORY.reduce((s, h) => s + h.delta, 0),
    []
  );

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link
          to="/"
          aria-label="Назад"
          className="size-11 rounded-2xl glass border border-white/10 grid place-items-center"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Frendly Drops</span>
        <div className="h-11 px-3 rounded-2xl glass border border-white/10 inline-flex items-center gap-1.5 text-sm font-semibold">
          <Ticket className="size-4 text-lime" />
          <span className="tabular-nums">{totalTickets}</span>
        </div>
      </header>

      {/* Hero / intro */}
      <section className="px-5 mt-5">
        <div className="relative rounded-[28px] overflow-hidden border border-white/10 shadow-soft">
          <div className="absolute inset-0 bg-hero" />
          <div className="absolute -top-20 -right-16 size-56 rounded-full blur-3xl bg-lime-gradient opacity-40" />
          <div className="absolute -bottom-24 -left-16 size-56 rounded-full blur-3xl bg-pink-gradient opacity-30" />
          <div className="relative p-5">
            <div className="inline-flex items-center gap-1.5 rounded-full glass border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider">
              <Gift className="size-3 text-lime" /> сезон · июнь
            </div>
            <h1 className="mt-3 text-[26px] leading-tight font-semibold font-display">
              Подарки для активных пользователей
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-[300px]">
              Каждый месяц мы дарим призы тем, кто живёт в Frendly: ходит на
              встречи, приглашает друзей и держит профиль настоящим.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniStat label="Дропов" value="4" />
              <MiniStat label="Победителей" value="138" />
              <MiniStat label="Участие" value="бесплатно" />
            </div>
          </div>
        </div>
      </section>

      {/* Featured: June iPhone Drop */}
      <FeaturedDrop drop={DROPS[0]} />

      {/* Other drops */}
      <section className="px-5 mt-6">
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Активные дропы</h2>
          <Link to="/giveaways" className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Info className="size-3" /> прозрачный seed
          </Link>
        </div>
        <div className="space-y-3">
          {DROPS.slice(1).map((d) => (
            <DropCard key={d.id} drop={d} />
          ))}
        </div>
      </section>

      {/* Tasks */}
      <section className="px-5 mt-7">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold inline-flex items-center gap-2">
              <ListChecks className="size-5 text-lime" /> Задания месяца
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Получено {earnedThisMonth} из {MAX_TICKETS_PER_MONTH} билетов · обнуляется 1 июля
            </p>
          </div>
        </div>
        <div className="rounded-3xl glass border border-white/10 overflow-hidden divide-y divide-white/5">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onClaim={() => {
                if (t.done) return;
                setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: true } : x)));
                toast.success(`+${t.reward} билет${t.reward > 1 ? "а" : ""}`, {
                  description: t.title,
                });
              }}
            />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Максимум {MAX_TICKETS_PER_MONTH} билетов на пользователя в месяц. Билеты нельзя купить —
          их получают только за реальную активность.
        </p>
      </section>

      {/* Tickets history */}
      <section className="px-5 mt-7">
        <h2 className="text-lg font-semibold inline-flex items-center gap-2">
          <History className="size-5 text-lime" /> История билетов
        </h2>
        <div className="mt-3 rounded-3xl glass border border-white/10 divide-y divide-white/5">
          {HISTORY.map((h) => (
            <div key={h.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{h.label}</p>
                <p className="text-[11px] text-muted-foreground">{h.date}</p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${h.delta > 0 ? "text-lime" : "text-muted-foreground"}`}>
                {h.delta > 0 ? `+${h.delta}` : h.delta}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Past winners */}
      <section className="px-5 mt-7">
        <h2 className="text-lg font-semibold inline-flex items-center gap-2">
          <Trophy className="size-5 text-lime" /> Победители прошлого Drop
        </h2>
        <div className="mt-3 rounded-3xl glass border border-white/10 p-4 space-y-3">
          {WINNERS_PAST.map((w, i) => (
            <div key={w.ticket} className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center font-bold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{w.name}, {w.city}</p>
                <p className="text-[11px] text-muted-foreground">{w.prize} · билет #{w.ticket}</p>
              </div>
              <Check className="size-4 text-lime shrink-0" />
            </div>
          ))}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Розыгрыш по seed-хэшу · публичная запись</span>
            <button className="text-lime font-semibold inline-flex items-center gap-1">
              Смотреть <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      </section>

      <p className="px-5 mt-5 text-[10px] text-muted-foreground leading-relaxed">
        Frendly Drops — программа лояльности компании Frendly. Участие
        бесплатное, билеты начисляются за активность. Призы вручаются
        победителю после подтверждения личности. Организатор вправе заменить
        приз на аналогичный по стоимости. Полные правила доступны в разделе
        «Документы».
      </p>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl glass border border-white/10 px-2 py-2.5 text-center">
      <p className="font-display text-base font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function FeaturedDrop({ drop }: { drop: Drop }) {
  const eligible = !drop.requiresVerified || ME.isVerified;
  return (
    <section className="px-5 mt-5">
      <div className="relative rounded-[28px] overflow-hidden border border-white/10 shadow-glow">
        <div className="absolute inset-0 bg-lime-gradient" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-80 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90%] h-12 bg-black/40 blur-2xl rounded-full" />

        <div className="relative p-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 text-white px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold backdrop-blur">
              <Gift className="size-3" /> {drop.badge}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-lime-foreground/90">
              <Clock className="size-3" /> до розыгрыша {drop.daysLeft} дней
            </span>
          </div>

          {/* iPhone illustration */}
          <div className="mt-2 h-32 grid place-items-center relative">
            <PhonesStack className="w-[80%] h-full text-lime-foreground/95" />
          </div>

          <h3 className="mt-1 font-display text-[22px] font-semibold leading-tight text-lime-foreground">
            {drop.title}
          </h3>
          <p className="text-xs text-lime-foreground/80">{drop.subtitle} · {drop.prize}</p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-lime-foreground/90">
            <div className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {drop.participants.toLocaleString("ru-RU")} участников
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {drop.drawDate}
            </div>
          </div>
        </div>

        {/* My tickets panel */}
        <div className="relative px-4 pb-4">
          <div className="rounded-2xl bg-background/85 backdrop-blur border border-white/10 p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Твои билеты</p>
              <p className="text-lg font-bold tabular-nums inline-flex items-center gap-1.5">
                <Ticket className="size-4 text-lime" />
                {drop.myTickets}
                <span className="text-xs text-muted-foreground font-medium">
                  / {MAX_TICKETS_PER_MONTH} макс
                </span>
              </p>
              {!eligible && (
                <p className="text-[10px] text-pink font-semibold mt-0.5 inline-flex items-center gap-1">
                  <Lock className="size-3" /> Нужна верификация
                </p>
              )}
            </div>
            <TasksSheet />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/80">
            <Shield className="size-3" /> Бесплатно для верифицированных · 18+
          </div>
        </div>
      </div>
    </section>
  );
}

function DropCard({ drop }: { drop: Drop }) {
  const Icon = drop.icon;
  const eligible =
    (!drop.requiresVerified || ME.isVerified) && (!drop.plusOnly || ME.isPlus);
  const accent = useMemo(() => {
    if (drop.accent === "pink") return { bg: "bg-pink-gradient", text: "text-pink-foreground", chip: "bg-pink/20 text-pink" };
    if (drop.accent === "lilac") return { bg: "bg-lilac", text: "text-lilac-foreground", chip: "bg-lilac/30 text-lilac" };
    return { bg: "bg-lime-gradient", text: "text-lime-foreground", chip: "bg-lime/20 text-lime" };
  }, [drop.accent]);

  return (
    <div className="rounded-3xl glass border border-white/10 overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className={`relative size-20 shrink-0 rounded-2xl ${accent.bg} ${accent.text} grid place-items-center overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
          <Icon className="relative size-9" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md ${accent.chip}`}>
              {drop.badge}
            </span>
            {drop.plusOnly && (
              <span className="text-[10px] inline-flex items-center gap-1 text-pink font-semibold">
                <Crown className="size-3" /> Plus
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto inline-flex items-center gap-1">
              <Clock className="size-3" /> {drop.drawDate}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold leading-tight truncate">{drop.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{drop.subtitle}</p>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Users className="size-3" /> {drop.participants.toLocaleString("ru-RU")}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-lime">
              <Ticket className="size-3" /> твоих: {drop.myTickets}
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 flex items-center gap-2">
        {!eligible && (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Lock className="size-3" /> {drop.plusOnly ? "Только Frendly+" : "Нужна верификация"}
          </span>
        )}
        <TasksSheet className="ml-auto" label="Получить билеты" />
      </div>
    </div>
  );
}

function TasksSheet({ className = "", label = "Получить билеты" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={
            "h-10 px-4 rounded-xl bg-lime-gradient text-lime-foreground font-bold text-sm shadow-glow active:scale-[0.98] transition inline-flex items-center gap-1.5 " +
            className
          }
        >
          <Ticket className="size-4" />
          {label}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-background border-white/10 p-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-left font-display text-xl inline-flex items-center gap-2">
            <ListChecks className="size-5 text-lime" /> Как получить больше билетов
          </SheetTitle>
        </SheetHeader>
        <div className="px-5 pb-6 pt-3">
          <p className="text-sm text-muted-foreground">
            Билеты нельзя купить. Их получают за реальную активность в Frendly.
          </p>
          <div className="mt-4 rounded-2xl glass border border-white/10 divide-y divide-white/5">
            {TASKS_INITIAL.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`size-9 rounded-xl grid place-items-center shrink-0 ${t.done ? "bg-lime/20 text-lime" : "bg-surface-2"}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{t.title}</p>
                    {t.cap && <p className="text-[10px] text-muted-foreground">{t.cap}</p>}
                  </div>
                  <span className="text-sm font-bold text-lime tabular-nums">+{t.reward}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mt-4 w-full h-12 rounded-2xl bg-lime-gradient text-lime-foreground font-bold text-sm shadow-glow"
          >
            Понятно
          </button>
          <p className="mt-3 text-[10px] text-muted-foreground text-center">
            Максимум {MAX_TICKETS_PER_MONTH} билетов в месяц. Полные правила — в разделе «Документы».
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TaskRow({ task, onClaim }: { task: Task; onClaim: () => void }) {
  const Icon = task.icon;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`size-10 rounded-xl grid place-items-center shrink-0 ${task.done ? "bg-lime/20 text-lime" : "bg-surface-2"}`}>
        {task.done ? <Check className="size-5" /> : <Icon className="size-5" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{task.title}</p>
        <p className="text-[11px] text-muted-foreground">
          +{task.reward} билет{task.reward > 1 ? "а" : ""}{task.cap ? ` · ${task.cap}` : ""}
        </p>
      </div>
      {task.done ? (
        <span className="text-[11px] font-semibold text-lime inline-flex items-center gap-1">
          <Check className="size-3.5" /> готово
        </span>
      ) : task.to ? (
        <Link
          to={task.to}
          className="h-9 px-3 rounded-xl bg-surface-2 text-foreground text-xs font-semibold inline-flex items-center gap-1"
        >
          {task.cta}
        </Link>
      ) : (
        <button
          onClick={onClaim}
          className="h-9 px-3 rounded-xl bg-lime-gradient text-lime-foreground text-xs font-bold inline-flex items-center gap-1"
        >
          {task.cta}
        </button>
      )}
    </div>
  );
}

function PhonesStack({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 120" className={className} fill="none">
      <defs>
        <linearGradient id="phoneFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      {[
        { x: 30, r: -12 },
        { x: 100, r: 0 },
        { x: 170, r: 12 },
      ].map((p, i) => (
        <g key={i} transform={`translate(${p.x} 14) rotate(${p.r} 20 46)`}>
          <rect x="0" y="0" width="40" height="92" rx="10" fill="url(#phoneFace)" />
          <rect x="3" y="3" width="34" height="86" rx="7" fill="rgba(0,0,0,0.85)" />
          <rect x="14" y="6" width="12" height="3" rx="1.5" fill="rgba(255,255,255,0.2)" />
          <rect x="6" y="14" width="28" height="60" rx="4" fill="rgba(255,255,255,0.08)" />
          <rect x="11" y="80" width="18" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
        </g>
      ))}
    </svg>
  );
}
