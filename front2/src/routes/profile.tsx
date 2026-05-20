import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import {
  Settings, Share2, MapPin, Star, Coffee, Music2, Palette, Footprints,
  Camera, Verified, Crown, ChevronRight, Wallet, LayoutDashboard, Trophy,
} from "lucide-react";
import me from "@/assets/person-3.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import evRoof from "@/assets/event-rooftop.jpg";
import evArt from "@/assets/event-art.jpg";
import evCoffee from "@/assets/event-coffee.jpg";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Профиль — Dateasy" },
      { name: "description", content: "Твой профиль: интересы, встречи и достижения." },
    ],
  }),
  component: ProfilePage,
});

const interests = [
  { label: "Speciality coffee", icon: Coffee },
  { label: "Винил", icon: Music2 },
  { label: "Галереи", icon: Palette },
  { label: "Длинные прогулки", icon: Footprints },
];

const gallery = [me, p1, p2, evArt, evCoffee, evRoof];

function ProfilePage() {
  return (
    <PhoneFrame>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to="/share" aria-label="Поделиться" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <Share2 className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Профиль</span>
        <Link to="/settings" aria-label="Настройки" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <Settings className="size-5" />
        </Link>
      </div>

      {/* Avatar */}
      <div className="px-5 mt-6 flex flex-col items-center text-center">
        <div className="relative">
          <span className="block p-[3px] rounded-full bg-lime-gradient shadow-glow">
            <img src={me} alt="Алекс" className="size-28 rounded-full object-cover ring-4 ring-background" />
          </span>
          <Link to="/profile/edit" aria-label="Изменить фото" className="absolute -bottom-1 -right-1 size-9 rounded-full bg-foreground text-background grid place-items-center border-4 border-background">
            <Camera className="size-4" />
          </Link>
        </div>
        <h1 className="mt-4 text-2xl font-semibold inline-flex items-center gap-1.5">
          Алекс, 27
          <Verified className="size-5 text-lime" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-1">
          <MapPin className="size-3.5" /> Москва · в 1.2 км от тебя
        </p>
        <p className="mt-3 text-sm max-w-[280px] text-muted-foreground">
          Дизайнер. Собираю встречи там, где играет хорошая музыка и варят
          честный кофе.
        </p>
      </div>

      {/* Stats */}
      <div className="px-5 mt-6">
        <div className="rounded-3xl glass border border-white/10 p-1 grid grid-cols-3 divide-x divide-white/10 overflow-hidden">
          <Stat value="12" label="Встреч" accent="lime" />
          <Stat value="48" label="Мэтчей" accent="pink" />
          <Stat value="4.9" label="Рейтинг" accent="lilac" icon={<Star className="size-3.5 fill-current" />} />
        </div>
      </div>

      {/* Premium */}
      <Link to="/paywall" className="mx-5 mt-5 rounded-3xl p-4 bg-pink-gradient text-pink-foreground flex items-center gap-3 shadow-soft">
        <div className="size-11 rounded-2xl bg-background/20 grid place-items-center">
          <Crown className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Frendly Plus</p>
          <p className="text-xs opacity-80">Безлимит свайпов, приоритет в радаре</p>
        </div>
        <span className="rounded-full bg-background/20 px-3 py-1.5 text-xs font-semibold">Открыть</span>
      </Link>

      {/* Verification */}
      <Link to="/verify" className="mx-5 mt-3 rounded-3xl p-4 glass border border-lime/30 flex items-center gap-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-lime-gradient opacity-10" />
        <div className="relative size-11 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
          <Verified className="size-5" />
        </div>
        <div className="relative flex-1">
          <p className="text-sm font-semibold inline-flex items-center gap-1.5">
            Пройти верификацию
            <span className="rounded-full bg-lime/20 text-lime text-[10px] font-bold px-1.5 py-0.5">+ галочка</span>
          </p>
          <p className="text-xs text-muted-foreground">Селфи + документ · 1 минута</p>
        </div>
        <ChevronRight className="relative size-4 text-muted-foreground" />
      </Link>

      {/* Wallet shortcut */}
      <Link to="/wallet" className="mx-5 mt-3 rounded-3xl p-4 glass border border-white/10 flex items-center gap-3">
        <div className="size-11 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center">
          <Wallet className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Кошелёк токенов</p>
          <p className="text-xs text-muted-foreground">Пополнение, история, бусты</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      {/* Host dashboard */}
      <Link to="/host" className="mx-5 mt-3 rounded-3xl p-4 glass border border-white/10 flex items-center gap-3">
        <div className="size-11 rounded-2xl bg-lilac/30 text-lilac grid place-items-center">
          <LayoutDashboard className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold inline-flex items-center gap-1.5">
            Host dashboard
            <span className="rounded-full bg-pink/20 text-pink text-[10px] font-bold px-1.5 py-0.5">2 заявки</span>
          </p>
          <p className="text-xs text-muted-foreground">Управление встречами и заявками</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      {/* Giveaways */}
      <Link to="/giveaways" className="mx-5 mt-3 rounded-3xl p-4 glass border border-white/10 flex items-center gap-3">
        <div className="size-11 rounded-2xl bg-pink-gradient text-pink-foreground grid place-items-center">
          <Trophy className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold inline-flex items-center gap-1.5">
            Розыгрыши месяца
            <span className="rounded-full bg-lime/20 text-lime text-[10px] font-bold px-1.5 py-0.5">авто · iPhone</span>
          </p>
          <p className="text-xs text-muted-foreground">Билеты, история, победители</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      {/* Interests */}
      <section className="px-5 mt-6">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Интересы</h2>
          <button className="text-sm text-muted-foreground">Изменить</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {interests.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full glass border border-white/10 px-3 py-1.5 text-sm"
            >
              <Icon className="size-3.5 text-lime" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Gallery */}
      <section className="px-5 mt-6">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Галерея</h2>
          <Link to="/profile/gallery" className="text-sm text-muted-foreground inline-flex items-center gap-1">Все <ChevronRight className="size-3.5" /></Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {gallery.map((g, i) => (
            <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10">
              <img src={g} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* My meetings */}
      <section className="px-5 mt-6">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Мои встречи</h2>
          <Link to="/profile/history" className="text-sm text-muted-foreground inline-flex items-center gap-1">История <ChevronRight className="size-3.5" /></Link>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { title: "Винил-вечер на крыше", time: "Пт · 21:00", role: "Иду" },
            { title: "Art night в галерее", time: "Сб · 18:00", role: "Хост" },
          ].map((m) => (
            <div key={m.title} className="rounded-2xl glass border border-white/10 p-3 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center font-bold">
                {m.role === "Хост" ? "★" : "→"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.title}</p>
                <p className="text-[11px] text-muted-foreground">{m.time} · {m.role}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </section>


      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}

function Stat({ value, label, accent, icon }: { value: string; label: string; accent: "lime" | "pink" | "lilac"; icon?: React.ReactNode }) {
  const dot = {
    lime: "bg-lime",
    pink: "bg-pink",
    lilac: "bg-lilac",
  } as const;
  const text = {
    lime: "text-lime",
    pink: "text-pink",
    lilac: "text-lilac",
  } as const;
  return (
    <div className="px-2 py-3 text-center">
      <p className="font-display text-[26px] font-semibold leading-none inline-flex items-center gap-1">
        {icon && <span className={text[accent]}>{icon}</span>}
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${dot[accent]}`} />
        {label}
      </p>
    </div>
  );
}
