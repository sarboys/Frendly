import { Link } from "@tanstack/react-router";
import { Gift, Ticket, ChevronRight } from "lucide-react";

export function GiveawayTeaser() {
  return (
    <section className="px-5 mt-6">
      <Link
        to="/giveaways"
        className="relative block rounded-3xl overflow-hidden border border-white/10 shadow-soft group"
        aria-label="Открыть Frendly Drops"
      >
        <div className="absolute inset-0 bg-hero" />
        <div className="absolute -top-10 -right-10 size-40 rounded-full blur-2xl bg-lime-gradient opacity-50" />
        <div className="absolute -bottom-10 -left-10 size-40 rounded-full blur-2xl bg-pink-gradient opacity-25" />

        <div className="relative flex items-center gap-3 p-3.5">
          <div className="relative size-14 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/40 to-transparent" />
            <Gift className="relative size-6" />
            <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-pink text-pink-foreground text-[10px] font-bold grid place-items-center border-2 border-background">
              3
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full glass border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider mb-1">
              <Ticket className="size-2.5 text-lime" /> frendly drops · июнь
            </div>
            <p className="text-sm font-semibold leading-tight truncate">
              Июньский Drop · 3 × iPhone 16 Pro
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Бесплатно для верифицированных · получай билеты за активность
            </p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground shrink-0" />
        </div>
      </Link>
    </section>
  );
}
