import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Logo } from "@/components/dateasy/Logo";

export const Route = createFileRoute("/welcome")({ component: Welcome });

function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.3c-2 1.5-4.5 2.5-7.3 2.5-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.5l6.2 5.3c-.4.4 6.5-4.8 6.5-14.8 0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

function YandexIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#FC3F1D" />
      <path fill="#fff" d="M13.6 19h2.3V5h-3.36c-3.38 0-5.16 1.74-5.16 4.31 0 2.05 1 3.26 2.78 4.5L7.1 19h2.5l3.4-5.83-1.16-.78c-1.44-.97-2.13-1.73-2.13-3.34 0-1.42.99-2.38 2.86-2.38h1.03V19z"/>
    </svg>
  );
}

function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#229ED9" />
      <path fill="#fff" d="M17.6 7.4 15.5 17c-.16.7-.58.87-1.17.54l-3.24-2.39-1.56 1.5c-.17.17-.32.32-.65.32l.23-3.28 5.97-5.4c.26-.23-.06-.36-.4-.13L7.32 12.8l-3.18-1c-.7-.22-.7-.7.14-1.04l12.43-4.8c.57-.2 1.07.14.89 1.44z"/>
    </svg>
  );
}

function SocialBtn({
  icon,
  label,
  variant = "ghost",
  to,
}: {
  icon: React.ReactNode;
  label: string;
  variant?: "primary" | "ghost";
  to: string;
}) {
  const base =
    "w-full rounded-2xl px-5 py-4 flex items-center gap-3 font-medium transition";
  const styles =
    variant === "primary"
      ? "bg-lime-gradient text-lime-foreground shadow-glow"
      : "glass border border-white/10 text-foreground hover:bg-white/5";
  return (
    <Link to={to} className={`${base} ${styles}`}>
      <span className="size-9 rounded-xl bg-white/10 grid place-items-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </Link>
  );
}

function Welcome() {
  return (
    <PhoneFrame>
      <div className="min-h-screen flex flex-col px-6 pt-16 pb-10">
        <div className="mb-10">
          <Logo size="md" />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-[40px] leading-[1.05] font-semibold">
            Реальные{" "}
            <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3 pb-1 inline-block leading-[1.1]">
              встречи
            </span>{" "}
            рядом с тобой
          </h1>
          <p className="mt-4 text-muted-foreground">
            Собирай вечера, знакомься на событиях и находи свою компанию в городе.
          </p>
        </div>

        <div className="space-y-3 mt-8">
          <SocialBtn
            to="/auth/phone"
            variant="primary"
            icon={<Phone className="size-5" />}
            label="Войти по номеру телефона"
          />
          <SocialBtn
            to="/auth/telegram"
            icon={<TelegramIcon className="size-5" />}
            label="Через Telegram"
          />
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/onboarding"
              className="glass border border-white/10 rounded-2xl py-3.5 inline-flex items-center justify-center gap-2 font-medium hover:bg-white/5 transition"
            >
              <GoogleIcon className="size-5" />
              Google
            </Link>
            <Link
              to="/onboarding"
              className="glass border border-white/10 rounded-2xl py-3.5 inline-flex items-center justify-center gap-2 font-medium hover:bg-white/5 transition"
            >
              <YandexIcon className="size-5" />
              Яндекс
            </Link>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground text-center px-4">
          Продолжая, ты соглашаешься с{" "}
          <span className="underline">условиями использования</span> и{" "}
          <span className="underline">политикой конфиденциальности</span>
        </p>
      </div>
    </PhoneFrame>
  );
}
