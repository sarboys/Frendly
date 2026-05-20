import { Sparkles, ArrowRight, Wand2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function AIBuilder() {
  return (
    <section className="px-5 mt-8">
      <Link
        to="/ai-builder"
        className="group block rounded-[2rem] p-6 relative overflow-hidden bg-lime-gradient text-lime-foreground shadow-glow transition active:scale-[0.99]"
      >
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 size-40 rounded-full bg-white/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
            <Sparkles className="size-4" /> AI Date Builder
          </div>

          <h3 className="mt-3 font-display text-[28px] font-semibold leading-[1.05]">
            Соберём идеальную <br /> встречу за&nbsp;30&nbsp;секунд
          </h3>

          <p className="mt-3 text-sm opacity-80 max-w-[280px] leading-snug">
            Опиши вайб одним предложением — AI подберёт место, время и компанию рядом.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-12 rounded-2xl bg-foreground text-background font-semibold flex items-center justify-center gap-2 shadow-lg">
              <Wand2 className="size-4" /> Открыть билдер
            </div>
            <div className="size-12 rounded-2xl bg-background/90 text-foreground grid place-items-center shadow-lg transition group-hover:translate-x-0.5">
              <ArrowRight className="size-5" />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
