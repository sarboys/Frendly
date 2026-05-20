import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/dateasy/BottomNav";
import {
  ArrowLeft, Sparkles, Calendar, Clock, MapPin, Users, Image as ImageIcon,
  Coffee, Music2, Dumbbell, Wine, Palette, Footprints, Globe, Lock, Zap, Coins,
  Ticket, Percent, Route as RouteIcon, Plus, X, Check, ShieldCheck, Crown,
  Gamepad2, BookOpen, Camera, Film, Pizza, Mountain, Bike, Heart,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTokens } from "@/lib/tokens";

export const Route = createFileRoute("/meetings/new")({
  head: () => ({
    meta: [
      { title: "Новая встреча — Frendly" },
      { name: "description", content: "Собери встречу за минуту: место, время и кого позвать." },
    ],
  }),
  component: NewMeetingPage,
});

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
function dayChipLabel(offset: number) {
  if (offset === 0) return "Сегодня";
  if (offset === 1) return "Завтра";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}
function formatDayLabel(offset: number) {
  if (offset === 0) return "Сегодня";
  if (offset === 1) return "Завтра";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}


const vibes = [
  { label: "Кофе", icon: Coffee },
  { label: "Музыка", icon: Music2 },
  { label: "Спорт", icon: Dumbbell },
  { label: "Бар", icon: Wine },
  { label: "Арт", icon: Palette },
  { label: "Прогулка", icon: Footprints },
  { label: "Гастро", icon: Pizza },
  { label: "Кино", icon: Film },
  { label: "Книги", icon: BookOpen },
  { label: "Фото", icon: Camera },
  { label: "Игры", icon: Gamepad2 },
  { label: "Outdoor", icon: Mountain },
  { label: "Вело", icon: Bike },
  { label: "Свидание", icon: Heart },
];

// mock catalogs
const afishaCategories = ["Все", "Музыка", "Бар", "Арт", "Стендап", "Спорт", "Кино"];
const afishaList: { id: string; title: string; sub: string; cat: string; dayOffset: number }[] = [
  { id: "a1", title: "Boris Brejcha · Live", sub: "22:00 · Adrenaline", cat: "Музыка", dayOffset: 3 },
  { id: "a2", title: "Stand-up open mic", sub: "20:00 · Stand-up Club", cat: "Стендап", dayOffset: 1 },
  { id: "a3", title: "Выставка «Свет»", sub: "до 22:00 · Винзавод", cat: "Арт", dayOffset: 0 },
  { id: "a4", title: "Vinyl night · soul", sub: "21:00 · Noor Bar", cat: "Музыка", dayOffset: 0 },
  { id: "a5", title: "Кино под открытым небом", sub: "20:30 · Парк Горького", cat: "Кино", dayOffset: 2 },
  { id: "a6", title: "Run club · 5K", sub: "8:00 · Лужники", cat: "Спорт", dayOffset: 4 },
  { id: "a7", title: "Гастро-маркет", sub: "12:00 · ВДНХ", cat: "Бар", dayOffset: 5 },
  { id: "a8", title: "Indie band showcase", sub: "19:00 · 16 тонн", cat: "Музыка", dayOffset: 7 },
  { id: "a9", title: "Импровизационный театр", sub: "20:00 · Импровизаторы", cat: "Стендап", dayOffset: 6 },
];
const promoList = [
  { id: "p1", title: "Brew Lab", sub: "−20% на фильтр · до 22:00" },
  { id: "p2", title: "Pink Mary", sub: "1+1 коктейли · среда" },
  { id: "p3", title: "Surf Coffee", sub: "−15% по Frendly" },
];
const routeList = [
  { id: "r1", title: "Патрики · вечерний круг", sub: "3.2 км · 4 точки" },
  { id: "r2", title: "Хитрый Замоскворецкий", sub: "5 км · 6 точек" },
  { id: "r3", title: "Гастро-крюк Китай-город", sub: "2.4 км · 5 точек" },
];
const placeList = [
  { id: "pl1", title: "Brew Lab", sub: "Цветной бульвар, 12 · 1.2 км" },
  { id: "pl2", title: "Surf Coffee · Патрики", sub: "Малая Бронная, 28 · 0.8 км" },
  { id: "pl3", title: "Pink Mary", sub: "Никитский б-р, 14 · 1.5 км" },
  { id: "pl4", title: "Энтузиаст бар", sub: "Столешников, 7 · 2.1 км" },
  { id: "pl5", title: "Хитрые люди", sub: "Покровка, 17 · 2.8 км" },
  { id: "pl6", title: "Чайная высота", sub: "Покровский б-р, 4 · 1.7 км" },
];

