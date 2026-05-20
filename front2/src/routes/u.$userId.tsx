import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, MoreHorizontal, MapPin, Verified, Heart, MessageCircle, Sparkles, Star, Coffee, Music2, Palette, Flag, Crown, UserPlus, UserCheck, Bell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import ev from "@/assets/event-rooftop.jpg";

export const Route = createFileRoute("/u/$userId")({
  head: () => ({ meta: [{ title: "Профиль — Frendly" }] }),
  component: PublicProfile,
});

const tags = [
  { label: "Speciality coffee", icon: Coffee },
  { label: "Винил", icon: Music2 },
  { label: "Галереи", icon: Palette },
];

function PublicProfile() {
  const [following, setFollowing] = useState(false);
  const [notify, setNotify] = useState(false);

  const toggleFollow = () => {
    setFollowing((f) => !f);
    toast.success(following ? "Отписался" : "Подписка оформлена", {
      description: following ? undefined : "Будешь видеть встречи и активность",
    });
  };

  return (
    <PhoneFrame>
      <div className="relative">
        <img src={p1} alt="" className="h-[420px] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background" />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link to="/dating" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
            <ChevronLeft className="size-5" />
          </Link>
          <button onClick={() => toast("Меню профиля скоро")} className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
            <MoreHorizontal className="size-5" />
          </button>
        </div>
        <div className="absolute bottom-4 left-5 right-5">
          <div className="flex items-end justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold inline-flex items-center gap-1.5 flex-wrap">
                Нина, 26
                <span className="inline-flex items-center gap-1 rounded-full bg-lime-gradient text-lime-foreground px-2 py-0.5 text-[10px] font-bold shadow-glow">
                  <Verified className="size-3" /> Verified
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-gradient text-pink-foreground px-2 py-0.5 text-[10px] font-bold shadow-glow">
                  <Crown className="size-3" /> Frendly+
                </span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> 1.2 км · онлайн
              </p>
            </div>
            <span className="rounded-full bg-lime-gradient text-lime-foreground px-3 py-1.5 text-xs font-bold shadow-glow shrink-0">94%</span>
          </div>
        </div>
      </div>

      {/* Follow / Subscribe */}
      <div className="px-5 mt-5 flex items-center gap-2">
        <button
          onClick={toggleFollow}
          className={
            "flex-1 rounded-2xl py-3 font-bold inline-flex items-center justify-center gap-1.5 transition " +
            (following
              ? "glass border border-lime/40 text-lime"
              : "bg-lime-gradient text-lime-foreground shadow-glow")
          }
        >
          {following ? (
            <><UserCheck className="size-4" /> Вы подписаны</>
          ) : (
            <><UserPlus className="size-4" /> Подписаться</>
          )}
        </button>
        {following && (
          <button
            onClick={() => { setNotify((n) => !n); toast(notify ? "Уведомления выключены" : "Уведомления включены"); }}
            className={"size-12 rounded-2xl border grid place-items-center " + (notify ? "bg-lime text-lime-foreground border-lime" : "glass border-white/10")}
            aria-label="Уведомления"
          >
            <Bell className="size-5" />
          </button>
        )}
        <div className="text-right">
          <p className="font-display text-lg font-bold leading-none">1.2k</p>
          <p className="text-[10px] text-muted-foreground">подписчиков</p>
        </div>
      </div>

      <div className="px-5 mt-4">
        <p className="text-sm text-muted-foreground">
          Дизайнер из Москвы. Люблю медленные утра, спешелти и винил. Ищу единомышленников на вечерние прогулки.
        </p>
      </div>

      <section className="px-5 mt-5">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Интересы</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map(({label, icon: Icon}) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full glass border border-white/10 px-3 py-1.5 text-sm">
              <Icon className="size-3.5 text-lime" /> {label}
            </span>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Галерея</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[p1, p2, ev, p2, p1, ev].map((g, i) => (
            <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10">
              <img src={g} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Идёт на встречу</h2>
        <div className="mt-2 rounded-2xl overflow-hidden border border-white/10 relative h-32">
          <img src={ev} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Сегодня · 19:30</p>
              <p className="text-sm font-semibold">Винил-вечер на крыше</p>
            </div>
            <button onClick={() => toast.success("Ты в списке встречи")} className="rounded-xl bg-lime-gradient text-lime-foreground px-3 py-1.5 text-xs font-bold">+Я</button>
          </div>
        </div>
      </section>

      <section className="px-5 mt-6 grid grid-cols-3 gap-2.5">
        {[
          { v: "32", l: "Встреч" },
          { v: "4.9", l: "Рейтинг", icon: <Star className="size-3 fill-current" /> },
          { v: "2 года", l: "Во Frendly" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl glass border border-white/10 p-3">
            <p className="text-xl font-bold inline-flex items-center gap-1">{s.icon}{s.v}</p>
            <p className="text-[11px] text-muted-foreground">{s.l}</p>
          </div>
        ))}
      </section>

      <Link to="/report" className="mx-5 mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Flag className="size-3.5" /> Пожаловаться или заблокировать
      </Link>

      <div className="sticky bottom-0 mt-8 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <div className="flex items-center gap-3">
          <Link to="/ai-builder" className="size-14 rounded-2xl glass border border-white/10 grid place-items-center">
            <Sparkles className="size-5 text-lime" />
          </Link>
          <Link to="/chats" className="size-14 rounded-2xl glass border border-white/10 grid place-items-center">
            <MessageCircle className="size-5" />
          </Link>
          <Link to="/match" className="flex-1 rounded-2xl bg-lime-gradient text-lime-foreground py-4 font-bold inline-flex items-center justify-center gap-2 shadow-glow">
            <Heart className="size-5 fill-current" /> Лайк
          </Link>
        </div>
      </div>
    </PhoneFrame>
  );
}
