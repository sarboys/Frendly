import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Logo, LogoMark } from "@/components/dateasy/Logo";

export const Route = createFileRoute("/splash")({ component: Splash });

function Splash() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <PhoneFrame>
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-8 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-lime-gradient blur-2xl opacity-50 radar-ping" />
            <LogoMark size="xl" className="relative shadow-glow" />
          </div>
          <div className="text-center">
            <Logo size="lg" showMark={false} />
            <p className="text-sm text-muted-foreground mt-3 tracking-wide">встречайся · собирай вечера</p>
          </div>
          <div className="mt-8">
            {ready ? (
              <Link
                to="/welcome"
                className="rounded-full bg-lime-gradient text-lime-foreground font-semibold px-8 py-3 shadow-glow inline-block"
              >
                Продолжить
              </Link>
            ) : (
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-2 rounded-full bg-foreground/40 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
