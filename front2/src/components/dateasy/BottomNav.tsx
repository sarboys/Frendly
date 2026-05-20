import { CalendarHeart, Compass, Plus, MessageCircle, Heart } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";

type NavItem = {
  icon: typeof Plus;
  to: string;
  label: string;
  primary?: boolean;
};

const items: NavItem[] = [
  { icon: CalendarHeart, to: "/meetings", label: "Встречи" },
  { icon: Compass, to: "/", label: "Главная" },
  { icon: Plus, to: "/meetings/new", label: "Создать встречу", primary: true },
  { icon: MessageCircle, to: "/chats", label: "Чаты" },
  { icon: Heart, to: "/dating", label: "Дейтинг" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,400px)]">
      <nav className="glass border border-white/10 rounded-full px-3 py-2.5 flex items-center justify-between shadow-soft">
        {items.map(({ icon: Icon, to, label, primary }) => {
          const active = pathname === to;
          if (primary) {
            return (
              <Link
                key={label}
                to={to}
                aria-label={label}
                className="size-14 -my-3 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow ring-4 ring-background/40 active:scale-95 transition"
              >
                <Icon className="size-6" strokeWidth={2.4} />
              </Link>
            );
          }
          return (
            <Link
              key={label}
              to={to}
              aria-label={label}
              className={
                "size-11 rounded-full grid place-items-center transition " +
                (active
                  ? "bg-lilac text-lilac-foreground"
                  : "text-foreground/70 hover:text-foreground")
              }
            >
              <Icon className="size-5" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
