import { useState } from "react";

const chips = ["Все", "Кофе", "Спорт", "Музыка", "Прогулка", "Бар"];

export function Chips() {
  const [active, setActive] = useState("Все");
  return (
    <div className="px-5 mt-6 flex gap-2 overflow-x-auto no-scrollbar">
      {chips.map((c) => (
        <button
          key={c}
          onClick={() => setActive(c)}
          className={
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition " +
            (active === c
              ? "bg-foreground text-background border-transparent"
              : "border-white/10 text-foreground/80 glass hover:bg-white/5")
          }
        >
          {c}
        </button>
      ))}
    </div>
  );
}
