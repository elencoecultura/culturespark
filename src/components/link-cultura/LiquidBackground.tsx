import type { ReactNode } from "react";

export default function LiquidBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-aurora">
      {/* Ambient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full opacity-70 blur-3xl blob-anim"
        style={{ background: "radial-gradient(circle, #6ad1e3 0%, transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-40 h-[460px] w-[460px] rounded-full opacity-60 blur-3xl blob-anim"
        style={{ background: "radial-gradient(circle, #e451f5 0%, transparent 65%)", animationDelay: "-4s" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-160px] left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-55 blur-3xl blob-anim"
        style={{ background: "radial-gradient(circle, #7d7dff 0%, transparent 65%)", animationDelay: "-8s" }}
      />
      {/* Noise overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