type Attached = { kind: "afisha" | "promo" | "route"; id: string; title: string; sub: string } | null;

// mock current user privileges
const ME = { verified: false, plus: false };

function NewMeetingPage() {
  const [vibe, setVibe] = useState("Кофе");
  const [visibility, setVisibility] = useState<"public" | "link">("public");
  const [boost, setBoost] = useState(false);
  const [date, setDate] = useState("2026-05-18");
  const [time, setTime] = useState("19:30");
  const [duration, setDuration] = useState("1.5");
  const [place, setPlace] = useState("Brew Lab, Патрики");
  const [address, setAddress] = useState("Цветной бульвар, 12");
  const [capacity, setCapacity] = useState(6);
  const [gender, setGender] = useState<"any" | "m" | "f">("any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [plusOnly, setPlusOnly] = useState(false);
  const [sheet, setSheet] = useState<null | "afisha" | "promo" | "route" | "place">(null);
  const [attached, setAttached] = useState<Attached>(null);
  const [afishaCat, setAfishaCat] = useState("Все");
  const [afishaDay, setAfishaDay] = useState<number | "all">("all");

  const { balance, spend } = useTokens();
  const navigate = useNavigate();

  const onPublish = () => {
    if (boost && !spend(50, "Буст встречи · 24ч")) return;
    toast.success("Встреча опубликована", {
      description: visibility === "public" ? "Появится в радаре рядом" : "Доступна по ссылке",
    });
    setTimeout(() => navigate({ to: "/meetings" }), 400);
  };

  const tryVerifiedOnly = (v: boolean) => {
    if (v && !ME.verified) {
      toast("Сначала пройди верификацию", {
        action: { label: "Верифицировать", onClick: () => navigate({ to: "/verify" }) },
      });
      return;
    }
    setVerifiedOnly(v);
  };
  const tryPlusOnly = (v: boolean) => {
    if (v && !ME.plus) {
      toast("Frendly+ доступен только подписчикам", {
        action: { label: "Оформить", onClick: () => navigate({ to: "/paywall" }) },
      });
      return;
    }
    setPlusOnly(v);
  };

  const filteredAfisha = afishaList.filter(a =>
    (afishaCat === "Все" || a.cat === afishaCat) &&
    (afishaDay === "all" || a.dayOffset === afishaDay)
  );
  const sheetData =
    sheet === "afisha" ? { title: "Прикрепить из афиши", list: filteredAfisha.map(a => ({ id: a.id, title: a.title, sub: `${formatDayLabel(a.dayOffset)} · ${a.sub}` })) } :
    sheet === "promo" ? { title: "Промо · заведения со скидками", list: promoList } :
    sheet === "route" ? { title: "Прикрепить маршрут", list: routeList } :
    sheet === "place" ? { title: "Выбери место встречи", list: placeList } : null;

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to="/meetings" className="size-11 rounded-2xl glass border border-white/10 grid place-items-center">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-display text-lg font-semibold">Новая встреча</span>
        <button className="size-11 rounded-2xl bg-lime-gradient text-lime-foreground grid place-items-center shadow-glow">
          <Sparkles className="size-5" />
        </button>
      </div>

      {/* Cover */}
      <div className="px-5 mt-5">
        <div className="relative h-44 rounded-3xl border border-dashed border-white/15 bg-surface/60 grid place-items-center overflow-hidden">
          <div className="absolute inset-0 bg-lime-gradient opacity-15" />
          <div className="relative flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="size-7" />
            <span className="text-sm">Добавить обложку</span>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="px-5 mt-5">
        <input
          defaultValue="Speciality coffee на Патриках"
          className="w-full bg-transparent outline-none text-[26px] font-semibold leading-tight placeholder:text-muted-foreground"
          placeholder="Название встречи"
        />
        <textarea
          rows={2}
          defaultValue="Дегустируем альт. способы, болтаем и идём гулять. Без снобства."
          className="mt-2 w-full bg-transparent outline-none text-sm text-muted-foreground resize-none"
          placeholder="Короткое описание"
        />
      </div>

      {/* Vibes */}
      <div className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Категория</p>
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {vibes.map(({ label, icon: Icon }) => {
            const on = vibe === label;
            return (
              <button
                key={label}
                onClick={() => setVibe(label)}
                className={
                  "shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium border transition " +
                  (on
                    ? "bg-lime-gradient text-lime-foreground border-transparent shadow-glow"
                    : "border-white/10 glass text-foreground/80")
                }
              >
                <Icon className="size-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Editable fields */}
      <div className="px-5 mt-5 space-y-2.5">
        <div className="rounded-2xl glass border border-white/10 p-3.5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-surface-2 grid place-items-center"><Calendar className="size-5 text-lime" /></div>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Когда</p>
              <div className="mt-1 flex gap-2">
                <input type="date" value={date} onChange={(e)=>setDate(e.target.value)}
                  className="flex-1 bg-surface-2/60 rounded-xl px-2 py-1.5 text-sm outline-none" />
                <input type="time" value={time} onChange={(e)=>setTime(e.target.value)}
                  className="w-24 bg-surface-2/60 rounded-xl px-2 py-1.5 text-sm outline-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl glass border border-white/10 p-3.5 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-surface-2 grid place-items-center"><Clock className="size-5 text-lime" /></div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Длительность</p>
            <div className="mt-1 inline-flex items-center gap-2">
              <input type="number" step="0.5" min="0.5" value={duration} onChange={(e)=>setDuration(e.target.value)}
                className="w-20 bg-surface-2/60 rounded-xl px-2 py-1.5 text-sm outline-none" />
              <span className="text-sm text-muted-foreground">часа</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSheet("place")}
          className="w-full rounded-2xl glass border border-white/10 p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition"
        >
          <div className="size-10 rounded-xl bg-surface-2 grid place-items-center"><MapPin className="size-5 text-lime" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Где</p>
            <p className="mt-0.5 text-sm font-semibold truncate">{place || "Выбрать место"}</p>
            <p className="text-[12px] text-muted-foreground truncate">{address || "Адрес подтянется из выбора"}</p>
          </div>
          <span className="text-[11px] rounded-full glass border border-white/10 px-2.5 py-1 text-muted-foreground">Сменить</span>
        </button>

        <div className="rounded-2xl glass border border-white/10 p-3.5 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-surface-2 grid place-items-center"><Users className="size-5 text-lime" /></div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Сколько людей</p>
            <div className="mt-1 inline-flex items-center gap-2">
              <button onClick={()=>setCapacity(c=>Math.max(2,c-1))} className="size-7 rounded-full bg-surface-2 grid place-items-center text-sm">−</button>
              <span className="text-sm font-semibold w-10 text-center">до {capacity}</span>
              <button onClick={()=>setCapacity(c=>Math.min(50,c+1))} className="size-7 rounded-full bg-surface-2 grid place-items-center text-sm">+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Attach */}
      <div className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Прикрепить</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <AttachBtn icon={Ticket} label="Афиша" onClick={() => setSheet("afisha")} active={attached?.kind==="afisha"} />
          <AttachBtn icon={Percent} label="Промо" onClick={() => setSheet("promo")} active={attached?.kind==="promo"} />
          <AttachBtn icon={RouteIcon} label="Маршрут" onClick={() => setSheet("route")} active={attached?.kind==="route"} />
        </div>
        {attached && (
          <div className="mt-2 rounded-2xl glass border border-lime/30 p-3 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center">
              {attached.kind === "afisha" ? <Ticket className="size-4" /> : attached.kind === "promo" ? <Percent className="size-4" /> : <RouteIcon className="size-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{attached.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{attached.sub}</p>
            </div>
            <button onClick={()=>setAttached(null)} className="size-8 rounded-full bg-surface-2 grid place-items-center"><X className="size-4" /></button>
          </div>
        )}
      </div>

      {/* Audience */}
      <div className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Кому доступно</p>
        <div className="mt-2 rounded-2xl glass border border-white/10 p-1 grid grid-cols-3 text-sm">
          {([["any","Любой"],["m","Парни"],["f","Девушки"]] as const).map(([k,label])=>(
            <button key={k} onClick={()=>setGender(k)}
              className={"h-9 rounded-xl font-medium transition " + (gender===k ? "bg-lime-gradient text-lime-foreground shadow-glow" : "text-muted-foreground")}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          <ToggleRow icon={ShieldCheck} label="Только верифицированные" sub="Прошли проверку Frendly" checked={verifiedOnly} onChange={tryVerifiedOnly} />
          <ToggleRow icon={Crown} label="Только Frendly+" sub="Подписчики премиум" checked={plusOnly} onChange={tryPlusOnly} />
        </div>
      </div>

      {/* Visibility */}
      <div className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Кто может видеть</p>
        <div className="relative rounded-full glass border border-white/10 p-1 grid grid-cols-2 text-sm">
          <span
            aria-hidden
            className={"absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-lime-gradient shadow-glow transition-all duration-300 " + (visibility === "public" ? "left-1" : "left-[calc(50%+0rem)]")}
          />
          <button
            onClick={() => setVisibility("public")}
            className={"relative z-10 h-10 rounded-full inline-flex items-center justify-center gap-2 font-semibold transition-colors " + (visibility === "public" ? "text-lime-foreground" : "text-muted-foreground")}
          >
            <Globe className="size-4" /> Все рядом
          </button>
          <button
            onClick={() => setVisibility("link")}
            className={"relative z-10 h-10 rounded-full inline-flex items-center justify-center gap-2 font-semibold transition-colors " + (visibility === "link" ? "text-lime-foreground" : "text-muted-foreground")}
          >
            <Lock className="size-4" /> По ссылке
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground px-1">
          {visibility === "public" ? "Появится в радаре у людей рядом" : "Видят только те, кому отправишь ссылку"}
        </p>
      </div>

      {/* Boost */}
      <button
        onClick={() => setBoost((b) => !b)}
        className={"mx-5 mt-5 rounded-3xl p-4 w-[calc(100%-2.5rem)] flex items-center gap-3 text-left transition " + (boost ? "bg-pink-gradient text-pink-foreground shadow-glow" : "glass border border-white/10")}
      >
        <div className={"size-10 rounded-2xl grid place-items-center " + (boost ? "bg-background/25" : "bg-surface-2")}>
          <Zap className={"size-5 " + (boost ? "" : "text-pink")} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Продвинуть встречу</p>
          <p className={"text-xs " + (boost ? "opacity-80" : "text-muted-foreground")}>Топ радара · 24 часа</p>
        </div>
        <span className={"rounded-full px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1 " + (boost ? "bg-background/25" : "bg-foreground text-background")}>
          <Coins className="size-3" /> 50 FT
        </span>
      </button>

      {/* CTA */}
      <div className="px-5 mt-6">
        <button
          onClick={onPublish}
          className="w-full rounded-2xl bg-lime-gradient text-lime-foreground py-4 text-base font-bold shadow-glow active:scale-[0.99] transition"
        >
          Опубликовать встречу{boost ? " · −50 FT" : ""}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Баланс: {balance} FT · <Link to="/wallet" className="text-lime underline">пополнить</Link>
        </p>
      </div>

      <BottomNav />
      <div className="h-32" />

      {/* Attach sheet */}
      {sheetData && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={()=>setSheet(null)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
          <div onClick={(e)=>e.stopPropagation()} className="relative w-full max-w-md mx-auto rounded-t-3xl bg-background border-t border-white/10 p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15 mb-4" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{sheetData.title}</h3>
              <button onClick={()=>setSheet(null)} className="size-9 rounded-full glass border border-white/10 grid place-items-center"><X className="size-4" /></button>
            </div>

            {sheet === "afisha" && (
              <div className="space-y-2 mb-3">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                  {([["all","Все"], ...Array.from({length: 11}, (_, i) => [i, dayChipLabel(i)] as const)] as const).map(([key, label]) => {
                    const on = afishaDay === key;
                    return (
                      <button
                        key={String(key)}
                        onClick={() => setAfishaDay(key as number | "all")}
                        className={"shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap border transition " + (on ? "bg-lime-gradient text-lime-foreground border-transparent font-semibold shadow-glow" : "glass border-white/10 text-foreground/80")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                  {afishaCategories.map(c => {
                    const on = afishaCat === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setAfishaCat(c)}
                        className={"shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap border transition " + (on ? "bg-foreground text-background border-transparent font-semibold" : "glass border-white/10 text-foreground/80")}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {sheetData.list.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Ничего не найдено · попробуй другой фильтр</p>
              )}
              {sheetData.list.map((it)=>(
                <button key={it.id}
                  onClick={()=>{
                    if (sheet === "place") {
                      setPlace(it.title);
                      setAddress(it.sub.split(" · ")[0] ?? "");
                      toast.success("Место выбрано");
                    } else if (sheet) {
                      setAttached({ kind: sheet, ...it });
                      toast.success("Прикреплено к встрече");
                    }
                    setSheet(null);
                  }}
                  className="w-full rounded-2xl glass border border-white/10 p-3 flex items-center gap-3 text-left active:scale-[0.99] transition">
                  <div className="size-10 rounded-xl bg-lime-gradient text-lime-foreground grid place-items-center">
                    {sheet==="afisha" ? <Ticket className="size-5" /> : sheet==="promo" ? <Percent className="size-5" /> : sheet==="route" ? <RouteIcon className="size-5" /> : <MapPin className="size-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{it.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{it.sub}</p>
                  </div>
                  <Plus className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

function AttachBtn({ icon: Icon, label, onClick, active }: { icon: any; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick}
      className={"rounded-2xl p-3 flex flex-col items-center gap-1.5 border transition " + (active ? "bg-lime-gradient text-lime-foreground border-transparent shadow-glow" : "glass border-white/10 text-foreground/80")}>
      <Icon className="size-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ToggleRow({ icon: Icon, label, sub, checked, onChange }: { icon: any; label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full rounded-2xl glass border border-white/10 p-3 flex items-center gap-3 text-left">
      <div className="size-10 rounded-xl bg-surface-2 grid place-items-center"><Icon className="size-5 text-lime" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      </div>
      <span className={"relative h-7 w-12 rounded-full transition " + (checked ? "bg-lime-gradient" : "bg-surface-2 border border-white/10")}>
        <span className={"absolute top-0.5 size-6 rounded-full bg-background shadow grid place-items-center transition-all " + (checked ? "left-[calc(100%-1.625rem)]" : "left-0.5")}>
          {checked && <Check className="size-3 text-lime" />}
        </span>
      </span>
    </button>
  );
}
