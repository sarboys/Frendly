import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Camera, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import me from "@/assets/person-3.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";

export const Route = createFileRoute("/profile/edit")({
  head: () => ({ meta: [{ title: "Редактировать профиль — Dateasy" }] }),
  component: ProfileEdit,
});

const allInterests = ["Speciality coffee","Винил","Галереи","Прогулки","Кино","Йога","Бег","Гастро","Книги","Серфинг","Театр","Кофе","Музеи","Стендап"];

function ProfileEdit() {
  const [name, setName] = useState("Алекс");
  const [age, setAge] = useState(27);
  const [bio, setBio] = useState("Дизайнер. Собираю встречи, где играет музыка и варят честный кофе.");
  const [interests, setInterests] = useState<string[]>(["Speciality coffee","Винил","Галереи","Прогулки"]);

  const toggle = (t: string) =>
    setInterests((cur) => cur.includes(t) ? cur.filter(x=>x!==t) : [...cur, t]);

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/profile" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Редактировать</span>
        <Link to="/profile" className="text-sm font-bold text-lime">Готово</Link>
      </header>

      <section className="px-5 mt-6">
        <p className="text-sm text-muted-foreground mb-3">Фото</p>
        <div className="grid grid-cols-3 gap-2">
          {[me, p1, p2].map((src, i) => (
            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10">
              <img src={src} alt="" className="size-full object-cover" />
              <button onClick={() => toast("Фото убрано")} className="absolute top-1 right-1 size-6 rounded-full bg-background/80 grid place-items-center">
                <X className="size-3" />
              </button>
              {i === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-lime text-lime-foreground text-[10px] px-1.5 py-0.5 font-bold">Главное</span>}
            </div>
          ))}
          {[0,1,2].map((i) => (
            <button key={i} onClick={() => toast("Загрузка фото скоро")} className="aspect-square rounded-2xl border border-dashed border-white/15 grid place-items-center text-muted-foreground">
              <Plus className="size-5" />
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6 space-y-4">
        <Field label="Имя">
          <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full rounded-2xl glass border border-white/10 px-4 py-3 text-sm" />
        </Field>
        <Field label="Возраст">
          <input type="number" value={age} onChange={(e)=>setAge(+e.target.value)} className="w-full rounded-2xl glass border border-white/10 px-4 py-3 text-sm" />
        </Field>
        <Field label="О себе">
          <textarea value={bio} onChange={(e)=>setBio(e.target.value)} rows={4} className="w-full rounded-2xl glass border border-white/10 px-4 py-3 text-sm resize-none" />
        </Field>
      </section>

      <section className="px-5 mt-6">
        <p className="text-sm text-muted-foreground mb-3">Интересы · выбрано {interests.length}</p>
        <div className="flex flex-wrap gap-2">
          {allInterests.map((t) => {
            const on = interests.includes(t);
            return (
              <button key={t} onClick={()=>toggle(t)}
                className={`rounded-full px-3.5 py-2 text-sm ${on ? "bg-lime text-lime-foreground font-semibold" : "glass border border-white/10"}`}>
                {t}
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 mt-6">
        <p className="text-sm text-muted-foreground mb-3">Соц-сети</p>
        <div className="space-y-2">
          {["Instagram","Telegram","Spotify"].map((s) => (
            <div key={s} className="rounded-2xl glass border border-white/10 px-4 py-3 flex items-center justify-between text-sm">
              <span>{s}</span>
              <button onClick={() => toast.success(`${s} привязан`)} className="text-xs text-lime font-semibold">Привязать</button>
            </div>
          ))}
        </div>
      </section>

      <div className="h-10" />
      <button onClick={() => toast.error("Удаление аккаунта", { description: "Подтверждение придёт на email" })} className="mx-5 mb-8 rounded-2xl py-3 w-[calc(100%-2.5rem)] text-sm text-destructive border border-destructive/30">
        Удалить аккаунт
      </button>
    </PhoneFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
