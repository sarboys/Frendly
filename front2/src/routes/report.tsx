import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, ShieldAlert, Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/report")({
  head: () => ({ meta: [{ title: "Пожаловаться — Dateasy" }] }),
  component: ReportPage,
});

const reasons = [
  { id: "fake", t: "Фейковый профиль", s: "Подозреваю, что фото не его" },
  { id: "spam", t: "Спам или реклама", s: "Навязчивые ссылки или продажа услуг" },
  { id: "harass", t: "Оскорбления", s: "Грубость, угрозы, домогательства" },
  { id: "minor", t: "Несовершеннолетний", s: "Похоже, человеку нет 18" },
  { id: "scam", t: "Мошенничество", s: "Просит деньги или данные" },
  { id: "other", t: "Другое", s: "Опиши ниже" },
];

function ReportPage() {
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [block, setBlock] = useState(true);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <PhoneFrame>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <div className="size-20 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
            <Check className="size-10" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Жалоба отправлена</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">
            Рассмотрим в течение 24 часов. {block && "Профиль заблокирован."}
          </p>
          <Link to="/dating" className="mt-8 rounded-2xl bg-lime-gradient text-lime-foreground px-6 py-3 font-bold shadow-glow">
            Вернуться
          </Link>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/dating" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Пожаловаться</span>
        <span className="size-11" />
      </header>

      <div className="px-5 mt-5 flex items-center gap-3 rounded-3xl bg-pink/15 border border-pink/30 p-4">
        <ShieldAlert className="size-6 text-pink" />
        <p className="text-xs text-muted-foreground">Жалоба анонимна. Мы не покажем её другому пользователю.</p>
      </div>

      <section className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Причина</p>
        <div className="space-y-2">
          {reasons.map((r) => {
            const on = sel === r.id;
            return (
              <button key={r.id} onClick={()=>setSel(r.id)}
                className={`w-full text-left rounded-2xl border p-3 flex items-center gap-3 ${on ? "border-lime bg-lime/10 shadow-glow" : "border-white/10 glass"}`}>
                <span className={`size-5 rounded-full border-2 grid place-items-center ${on ? "border-lime bg-lime" : "border-white/30"}`}>
                  {on && <Check className="size-3 text-lime-foreground" />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{r.t}</p>
                  <p className="text-[11px] text-muted-foreground">{r.s}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Комментарий</p>
        <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={4} placeholder="Опиши, что случилось"
          className="w-full rounded-2xl glass border border-white/10 px-4 py-3 text-sm resize-none placeholder:text-muted-foreground" />
      </section>

      <label className="mx-5 mt-4 flex items-center gap-3 rounded-2xl glass border border-white/10 p-3">
        <input type="checkbox" checked={block} onChange={(e)=>setBlock(e.target.checked)} className="size-5 accent-[oklch(0.92_0.2_130)]" />
        <span className="text-sm flex-1">Также заблокировать профиль</span>
      </label>

      <div className="sticky bottom-0 mt-8 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <button
          disabled={!sel}
          onClick={()=>setSent(true)}
          className="w-full rounded-2xl bg-lime-gradient text-lime-foreground py-4 font-bold shadow-glow disabled:opacity-40 disabled:shadow-none"
        >
          Отправить жалобу
        </button>
      </div>
    </PhoneFrame>
  );
}
