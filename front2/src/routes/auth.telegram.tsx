import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Send } from "lucide-react";
import { useState } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";

export const Route = createFileRoute("/auth/telegram")({ component: TelegramAuth });

function TelegramAuth() {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  return (
    <PhoneFrame>
      <div className="min-h-screen flex flex-col px-5 pt-12 pb-10">
        <button
          onClick={() => window.history.back()}
          className="size-11 rounded-2xl glass border border-white/10 grid place-items-center"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="size-24 rounded-[2rem] bg-[oklch(0.65_0.16_240)] grid place-items-center shadow-glow">
            <Send className="size-12 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold">Вход через Telegram</h1>
          <p className="mt-3 text-muted-foreground max-w-xs">
            Открой Telegram-бот @FrendlyAppBot и нажми «Войти». Затем введи код из бота.
          </p>

          <button
            onClick={() => setSent(true)}
            className="mt-8 rounded-2xl bg-lime-gradient text-lime-foreground font-semibold px-8 py-4 shadow-glow"
          >
            Открыть Telegram
          </button>

          {sent && (
            <div className="mt-8 w-full">
              <p className="text-sm text-muted-foreground mb-3">Введи 6-значный код из бота</p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full glass border border-white/10 rounded-2xl px-4 py-4 text-center text-xl tracking-[0.4em] outline-none focus:border-primary"
              />
              <button
                disabled={code.length < 6}
                onClick={() => navigate({ to: "/onboarding" })}
                className="mt-4 w-full rounded-2xl bg-lime-gradient text-lime-foreground font-semibold py-4 shadow-glow disabled:opacity-40 disabled:shadow-none"
              >
                Подтвердить
              </button>
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
