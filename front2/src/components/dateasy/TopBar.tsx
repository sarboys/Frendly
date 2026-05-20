import { Bell, Coins, MapPin, ChevronDown, Navigation, ShieldAlert, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import person from "@/assets/person-3.jpg";
import { useTokens } from "@/lib/tokens";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

const cities = [
  "Москва",
  "Санкт-Петербург",
  "Сочи",
  "Казань",
  "Дубай",
  "Тбилиси",
  "Ереван",
  "Алматы",
  "Берлин",
  "Лиссабон",
];

export function TopBar() {
  const { balance } = useTokens();
  const [city, setCity] = useState("Москва");
  const [open, setOpen] = useState(false);

  const detect = () => {
    // Simulate VPN/geo mismatch warning
    toast.warning("Похоже, включён VPN", {
      description: "Гео определилось как «Амстердам». Укажи город вручную.",
      icon: <ShieldAlert className="size-4" />,
    });
  };

  return (
    <div className="flex items-center justify-between px-5 pt-4 gap-2">
      {/* Region picker (replaces burger) */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Выбор города"
            className="h-11 max-w-[44%] rounded-2xl glass border border-white/10 grid grid-cols-[auto_1fr_auto] items-center gap-1.5 px-2.5 shrink-0"
          >
            <span className="size-7 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center">
              <MapPin className="size-3.5" />
            </span>
            <span className="text-sm font-semibold truncate">{city}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-72 p-2 rounded-2xl glass border border-white/10 bg-background/95 backdrop-blur"
        >
          <div className="rounded-xl border border-pink/30 bg-pink/10 p-2.5 mb-2 flex items-start gap-2">
            <ShieldAlert className="size-4 text-pink shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Если включён <span className="text-foreground font-semibold">VPN</span> — гео определится неверно. Укажи город вручную.
            </p>
          </div>

          <button
            onClick={detect}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/5 text-sm"
          >
            <span className="size-7 rounded-lg bg-lilac/30 text-lilac grid place-items-center">
              <Navigation className="size-3.5" />
            </span>
            <span className="flex-1 text-left">Определить автоматически</span>
            <span className="text-[10px] text-muted-foreground">GPS</span>
          </button>

          <div className="my-1.5 h-px bg-white/5" />

          <p className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Города</p>
          <div className="max-h-64 overflow-y-auto">
            {cities.map((c) => (
              <button
                key={c}
                onClick={() => { setCity(c); setOpen(false); toast.success(`Город: ${c}`); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 text-sm text-left"
              >
                <MapPin className="size-3.5 text-muted-foreground" />
                <span className="flex-1">{c}</span>
                {city === c && <Check className="size-4 text-lime" />}
              </button>
            ))}
          </div>

          <Link
            to="/city"
            onClick={() => setOpen(false)}
            className="block mt-1 px-3 py-2 text-xs text-center text-lime font-semibold rounded-xl hover:bg-white/5"
          >
            Открыть полный список →
          </Link>
        </PopoverContent>
      </Popover>

      <Link
        to="/wallet"
        className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-2xl glass border border-white/10 px-3 font-semibold text-sm min-w-0"
        aria-label="Кошелёк"
      >
        <Coins className="size-4 text-lime" />
        <span className="font-display">{balance}</span>
        <span className="text-muted-foreground text-xs font-medium">FT</span>
      </Link>

      <Link to="/notifications" aria-label="Уведомления" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center relative shrink-0">
        <Bell className="size-5" />
        <span className="absolute top-2 right-2 size-2 rounded-full bg-pink" />
      </Link>
      <Link to="/profile" aria-label="Профиль" className="shrink-0">
        <img src={person} alt="profile" className="size-11 rounded-2xl object-cover border border-white/10" />
      </Link>
    </div>
  );
}
