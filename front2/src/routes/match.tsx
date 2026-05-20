import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Sparkles, X } from "lucide-react";
import me from "@/assets/person-3.jpg";
import her from "@/assets/person-1.jpg";

export const Route = createFileRoute("/match")({
  head: () => ({ meta: [{ title: "It's a match! — Dateasy" }] }),
  component: MatchPage,
});

function MatchPage() {
  return (
    <div className="mx-auto w-full max-w-[420px] min-h-screen relative overflow-hidden bg-hero">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-20 size-80 rounded-full blur-3xl opacity-50 bg-lime-gradient" />
        <div className="absolute -bottom-20 -right-20 size-80 rounded-full blur-3xl opacity-40 bg-pink-gradient" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-lime">match</p>
        <h1 className="mt-3 text-6xl font-semibold bg-lime-gradient text-lime-foreground rounded-3xl px-6 py-2 inline-block shadow-glow">
          It's a vibe!
        </h1>
        <p className="mt-4 text-muted-foreground max-w-[280px]">
          Вы оба идёте на <b className="text-foreground">Speciality coffee · сегодня 19:30</b>
        </p>

        <div className="mt-10 relative h-56 w-72">
          <span className="absolute left-0 top-4 size-40 rounded-full overflow-hidden border-4 border-background shadow-soft rotate-[-8deg]">
            <img src={me} className="size-full object-cover" alt="" />
          </span>
          <span className="absolute right-0 bottom-0 size-40 rounded-full overflow-hidden border-4 border-background shadow-glow rotate-[8deg]">
            <img src={her} className="size-full object-cover" alt="" />
          </span>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-16 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
            <Heart className="size-7 fill-current" />
          </span>
        </div>

        <div className="mt-10 w-full space-y-3">
          <Link to="/chats" className="flex items-center justify-center gap-2 w-full rounded-2xl bg-lime-gradient text-lime-foreground py-4 font-bold shadow-glow">
            <MessageCircle className="size-5" /> Написать сообщение
          </Link>
          <Link to="/meetings/new" className="flex items-center justify-center gap-2 w-full rounded-2xl glass border border-white/10 py-4 font-semibold">
            <Sparkles className="size-5 text-lime" /> Позвать на встречу
          </Link>
          <Link to="/dating" className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground py-2">
            <X className="size-4" /> Свайпать дальше
          </Link>
        </div>
      </div>
    </div>
  );
}
