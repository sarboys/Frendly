import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Search, MapPin, Check, Navigation } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/city")({
  head: () => ({ meta: [{ title: "Выбор города — Dateasy" }] }),
  component: CityPage,
});

const popular = ["Москва","Санкт-Петербург","Дубай","Тбилиси","Алматы","Берлин","Ереван","Лиссабон"];
const all = ["Москва","Санкт-Петербург","Сочи","Казань","Екатеринбург","Новосибирск","Дубай","Стамбул","Тбилиси","Ереван","Бишкек","Алматы","Ташкент","Белград","Берлин","Лиссабон","Барселона","Париж","Лондон","Нью-Йорк"];

function CityPage() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState("Москва");
  const filtered = all.filter(c => c.toLowerCase().includes(q.toLowerCase()));

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Город</span>
        <Link to="/" className="text-sm font-bold text-lime">Готово</Link>
      </header>

      <div className="px-5 mt-4">
        <div className="rounded-2xl glass border border-white/10 px-4 py-3 flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Найти город" className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground" />
        </div>
      </div>

      <button className="mx-5 mt-3 w-[calc(100%-2.5rem)] rounded-2xl glass border border-white/10 px-4 py-3 flex items-center gap-3 text-sm">
        <span className="size-9 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center">
          <Navigation className="size-4" />
        </span>
        <span className="flex-1 text-left">Определить автоматически</span>
        <span className="text-xs text-muted-foreground">GPS</span>
      </button>

      {!q && (
        <section className="px-5 mt-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Популярные</p>
          <div className="flex flex-wrap gap-2">
            {popular.map((c) => (
              <button key={c} onClick={()=>setSel(c)}
                className={`rounded-full px-3.5 py-2 text-sm ${sel===c ? "bg-lime text-lime-foreground font-semibold" : "glass border border-white/10"}`}>
                {c}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Все города</p>
        <div className="rounded-2xl glass border border-white/10 divide-y divide-white/5 overflow-hidden">
          {filtered.map((c) => (
            <button key={c} onClick={()=>setSel(c)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <MapPin className="size-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{c}</span>
              {sel===c && <Check className="size-4 text-lime" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground text-center">Ничего не найдено</p>}
        </div>
      </section>

      <div className="h-10" />
    </PhoneFrame>
  );
}
