import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dating/filter")({
  head: () => ({ meta: [{ title: "Фильтры дейтинга — Dateasy" }] }),
  component: FilterPage,
});

const goals = ["Дружба", "Свидание", "Серьёзно", "Networking", "Тусовки"];
const vibes = ["Спокойный", "Творческий", "Активный", "Тусовщик", "Интеллект"];

function FilterPage() {
  const [age, setAge] = useState<[number, number]>([22, 32]);
  const [distance, setDistance] = useState(5);
  const [gender, setGender] = useState("Все");
  const [goal, setGoal] = useState("Свидание");
  const [selVibes, setSelVibes] = useState<string[]>(["Творческий"]);

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/dating" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Фильтры</span>
        <button className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <RotateCcw className="size-5" />
        </button>
      </header>

      <div className="px-5 mt-6 space-y-6">
        <section>
          <p className="text-sm text-muted-foreground mb-2">Кого показывать</p>
          <div className="grid grid-cols-3 gap-2">
            {["Девушки", "Парни", "Все"].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`rounded-2xl py-3 text-sm font-semibold border ${
                  gender === g ? "bg-lime-gradient text-lime-foreground border-transparent shadow-glow" : "glass border-white/10"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Возраст</span>
            <span className="font-semibold">{age[0]}–{age[1]}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/10 relative">
            <div className="absolute h-2 rounded-full bg-lime-gradient" style={{ left: `${((age[0]-18)/(60-18))*100}%`, right: `${100 - ((age[1]-18)/(60-18))*100}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            <input type="number" value={age[0]} onChange={(e)=>setAge([+e.target.value, age[1]])} className="flex-1 rounded-xl glass border border-white/10 px-3 py-2 text-sm" />
            <input type="number" value={age[1]} onChange={(e)=>setAge([age[0], +e.target.value])} className="flex-1 rounded-xl glass border border-white/10 px-3 py-2 text-sm" />
          </div>
        </section>

        <section>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Расстояние</span>
            <span className="font-semibold">{distance} км</span>
          </div>
          <input type="range" min={1} max={50} value={distance} onChange={(e)=>setDistance(+e.target.value)} className="mt-3 w-full accent-[oklch(0.92_0.2_130)]" />
        </section>

        <section>
          <p className="text-sm text-muted-foreground mb-2">Цель</p>
          <div className="flex flex-wrap gap-2">
            {goals.map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`rounded-full px-4 py-2 text-sm ${goal === g ? "bg-lime text-lime-foreground font-semibold" : "glass border border-white/10"}`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="text-sm text-muted-foreground mb-2">Вайбы</p>
          <div className="flex flex-wrap gap-2">
            {vibes.map((v) => {
              const on = selVibes.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => setSelVibes(on ? selVibes.filter(x=>x!==v) : [...selVibes, v])}
                  className={`rounded-full px-4 py-2 text-sm ${on ? "bg-lilac text-lilac-foreground font-semibold" : "glass border border-white/10"}`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl glass border border-white/10 p-4 space-y-3">
          <ToggleRow label="Только верифицированные" sub="Профили с галочкой Frendly" defaultOn />
          <div className="h-px bg-white/10" />
          <ToggleRow label="Только Frendly+" sub="Подписчики премиум · приоритет" />
          <div className="h-px bg-white/10" />
          <ToggleRow label="Онлайн сейчас" sub="Активны последние 15 минут" defaultOn />
          <div className="h-px bg-white/10" />
          <ToggleRow label="Новые на этой неделе" sub="Анкеты, появившиеся за 7 дней" />
        </section>
      </div>

      <div className="sticky bottom-0 mt-8 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <Link to="/dating" className="block w-full text-center rounded-2xl bg-lime-gradient text-lime-foreground py-4 font-bold shadow-glow">
          Показать 47 анкет
        </Link>
      </div>
    </PhoneFrame>
  );
}

function ToggleRow({ label, sub, defaultOn }: { label: string; sub: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button onClick={() => setOn(!on)} className="w-full flex items-center gap-3 text-left">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <span className={"relative h-7 w-12 rounded-full transition shrink-0 " + (on ? "bg-lime-gradient shadow-glow" : "bg-white/10 border border-white/10")}>
        <span className={"absolute top-0.5 size-6 rounded-full bg-background transition-all " + (on ? "left-[calc(100%-1.625rem)]" : "left-0.5")} />
      </span>
    </button>
  );
}
