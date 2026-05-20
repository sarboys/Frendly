import type { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[420px] min-h-screen bg-hero relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full blur-3xl opacity-40 bg-lime-gradient" />
      <div className="pointer-events-none absolute top-40 -right-24 size-72 rounded-full blur-3xl opacity-30 bg-pink-gradient" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
