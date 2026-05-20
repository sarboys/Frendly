import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, MapPin, Bell, Users as UsersIcon, Cake, Mail, Phone, Camera, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

type Step = {
  key: string;
  title: string;
  subtitle?: string;
  render: () => React.ReactNode;
};

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-2.5 rounded-full text-sm font-medium border transition " +
        (active
          ? "bg-lime-gradient text-lime-foreground border-transparent shadow-glow"
          : "glass border-white/10 text-foreground hover:bg-white/5")
      }
    >
      {children}
    </button>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [gender, setGender] = useState<"М" | "Ж" | null>(null);
  const [city, setCity] = useState("Москва");
  const [interests, setInterests] = useState<string[]>([]);
  const [vibe, setVibe] = useState<string | null>(null);
  const [bday, setBday] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const urls = Array.from(files).slice(0, 6 - photos.length).map((f) => URL.createObjectURL(f));
    setPhotos((p) => [...p, ...urls].slice(0, 6));
  }
  function removePhoto(i: number) {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
  }

  function toggleInterest(i: string) {
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }
  function toggleGoal(g: string) {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  const steps: Step[] = [
    {
      key: "goal",
      title: "Зачем ты в Frendly?",
      subtitle: "Можно выбрать несколько",
      render: () => (
        <div className="grid gap-3">
          {[
            "Знакомиться",
            "Ходить на встречи",
            "Найти отношения",
            "Создавать движ",
            "Спорт",
            "Камерные вечера",
          ].map((g) => {
            const on = goals.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggleGoal(g)}
                className={
                  "rounded-2xl px-5 py-4 text-left font-medium border transition " +
                  (on
                    ? "bg-lime-gradient text-lime-foreground border-transparent shadow-glow"
                    : "glass border-white/10")
                }
              >
                {g}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: "gender",
      title: "Твой пол",
      render: () => (
        <div className="grid grid-cols-2 gap-3">
          {(["М", "Ж"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={
                "rounded-2xl py-6 text-lg font-semibold border transition " +
                (gender === g
                  ? "bg-lime-gradient text-lime-foreground border-transparent shadow-glow"
                  : "glass border-white/10")
              }
            >
              {g === "М" ? "Мужской" : "Женский"}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "city",
      title: "Где ты сейчас?",
      subtitle: "Город или район",
      render: () => (
        <div className="space-y-4">
          <div className="glass border border-white/10 rounded-2xl flex items-center gap-3 px-4 py-4">
            <MapPin className="size-5 text-primary" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="flex-1 bg-transparent outline-none text-lg"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["Москва", "СПб", "Казань", "Сочи", "Алматы", "Тбилиси"].map((c) => (
              <Chip key={c} active={city === c} onClick={() => setCity(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "interests",
      title: "Что тебе по кайфу?",
      subtitle: "Выбери 3 и больше",
      render: () => (
        <div className="flex flex-wrap gap-2">
          {[
            "🎵 Музыка",
            "☕ Кофе",
            "🍷 Вино",
            "🏃 Спорт",
            "🎨 Арт",
            "🎬 Кино",
            "📚 Книги",
            "🍣 Еда",
            "🌃 Тусовки",
            "🧘 Йога",
            "🎮 Игры",
            "✈️ Путешествия",
            "🎤 Караоке",
            "🎲 Настолки",
          ].map((i) => (
            <Chip key={i} active={interests.includes(i)} onClick={() => toggleInterest(i)}>
              {i}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      key: "vibe",
      title: "Какой твой вайб?",
      render: () => (
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: "Чилл", e: "🌿" },
            { v: "Движ", e: "🔥" },
            { v: "Романтик", e: "💌" },
            { v: "Авантюрист", e: "🚀" },
          ].map(({ v, e }) => (
            <button
              key={v}
              onClick={() => setVibe(v)}
              className={
                "rounded-3xl p-5 text-left border transition " +
                (vibe === v
                  ? "bg-lime-gradient text-lime-foreground border-transparent shadow-glow"
                  : "glass border-white/10")
              }
            >
              <div className="text-3xl">{e}</div>
              <div className="mt-2 font-semibold">{v}</div>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "bday",
      title: "Твой день рождения",
      subtitle: "Покажем только возраст",
      render: () => (
        <div className="space-y-3">
          <label className="glass border border-white/10 rounded-2xl flex items-center gap-3 px-4 py-4 cursor-pointer">
            <Cake className="size-5 text-primary" />
            <input
              type="date"
              value={bday}
              onChange={(e) => setBday(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              min="1940-01-01"
              className="flex-1 bg-transparent outline-none text-lg"
              style={{ colorScheme: "dark" }}
            />
          </label>
          {bday && (
            <p className="text-xs text-muted-foreground px-1">
              Возраст: <span className="text-foreground font-semibold">
                {Math.max(0, Math.floor((Date.now() - new Date(bday).getTime()) / (365.25 * 24 * 3600 * 1000)))}
              </span> лет — видно другим
            </p>
          )}
        </div>
      ),
    },
    {
      key: "photos",
      title: "Добавь фото",
      subtitle: "Минимум 1, можно до 6. Первое — главное",
      render: () => (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addPhotos(e.target.files)}
          />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => {
              const src = photos[i];
              if (src) {
                return (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group">
                    <img src={src} alt="" className="size-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-lime-gradient text-lime-foreground text-[10px] font-bold px-2 py-0.5">
                        Главное
                      </span>
                    )}
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1.5 right-1.5 size-6 rounded-full bg-background/80 grid place-items-center"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={i}
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-2xl border border-dashed border-white/15 glass grid place-items-center text-muted-foreground hover:text-foreground transition"
                >
                  {photos.length === 0 && i === 0 ? <Camera className="size-6" /> : <Plus className="size-5" />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            Лица без масок и фильтров проходят верификацию быстрее.
          </p>
        </div>
      ),
    },
    {
      key: "contact",
      title: "Контакты",
      subtitle: "Email и телефон — для входа и безопасности",
      render: () => (
        <div className="space-y-3">
          <label className="glass border border-white/10 rounded-2xl flex items-center gap-3 px-4 py-4">
            <Mail className="size-5 text-primary" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@frendly.app"
              className="flex-1 bg-transparent outline-none text-lg"
            />
          </label>
          <label className="glass border border-white/10 rounded-2xl flex items-center gap-3 px-4 py-4">
            <Phone className="size-5 text-primary" />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 999 000 00 00"
              className="flex-1 bg-transparent outline-none text-lg"
            />
          </label>
          <p className="text-[11px] text-muted-foreground px-1">
            Не показываем в профиле. Используем только для входа, восстановления и SOS.
          </p>
        </div>
      ),
    },
    {
      key: "perms",
      title: "Разрешения",
      subtitle: "Нужны для рекомендаций рядом",
      render: () => (
        <div className="space-y-3">
          {[
            { i: <MapPin className="size-5" />, t: "Геолокация", d: "Встречи и события рядом" },
            { i: <Bell className="size-5" />, t: "Уведомления", d: "Приглашения, лайки, чаты" },
            { i: <UsersIcon className="size-5" />, t: "Контакты", d: "Найти друзей в Frendly" },
          ].map(({ i, t, d }) => (
            <div
              key={t}
              className="glass border border-white/10 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="size-11 rounded-xl bg-white/10 grid place-items-center text-primary">
                {i}
              </div>
              <div className="flex-1">
                <div className="font-medium">{t}</div>
                <div className="text-xs text-muted-foreground">{d}</div>
              </div>
              <button className="text-sm rounded-full glass border border-white/10 px-3 py-1.5">
                Разрешить
              </button>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const step = steps[idx];
  const progress = ((idx + 1) / steps.length) * 100;
  const last = idx === steps.length - 1;

  return (
    <PhoneFrame>
      <div className="min-h-screen flex flex-col px-5 pt-10 pb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (idx === 0 ? window.history.back() : setIdx((i) => i - 1))}
            className="size-11 rounded-2xl glass border border-white/10 grid place-items-center"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-lime-gradient transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {idx + 1}/{steps.length}
          </span>
        </div>

        <div className="mt-10 animate-fade-in" key={step.key}>
          <h1 className="text-3xl font-semibold">{step.title}</h1>
          {step.subtitle && (
            <p className="mt-2 text-muted-foreground">{step.subtitle}</p>
          )}
          <div className="mt-8">{step.render()}</div>
        </div>

        <div className="flex-1" />
        <button
          onClick={() => (last ? navigate({ to: "/" }) : setIdx((i) => i + 1))}
          className="w-full rounded-2xl bg-lime-gradient text-lime-foreground font-semibold py-4 shadow-glow"
        >
          {last ? "В Frendly" : "Дальше"}
        </button>
      </div>
    </PhoneFrame>
  );
}
