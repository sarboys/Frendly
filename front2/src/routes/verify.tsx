import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, Camera, ShieldCheck, Check, Smile, IdCard, Sparkles } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/verify")({
  head: () => ({ meta: [{ title: "Верификация — Dateasy" }] }),
  component: VerifyPage,
});

type Step = 0 | 1 | 2 | 3;

const poses = ["🙂 Прямо", "✌️ V знак", "👆 Палец вверх"];

function VerifyPage() {
  const [step, setStep] = useState<Step>(0);

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/profile" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Верификация</span>
        <span className="text-xs text-muted-foreground">{step + 1}/4</span>
      </header>

      <div className="px-5 mt-4 flex gap-1.5">
        {[0,1,2,3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-lime-gradient" : "bg-white/10"}`} />
        ))}
      </div>

      {step === 0 && (
        <section className="px-5 mt-8 text-center flex flex-col items-center">
          <div className="size-20 rounded-3xl bg-lime-gradient grid place-items-center shadow-glow">
            <ShieldCheck className="size-9 text-lime-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Подними доверие</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">
            Верифицированные профили получают на 3× больше мэтчей и приглашений на встречи
          </p>
          <ul className="mt-6 w-full space-y-2 text-left">
            {["Фото со специальной позой","Проверка документа (по желанию)","Подтверждение телефона","Получи синюю галочку"].map((t,i)=>(
              <li key={t} className="flex items-center gap-3 rounded-2xl glass border border-white/10 p-3">
                <span className="size-7 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center text-xs font-bold">{i+1}</span>
                <span className="text-sm">{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 1 && (
        <section className="px-5 mt-8 text-center flex flex-col items-center">
          <h1 className="text-2xl font-semibold">Селфи-челлендж</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">Повтори позу с экрана — это займёт 10 секунд</p>
          <div className="mt-6 relative size-64 rounded-full border-2 border-dashed border-lime/40 grid place-items-center">
            <Camera className="size-12 text-muted-foreground" />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-lime-gradient text-lime-foreground px-3 py-1 text-xs font-bold">{poses[1]}</span>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="px-5 mt-8 text-center flex flex-col items-center">
          <h1 className="text-2xl font-semibold">Документ <span className="text-sm text-muted-foreground">(опционально)</span></h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">Покажем только галочку «18+», скан не хранится</p>
          <div className="mt-6 w-full rounded-3xl border-2 border-dashed border-white/15 p-8 grid place-items-center">
            <IdCard className="size-12 text-muted-foreground" />
            <p className="mt-3 text-sm">Загрузить документ</p>
            <p className="text-[11px] text-muted-foreground">JPG, PNG · до 10 МБ</p>
          </div>
          <button className="mt-3 text-xs text-muted-foreground">Пропустить шаг</button>
        </section>
      )}

      {step === 3 && (
        <section className="px-5 mt-10 text-center flex flex-col items-center">
          <div className="size-24 rounded-full bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
            <Check className="size-12" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold">Готово</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">
            Проверка займёт до 2 часов. Пришлём пуш, как только дадим галочку
          </p>
          <div className="mt-6 w-full rounded-3xl glass border border-white/10 p-4 flex items-center gap-3">
            <Sparkles className="size-5 text-lime" />
            <p className="text-sm text-left">Подари себе <b>+7 дней Plus</b> бесплатно за прохождение</p>
          </div>
        </section>
      )}

      <div className="sticky bottom-0 mt-10 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        {step < 3 ? (
          <button onClick={()=>setStep((step+1) as Step)} className="w-full rounded-2xl bg-lime-gradient text-lime-foreground py-4 font-bold shadow-glow inline-flex items-center justify-center gap-2">
            {step === 0 ? "Начать" : step === 1 ? "Сделать селфи" : "Загрузить"}
          </button>
        ) : (
          <Link to="/profile" className="block w-full text-center rounded-2xl bg-lime-gradient text-lime-foreground py-4 font-bold shadow-glow">
            В профиль
          </Link>
        )}
      </div>
    </PhoneFrame>
  );
}
