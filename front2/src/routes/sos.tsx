import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ChevronLeft, PhoneCall, MapPin, Bell, Users, ShieldCheck, Share2, Clock, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/sos")({
  head: () => ({ meta: [{ title: "SOS — Frendly" }] }),
  component: SOSPage,
});

const initialContacts = [
  { name: "Мама", phone: "+7 ··· 21" },
  { name: "Аня (подруга)", phone: "+7 ··· 04" },
];

function SOSPage() {
  const [pressed, setPressed] = useState(false);
  const [contacts, setContacts] = useState(initialContacts);
  const [checkIn, setCheckIn] = useState(true);

  const onSosUp = () => {
    if (pressed) toast.success("SOS отправлен · контакты оповещены", { description: "Геолокация передана" });
    setPressed(false);
  };

  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/profile" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Безопасность</span>
        <span className="size-11" />
      </header>

      <section className="px-5 mt-6 flex flex-col items-center text-center">
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Удерживай кнопку 3 секунды — отправим геолокацию и оповестим контакты
        </p>

        <button
          onMouseDown={()=>setPressed(true)}
          onMouseUp={onSosUp}
          onMouseLeave={()=>setPressed(false)}
          onTouchStart={()=>setPressed(true)}
          onTouchEnd={onSosUp}
          className="relative mt-6 size-56 rounded-full bg-pink-gradient text-pink-foreground grid place-items-center shadow-glow active:scale-95 transition"
        >
          <span className={`absolute inset-0 rounded-full bg-pink ${pressed ? "" : "radar-ping"}`} />
          <span className={`absolute inset-3 rounded-full bg-pink ${pressed ? "" : "radar-ping"}`} style={{animationDelay:"0.6s"}} />
          <div className="relative z-10 text-center">
            <p className="text-4xl font-bold">SOS</p>
            <p className="text-xs opacity-80 mt-1">Удерживай</p>
          </div>
        </button>

        {pressed && (
          <p className="mt-4 text-sm text-lime font-semibold animate-pulse">Отправляем…</p>
        )}
      </section>

      <section className="px-5 mt-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Быстрые действия</p>
        <div className="grid grid-cols-2 gap-2">
          <Action icon={<PhoneCall className="size-5 text-pink" />} title="Позвонить 112" onClick={() => toast("Открываем номер 112")} />
          <Action icon={<MapPin className="size-5 text-lime" />} title="Поделиться локацией" onClick={() => toast.success("Локация отправлена контактам")} />
          <Action icon={<Bell className="size-5 text-lilac" />} title="Тревожный сигнал" onClick={() => toast.error("Сигнал отправлен в Frendly Care")} />
          <Action icon={<Users className="size-5 text-lime" />} title="Оповестить контакты" onClick={() => toast.success("Контакты получили уведомление")} />
        </div>
      </section>

      <section className="px-5 mt-6">
        <div className="flex items-end justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Доверенные контакты</p>
          <button
            onClick={() => toast("Откроем выбор из контактов")}
            className="text-xs text-lime font-semibold"
          >+ Добавить</button>
        </div>
        <div className="mt-2 rounded-2xl glass border border-white/10 divide-y divide-white/5 overflow-hidden">
          {contacts.map((c) => (
            <div key={c.name} className="flex items-center gap-3 px-4 py-3">
              <div className="size-9 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center font-bold">{c.name[0]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">{c.phone}</p>
              </div>
              <button
                onClick={() => {
                  setContacts((cs) => cs.filter((x) => x.name !== c.name));
                  toast(`${c.name} удалён из доверенных`);
                }}
                className="text-muted-foreground"
              ><X className="size-4" /></button>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 mt-6">
        <div className="rounded-3xl glass border border-white/10 p-4 flex items-center gap-3">
          <Clock className="size-5 text-lime" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Чек-ин на встрече</p>
            <p className="text-[11px] text-muted-foreground">Напомним через 2 часа, всё ли ок</p>
          </div>
          <button
            type="button"
            onClick={() => setCheckIn((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checkIn ? "bg-lime-gradient" : "bg-white/15"}`}
            aria-pressed={checkIn}
          >
            <span className={`size-4 rounded-full bg-background transition ${checkIn ? "ml-auto mr-1" : "ml-1"}`} />
          </button>
        </div>
        <Link to="/verify" className="mt-2 rounded-3xl glass border border-white/10 p-4 flex items-center gap-3">
          <ShieldCheck className="size-5 text-lime" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Верификация профиля</p>
            <p className="text-[11px] text-muted-foreground">Подними доверие — больше встреч</p>
          </div>
          <Share2 className="size-4 text-muted-foreground" />
        </Link>
      </section>

      <div className="h-12" />
    </PhoneFrame>
  );
}

function Action({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl glass border border-white/10 p-3 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition">
      <span className="size-10 rounded-xl bg-white/5 grid place-items-center">{icon}</span>
      <span className="text-sm font-semibold">{title}</span>
    </button>
  );
}
