import { createFileRoute, Link } from "@tanstack/react-router";
import { X, Heart, MessageCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";
import ev from "@/assets/event-rooftop.jpg";
import ev2 from "@/assets/event-art.jpg";

export const Route = createFileRoute("/stories")({
  head: () => ({ meta: [{ title: "Stories — Dateasy" }] }),
  component: StoriesPage,
});

const story = [
  { img: ev, who: "Нина", time: "2ч", text: "винил-вечер вчера 🎶" },
  { img: ev2, who: "Нина", time: "1ч", text: "ловим закат на крыше" },
  { img: p1, who: "Нина", time: "20м", text: "пятница, начинаем" },
];

function StoriesPage() {
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (i < story.length - 1) { setI(i + 1); return 0; }
          return 100;
        }
        return p + 2;
      });
    }, 80);
    return () => clearInterval(t);
  }, [i]);

  const cur = story[i];

  return (
    <div className="mx-auto w-full max-w-[420px] min-h-screen bg-black relative overflow-hidden">
      <img src={cur.img} className="absolute inset-0 size-full object-cover" alt="" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />

      {/* Progress bars */}
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
        {story.map((_, idx) => (
          <div key={idx} className="h-0.5 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white" style={{ width: idx < i ? "100%" : idx === i ? `${progress}%` : "0%" }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-7 left-3 right-3 flex items-center gap-2 z-20">
        <img src={p1} alt="" className="size-8 rounded-full object-cover border-2 border-white" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{cur.who}</p>
          <p className="text-[11px] text-white/70">{cur.time}</p>
        </div>
        <Link to="/dating" className="size-9 rounded-full bg-white/10 backdrop-blur grid place-items-center text-white">
          <X className="size-5" />
        </Link>
      </div>

      {/* Tap zones */}
      <button onClick={()=>{ setI(Math.max(0,i-1)); setProgress(0); }} className="absolute left-0 top-0 w-1/3 h-full z-10" aria-label="prev" />
      <button onClick={()=>{ setI(Math.min(story.length-1,i+1)); setProgress(0); }} className="absolute right-0 top-0 w-1/3 h-full z-10" aria-label="next" />

      {/* Caption */}
      <div className="absolute bottom-28 left-5 right-5 z-20">
        <p className="text-lg font-semibold text-white drop-shadow">{cur.text}</p>
      </div>

      {/* Reactions */}
      <div className="absolute bottom-20 left-5 right-5 flex gap-1.5 z-20">
        {["🔥","❤️","👀","🍷","🎶"].map((e) => (
          <button key={e} className="size-10 rounded-full bg-white/10 backdrop-blur grid place-items-center text-xl">{e}</button>
        ))}
      </div>

      {/* Reply */}
      <div className="absolute bottom-5 left-5 right-5 flex items-center gap-2 z-20">
        <div className="flex-1 rounded-full bg-white/10 backdrop-blur border border-white/20 px-4 py-3 text-sm text-white/70">
          Ответить Нине…
        </div>
        <button className="size-11 rounded-full bg-white/10 backdrop-blur grid place-items-center text-white"><Heart className="size-5" /></button>
        <button className="size-11 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center"><Send className="size-5" /></button>
      </div>

      {/* Story tray */}
      <div className="absolute top-20 right-3 flex flex-col gap-1.5 z-10">
        {[p1,p2,p3].map((p,idx)=>(
          <button key={idx} className="size-9 rounded-full overflow-hidden border-2 border-white/40">
            <img src={p} className="size-full object-cover" alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}
