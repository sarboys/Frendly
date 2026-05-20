import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { ArrowLeft, Sparkles, ArrowRight, Wand2, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/ai-builder/")({
  head: () => ({
    meta: [
      { title: "AI билдер встреч — Frendly" },
      { name: "description", content: "Опиши вайб одним предложением — AI соберёт встречу за 30 секунд." },
    ],
  }),
  component: AIBuilderPage,
});

const examples = [
  {
    title: "Уютный вечер вдвоём",
    text: "Найди тихий винный бар на двоих в центре, с виниловой музыкой и небольшим залом. Не громко, рядом с метро.",
  },
  {
    title: "Активная компания на 4-6",
    text: "Собери активный вечер на 4-6 человек: что-то спортивное или адреналиновое, потом перекус. Бюджет до 3к на человека.",
  },
  {
    title: "Гастро-приключение",
    text: "Хочу гастро-тур по 3 местам в районе Патриарших — необычная кухня, авторские коктейли, новые впечатления.",
  },
  {
    title: "Креативное свидание",
    text: "Что-нибудь странное и креативное для первого свидания — выставка, перформанс, нестандартное место. Удивить.",
  },
];

const tips = [
  "Укажи количество людей и вайб (тихо / активно / шумно)",
  "Добавь район или метро рядом",
  "Намекни на бюджет — «дёшево», «средне», «без лимита»",
  "Опиши настроение — «отдохнуть», «познакомиться», «удивить»",
];

function AIBuilderPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  const generate = () => navigate({ to: "/ai-builder/result" });

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to="/" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-lime" />
          <span className="font-display text-lg font-semibold">AI билдер</span>
        </div>
        <div className="size-11" />
      </div>

      <section className="px-5 mt-6">
        <h1 className="font-display text-[34px] font-semibold leading-[1.05]">
          Опиши вайб — <br />
          <span className="text-lime">соберём вечер</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-[320px] leading-snug">
          Один абзац свободным текстом. AI разберёт детали, подберёт места, маршрут и людей рядом.
        </p>
      </section>

      {/* Prompt input */}
      <section className="px-5 mt-6">
        <div className="relative group">
          {/* Glow halo */}
          <div className="absolute -inset-0.5 rounded-[2rem] bg-lime-gradient opacity-60 blur-xl group-focus-within:opacity-90 transition" />
          <div className="absolute -inset-px rounded-[2rem] bg-lime-gradient" />

          <div className="relative rounded-[calc(2rem-2px)] bg-background overflow-hidden">
            {/* Inner glow accents */}
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-lime/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-12 -bottom-12 size-40 rounded-full bg-pink/10 blur-3xl pointer-events-none" />

            {/* Header chip */}
            <div className="relative flex items-center justify-between px-4 pt-3.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 text-lime px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">
                <Sparkles className="size-3" /> Промт
              </div>
              {prompt.length > 0 && (
                <button
                  onClick={() => setPrompt("")}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition"
                >
                  Очистить
                </button>
              )}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="Например: уютный винный бар на двоих в центре, негромкая музыка, рядом с метро Чистые пруды, бюджет до 3к..."
              className="relative w-full bg-transparent outline-none resize-none placeholder:text-muted-foreground/60 text-[15px] leading-relaxed px-4 pt-3 pb-3"
            />

            {/* Footer */}
            <div className="relative flex items-center justify-between gap-3 px-4 pb-3.5 pt-1 border-t border-white/5">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums font-medium text-foreground/80">{prompt.length}</span>
                <span>символов</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lightbulb className="size-3 text-lime" />
                <span>2-3 предложения — идеально</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Examples */}
      <section className="px-5 mt-7">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <Wand2 className="size-3.5" /> Примеры промтов
        </div>
        <div className="mt-3 grid gap-2.5">
          {examples.map((ex) => (
            <button
              key={ex.title}
              onClick={() => setPrompt(ex.text)}
              className="text-left rounded-2xl glass border border-white/10 p-4 transition active:scale-[0.99] hover:border-lime/40"
            >
              <p className="text-sm font-semibold">{ex.title}</p>
              <p className="mt-1 text-[13px] text-muted-foreground leading-snug line-clamp-2">{ex.text}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="px-5 mt-7">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Lightbulb className="size-3.5 text-lime" /> Как описать круче
          </div>
          <ul className="mt-3 space-y-2">
            {tips.map((t) => (
              <li key={t} className="flex items-start gap-2 text-[13px] text-foreground/80">
                <span className="mt-1.5 size-1.5 rounded-full bg-lime shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="px-5 mt-8 sticky bottom-24 z-10">
        <button
          onClick={generate}
          disabled={prompt.trim().length < 3}
          className="w-full h-14 rounded-2xl bg-lime-gradient text-lime-foreground font-semibold flex items-center justify-center gap-2 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.99]"
        >
          <Sparkles className="size-5" /> Сгенерировать вечер
          <ArrowRight className="size-5" />
        </button>
      </div>

      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
