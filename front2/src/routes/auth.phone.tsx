import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";

export const Route = createFileRoute("/auth/phone")({ component: PhoneAuth });

const countries = [
  { code: "+7", flag: "🇷🇺", name: "Россия" },
  { code: "+380", flag: "🇺🇦", name: "Украина" },
  { code: "+1", flag: "🇺🇸", name: "США" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
];

function PhoneAuth() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [country, setCountry] = useState(countries[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string[]>(["", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (step === "code" && code.every((c) => c !== "")) {
      const t = setTimeout(() => navigate({ to: "/onboarding" }), 600);
      return () => clearTimeout(t);
    }
  }, [code, step, navigate]);

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 3) inputs.current[i + 1]?.focus();
  }

  return (
    <PhoneFrame>
      <div className="min-h-screen flex flex-col px-5 pt-12 pb-10">
        <button
          onClick={() => (step === "code" ? setStep("phone") : window.history.back())}
          className="size-11 rounded-2xl glass border border-white/10 grid place-items-center"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="mt-10">
          <h1 className="text-3xl font-semibold">
            {step === "phone" ? "Введи номер телефона" : "Код из SMS"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {step === "phone"
              ? "Мы отправим SMS с кодом подтверждения"
              : `Отправили на ${country.code} ${phone}`}
          </p>
        </div>

        {step === "phone" ? (
          <div className="mt-8 space-y-4">
            <div className="glass border border-white/10 rounded-2xl flex items-center overflow-hidden">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center gap-2 px-4 py-4 border-r border-white/10"
              >
                <span className="text-xl">{country.flag}</span>
                <span className="font-medium">{country.code}</span>
                <ChevronDown className="size-4 opacity-70" />
              </button>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="999 123 45 67"
                className="flex-1 bg-transparent px-4 py-4 outline-none text-lg"
              />
            </div>

            {pickerOpen && (
              <div className="glass border border-white/10 rounded-2xl p-2 space-y-1">
                {countries.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCountry(c);
                      setPickerOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5"
                  >
                    <span className="text-xl">{c.flag}</span>
                    <span className="flex-1 text-left">{c.name}</span>
                    <span className="text-muted-foreground">{c.code}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              disabled={phone.length < 10}
              onClick={() => setStep("code")}
              className="w-full rounded-2xl bg-lime-gradient text-lime-foreground font-semibold py-4 shadow-glow disabled:opacity-40 disabled:shadow-none"
            >
              Получить код
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="flex justify-between gap-3">
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  className="size-16 rounded-2xl glass border border-white/10 text-center text-2xl font-semibold outline-none focus:border-primary"
                />
              ))}
            </div>
            <button className="text-sm text-muted-foreground underline mx-auto block">
              Отправить код снова
            </button>
          </div>
        )}

        <div className="flex-1" />
        <Link to="/auth/telegram" className="text-center text-sm text-muted-foreground">
          Войти через Telegram
        </Link>
      </div>
    </PhoneFrame>
  );
}
