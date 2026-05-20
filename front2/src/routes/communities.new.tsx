import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import {
  ArrowLeft, Image as ImageIcon, Globe, Lock, Users,
  Coffee, Music2, Dumbbell, Palette, Wine, Footprints, Camera, Book,
} from "lucide-react";

export const Route = createFileRoute("/communities/new")({
  head: () => ({
    meta: [
      { title: "Новое сообщество — Dateasy" },
      { name: "description", content: "Создай своё сообщество за минуту." },
    ],
  }),
  component: NewCommunityPage,
});

const tags = [
  { label: "Кофе", icon: Coffee },
  { label: "Музыка", icon: Music2 },
  { label: "Спорт", icon: Dumbbell },
  { label: "Арт", icon: Palette },
  { label: "Вино", icon: Wine },
  { label: "Прогулки", icon: Footprints },
  { label: "Фото", icon: Camera },
  { label: "Книги", icon: Book },
];

function NewCommunityPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [active, setActive] = useState<string[]>(["Кофе"]);

  const toggle = (t: string) =>
    setActive((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));

  const onCreate = () => {
    if (!name.trim()) { toast.error("Назови сообщество"); return; }
    toast.success(`«${name}» создано`, { description: "Можно звать первых участников" });
    setTimeout(() => navigate({ to: "/communities" }), 600);
  };

  const invite = () => toast.success("Ссылка-приглашение скопирована");

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to="/communities" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Новое сообщество</span>
        <div className="size-11" />
      </div>

      {/* Cover */}
      <section className="px-5 mt-5">
        <button onClick={() => toast("Загрузка обложки скоро")} className="w-full h-44 rounded-3xl glass border border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="size-6" />
          <span className="text-sm">Добавить обложку</span>
        </button>
      </section>

      {/* Name */}
      <section className="px-5 mt-5 space-y-3">
        <div className="rounded-2xl glass border border-white/10 p-4">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Название
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wine & vinyl Patriki"
            className="mt-1 w-full bg-transparent outline-none text-lg font-semibold placeholder:text-foreground/30"
          />
        </div>
        <div className="rounded-2xl glass border border-white/10 p-4">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            О чём
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Собираемся слушать винил, пить natural wine и встречаться по пятницам..."
            className="mt-1 w-full bg-transparent outline-none text-sm resize-none placeholder:text-foreground/40"
          />
        </div>
      </section>

      {/* Tags */}
      <section className="px-5 mt-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Темы</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map(({ label, icon: Icon }) => {
            const on = active.includes(label);
            return (
              <button
                key={label}
                onClick={() => toggle(label)}
                className={
                  "rounded-full px-3 py-2 text-xs font-medium border inline-flex items-center gap-1.5 " +
                  (on
                    ? "bg-lime text-lime-foreground border-lime"
                    : "glass border-white/10 text-foreground/80")
                }
              >
                <Icon className="size-3.5" /> {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Visibility */}
      <section className="px-5 mt-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Видимость</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            { id: "public", icon: Globe, title: "Открытое", desc: "Любой может вступить" },
            { id: "private", icon: Lock, title: "Закрытое", desc: "По заявкам" },
          ] as const).map((v) => {
            const on = visibility === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setVisibility(v.id)}
                className={
                  "rounded-2xl p-3 text-left border transition " +
                  (on
                    ? "bg-lilac text-lilac-foreground border-lilac"
                    : "glass border-white/10")
                }
              >
                <v.icon className="size-5" />
                <div className="mt-2 text-sm font-semibold">{v.title}</div>
                <div className="text-[11px] opacity-80">{v.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Invite */}
      <section className="px-5 mt-5">
        <div className="rounded-2xl glass border border-white/10 p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-pink/30 grid place-items-center">
            <Users className="size-5 text-pink" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Пригласить друзей</div>
            <div className="text-xs text-muted-foreground">Минимум 3 человека, чтобы запустить</div>
          </div>
          <button onClick={invite} className="text-xs rounded-full bg-foreground text-background px-3 py-1.5 font-semibold">+ Позвать</button>
        </div>
      </section>

      <div className="px-5 mt-8">
        <button onClick={onCreate} className="w-full h-14 rounded-2xl bg-lime-gradient text-lime-foreground font-semibold shadow-glow">
          Создать сообщество
        </button>
      </div>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
