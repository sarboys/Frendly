import { useSyncExternalStore } from "react";
import { toast } from "sonner";

export type TokenTx = {
  id: string;
  title: string;
  amount: number; // negative = spend, positive = top up
  when: string;
  kind: "spend" | "topup" | "reward";
};

type State = { balance: number; tx: TokenTx[] };

const KEY = "frendly.tokens.v1";
const INITIAL: State = {
  balance: 240,
  tx: [
    { id: "i1", title: "Стартовый бонус", amount: 100, when: "Сегодня", kind: "reward" },
    { id: "i2", title: "Пополнение · 199 ₽", amount: 100, when: "Вчера", kind: "topup" },
    { id: "i3", title: "Super-like · Нина", amount: -5, when: "Вчера", kind: "spend" },
    { id: "i4", title: "Буст встречи «Винил-вечер»", amount: -50, when: "12 мая", kind: "spend" },
    { id: "i5", title: "Cashback за встречу", amount: 15, when: "10 мая", kind: "reward" },
  ],
};

function load(): State {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as State;
    if (typeof parsed.balance !== "number" || !Array.isArray(parsed.tx)) return INITIAL;
    return parsed;
  } catch {
    return INITIAL;
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getSnap = () => state;
const getServerSnap = () => INITIAL;

function pushTx(t: Omit<TokenTx, "id" | "when">) {
  state = {
    balance: state.balance + t.amount,
    tx: [{ id: Math.random().toString(36).slice(2), when: "только что", ...t }, ...state.tx].slice(0, 50),
  };
  persist();
}

export function useTokens() {
  const s = useSyncExternalStore(subscribe, getSnap, getServerSnap);
  return {
    balance: s.balance,
    tx: s.tx,
    spend(amount: number, title: string): boolean {
      if (state.balance < amount) {
        toast.error("Недостаточно токенов", {
          description: `Нужно ${amount} FT, у тебя ${state.balance}. Пополни кошелёк.`,
        });
        return false;
      }
      pushTx({ title, amount: -Math.abs(amount), kind: "spend" });
      toast.success(`−${amount} FT · ${title}`, {
        description: `Баланс: ${state.balance} FT`,
      });
      return true;
    },
    topUp(amount: number, title = "Пополнение") {
      pushTx({ title, amount: Math.abs(amount), kind: "topup" });
      toast.success(`+${amount} FT`, { description: title });
    },
    reward(amount: number, title: string) {
      pushTx({ title, amount: Math.abs(amount), kind: "reward" });
      toast(`🎁 +${amount} FT`, { description: title });
    },
  };
}
