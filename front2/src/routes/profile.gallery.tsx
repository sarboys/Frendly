import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Camera, Plus } from "lucide-react";
import me from "@/assets/person-3.jpg";
import p1 from "@/assets/person-1.jpg";
import p2 from "@/assets/person-2.jpg";
import evRoof from "@/assets/event-rooftop.jpg";
import evArt from "@/assets/event-art.jpg";
import evCoffee from "@/assets/event-coffee.jpg";

export const Route = createFileRoute("/profile/gallery")({
  head: () => ({
    meta: [
      { title: "Галерея — Профиль" },
      { name: "description", content: "Все фото из твоего профиля." },
    ],
  }),
  component: GalleryPage,
});

const all = [me, p1, p2, evArt, evCoffee, evRoof, evRoof, evArt, me, p2, evCoffee, p1];

function GalleryPage() {
  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to="/profile" aria-label="Назад" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Галерея</span>
        <button aria-label="Добавить фото" className="size-11 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center">
          <Plus className="size-5" />
        </button>
      </div>

      <div className="px-5 mt-4">
        <p className="text-xs text-muted-foreground">{all.length} фото · обновлено сегодня</p>
      </div>

      <div className="px-5 mt-3 grid grid-cols-3 gap-1.5">
        {all.map((g, i) => (
          <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10 relative group">
            <img src={g} alt="" className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-background/70 backdrop-blur-md border border-white/10">Главное</span>
            )}
          </div>
        ))}
      </div>

      <div className="px-5 mt-6">
        <button className="w-full rounded-2xl glass border border-dashed border-white/15 p-4 inline-flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Camera className="size-4" /> Загрузить ещё фото
        </button>
      </div>

      <div className="h-24" />
    </PhoneFrame>
  );
}
