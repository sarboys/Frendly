import { MapPin, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import p3 from "@/assets/person-3.jpg";

const dots = [
  { top: "22%", left: "28%", img: p1, ring: "ring-lime" },
  { top: "58%", left: "70%", img: p2, ring: "ring-accent" },
  { top: "70%", left: "30%", img: p3, ring: "ring-pink" },
];

export function RadarCard() {
  return (
    <div className="mx-5 mt-5 rounded-3xl p-5 relative overflow-hidden shadow-soft border border-white/10"
         style={{ background: "linear-gradient(160deg, oklch(0.3 0.12 295), oklch(0.22 0.08 295))" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> Радар встреч · 1,2 км
          </div>
          <h3 className="mt-1 text-xl font-semibold">12 человек рядом</h3>
        </div>
        <Link to="/map" className="rounded-full bg-lime-gradient text-lime-foreground px-4 py-2 text-sm font-semibold shadow-glow">
          Открыть
        </Link>
      </div>

      <div className="relative mt-4 aspect-square mx-auto max-w-[280px]">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border border-white/10"
            style={{ inset: `${(i - 1) * 12}%` }}
          />
        ))}
        <div className="absolute inset-[18%] rounded-full bg-lime/10 blur-2xl" />
        <div className="absolute inset-[35%] rounded-full bg-lime/20 radar-ping" />

        <Link to="/map" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="size-12 rounded-full bg-lime-gradient grid place-items-center shadow-glow">
            <Users className="size-5 text-lime-foreground" />
          </div>
        </Link>

        {dots.map((d, i) => (
          <Link
            key={i}
            to="/u/$userId"
            params={{ userId: `radar-${i}` }}
            className="absolute float-y"
            style={{ top: d.top, left: d.left }}
          >
            <img
              src={d.img}
              alt=""
              loading="lazy"
              className={`size-12 rounded-full object-cover ring-2 ${d.ring} ring-offset-2 ring-offset-background`}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
