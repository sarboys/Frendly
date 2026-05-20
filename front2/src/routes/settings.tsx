import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import {
  ChevronLeft, ChevronRight, Bell, Lock, Eye, Globe, MapPin, Wallet,
  CreditCard, ShieldAlert, HelpCircle, LogOut, Crown, Languages, Moon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useTokens } from "@/lib/tokens";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Настройки — Frendly" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { balance } = useTokens();
  const navigate = useNavigate();
  return (
    <PhoneFrame>
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link to="/profile" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Настройки</span>
        <span className="size-11" />
      </header>

      <Link to="/paywall" className="mx-5 mt-5 rounded-3xl p-4 bg-pink-gradient text-pink-foreground flex items-center gap-3 shadow-soft">
        <div className="size-11 rounded-2xl bg-background/20 grid place-items-center">
          <Crown className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Frendly Plus</p>
          <p className="text-xs opacity-80">Безлимит свайпов и приоритет</p>
        </div>
        <ChevronRight className="size-5" />
      </Link>

      <Group title="Аккаунт">
        <Row icon={<Lock className="size-4" />} label="Приватность" onClick={() => toast("Раздел в разработке")} />
        <Row icon={<Eye className="size-4" />} label="Видимость профиля" right="Все" onClick={() => toast("Видимость: Все")} />
        <Row icon={<MapPin className="size-4" />} label="Город" right="Москва" onClick={() => navigate({ to: "/city" })} />
        <Row icon={<Languages className="size-4" />} label="Язык" right="Русский" onClick={() => toast("Язык: Русский")} />
        <Row icon={<Lock className="size-4" />} label="Редактировать профиль" onClick={() => navigate({ to: "/profile/edit" })} />
      </Group>

      <Group title="Уведомления">
        <Row icon={<Bell className="size-4" />} label="Push" toggle defaultOn />
        <Row icon={<Bell className="size-4" />} label="Email" toggle />
        <Row icon={<Bell className="size-4" />} label="Мэтчи и встречи" toggle defaultOn />
      </Group>

      <Group title="Платежи">
        <Row icon={<Wallet className="size-4" />} label="Кошелёк" right={`${balance} FT`} onClick={() => navigate({ to: "/wallet" })} />
        <Row icon={<CreditCard className="size-4" />} label="Способы оплаты" onClick={() => toast("Карты подключаются в кошельке")} />
      </Group>

      <Group title="Безопасность">
        <Row icon={<ShieldAlert className="size-4" />} label="SOS и доверенные" onClick={() => navigate({ to: "/sos" })} />
        <Row icon={<ShieldAlert className="size-4" />} label="Верификация" right="Пройти" onClick={() => navigate({ to: "/verify" })} />
      </Group>

      <Group title="Помощь">
        <Row icon={<HelpCircle className="size-4" />} label="FAQ" onClick={() => toast("FAQ скоро")} />
        <Row icon={<Globe className="size-4" />} label="О Frendly" onClick={() => toast("Frendly · мок-версия")} />
        <Row icon={<Moon className="size-4" />} label="Тёмная тема" toggle defaultOn />
      </Group>

      <button
        onClick={() => { toast.success("Вышли из аккаунта"); navigate({ to: "/welcome" }); }}
        className="mx-5 mt-6 mb-10 w-[calc(100%-2.5rem)] rounded-2xl py-3.5 text-sm font-semibold text-destructive border border-destructive/30 inline-flex items-center justify-center gap-2"
      >
        <LogOut className="size-4" /> Выйти
      </button>
      <p className="text-center text-[11px] text-muted-foreground pb-10">v 1.0.0</p>
    </PhoneFrame>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 mt-6">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</p>
      <div className="rounded-2xl glass border border-white/10 divide-y divide-white/5 overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function Row({
  icon, label, right, toggle, defaultOn, onClick,
}: { icon: ReactNode; label: string; right?: string; toggle?: boolean; defaultOn?: boolean; onClick?: () => void }) {
  const [on, setOn] = useState(!!defaultOn);
  const content = (
    <>
      <div className="size-8 rounded-xl bg-white/5 grid place-items-center text-foreground">{icon}</div>
      <span className="flex-1 text-sm text-left">{label}</span>
      {toggle ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOn((v) => !v); }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? "bg-lime-gradient" : "bg-white/15"}`}
          aria-pressed={on}
        >
          <span className={`size-4 rounded-full bg-background transition ${on ? "ml-auto mr-1" : "ml-1"}`} />
        </button>
      ) : (
        <>
          {right && <span className="text-xs text-muted-foreground">{right}</span>}
          <ChevronRight className="size-4 text-muted-foreground" />
        </>
      )}
    </>
  );
  return toggle ? (
    <div className="flex items-center gap-3 px-4 py-3.5">{content}</div>
  ) : (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition">{content}</button>
  );
}
