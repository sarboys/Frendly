import { Link } from "@tanstack/react-router";

type Size = "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, { mark: string; text: string; gap: string; monogram: string }> = {
  sm: { mark: "size-8", text: "text-[22px]", gap: "gap-2", monogram: "text-[18px]" },
  md: { mark: "size-11", text: "text-[30px]", gap: "gap-2.5", monogram: "text-[24px]" },
  lg: { mark: "size-16", text: "text-[50px]", gap: "gap-3.5", monogram: "text-[36px]" },
  xl: { mark: "size-24", text: "text-[72px]", gap: "gap-4", monogram: "text-[54px]" },
};

/**
 * Frendly logo — glossy 3D lime squircle with purple italic "Fr" monogram,
 * paired with a chunky glassy purple wordmark. Inspired by neon/3D render style.
 */
export function LogoMark({ size = "md", className = "" }: { size?: Size; className?: string }) {
  const s = sizes[size];
  return (
    <span
      className={
        "relative inline-grid place-items-center rounded-[32%] overflow-hidden " +
        s.mark + " " + className
      }
      aria-hidden
      style={{
        boxShadow:
          "0 0 24px -2px color-mix(in oklab, var(--color-lime) 70%, transparent), " +
          "0 12px 28px -8px rgba(0,0,0,.55), " +
          "inset 0 2px 0 rgba(255,255,255,.55), " +
          "inset 0 -6px 14px -4px rgba(0,0,0,.35)",
      }}
    >
      {/* base gradient — bright lime with glassy depth */}
      <span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 90% at 30% 20%, color-mix(in oklab, var(--color-lime) 100%, white 50%) 0%, var(--color-lime) 50%, color-mix(in oklab, var(--color-lime) 65%, black 35%) 100%)",
        }}
      />
      {/* top glossy highlight */}
      <span
        className="absolute inset-x-[6%] top-[5%] h-[42%] rounded-[50%]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,.7) 0%, rgba(255,255,255,.15) 70%, transparent 100%)",
          filter: "blur(2px)",
        }}
      />
      {/* inner ring stroke */}
      <span
        className="absolute inset-[5%] rounded-[28%] pointer-events-none"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,.35), inset 0 -10px 18px -8px rgba(0,0,0,.4)",
        }}
      />
      {/* monogram "Fr" — purple italic, embossed */}
      <span
        className={"relative leading-none tracking-[-0.05em] " + s.monogram}
        style={{
          fontFamily: '"Instrument Serif", "Playfair Display", Georgia, serif',
          fontStyle: "italic",
          fontWeight: 400,
          color: "#6b3df5",
          background:
            "linear-gradient(180deg, #a78bfa 0%, #7c4dfb 45%, #4c1d95 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow:
            "0 1px 0 rgba(255,255,255,.4), 0 2px 6px rgba(76,29,149,.5)",
          transform: "translateY(-2%)",
        }}
      >
        Fr
      </span>
      {/* specular dot */}
      <span
        className="absolute size-2 rounded-full bg-white/90"
        style={{ top: "12%", left: "22%", filter: "blur(1.5px)" }}
      />
    </span>
  );
}

export function Logo({
  size = "md",
  to,
  className = "",
  showMark = true,
}: {
  size?: Size;
  to?: string;
  className?: string;
  showMark?: boolean;
}) {
  const s = sizes[size];

  const inner = (
    <span className={"inline-flex items-center " + s.gap + " " + className}>
      {showMark && <LogoMark size={size} />}
      <span
        className={"relative font-semibold tracking-[-0.04em] leading-none " + s.text}
        style={{
          fontFamily: '"Sora", "Nunito", "Plus Jakarta Sans", system-ui, sans-serif',
          background:
            "linear-gradient(180deg, #c4b5fd 0%, #8b5cf6 40%, #6d28d9 70%, #4c1d95 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextStroke: "0.5px rgba(167,139,250,.35)",
          textShadow:
            "0 1px 0 rgba(255,255,255,.25), 0 0 18px rgba(139,92,246,.45), 0 2px 6px rgba(76,29,149,.35)",
          filter: "drop-shadow(0 4px 10px rgba(124,77,251,.35))",
        }}
      >
        frendly
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} aria-label="Frendly">
        {inner}
      </Link>
    );
  }
  return inner;
}
