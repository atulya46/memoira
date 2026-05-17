"use client";

interface Props {
  message?: string;
  /** Fills the full screen with a paper-themed overlay */
  overlay?: boolean;
}

export default function MemoiraLoader({ message = "Loading", overlay = false }: Props) {
  const inner = (
    <div
      className="relative flex flex-col items-center gap-5"
      style={{ animation: "memoira-float 2.4s ease-in-out infinite" }}
    >
      <svg width="118" height="104" viewBox="0 0 118 104" fill="none" aria-hidden="true">
        <path
          d="M22 20 C22 20 38 14 59 18 C80 14 96 20 96 20 L96 82 C96 82 80 76 59 80 C38 76 22 82 22 82 Z"
          stroke="#8b5e3c"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="260"
          style={{ animation: "memoira-draw 1.6s ease-in-out infinite alternate" }}
        />
        <path d="M59 18 L59 80" stroke="#8b5e3c" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
        <path d="M32 35 C39 32 47 32 53 34" stroke="#8b5e3c" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
        <path d="M32 47 C39 44 47 44 53 46" stroke="#8b5e3c" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
        <path d="M65 34 C73 32 81 32 88 35" stroke="#8b5e3c" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
        <path d="M65 46 C73 44 81 44 88 47" stroke="#8b5e3c" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
        <path d="M18 11 L20 16 L25 18 L20 20 L18 25 L16 20 L11 18 L16 16 Z" stroke="#8b5e3c" strokeWidth="1.4" strokeLinejoin="round" opacity="0.65" />
        <path d="M101 9 L103 14 L108 16 L103 18 L101 23 L99 18 L94 16 L99 14 Z" stroke="#8b5e3c" strokeWidth="1.4" strokeLinejoin="round" opacity="0.45" />
      </svg>

      <div className="text-center space-y-2">
        <p className="font-[family-name:var(--font-caveat)] text-3xl font-bold" style={{ color: "#3a2510" }}>
          {message}
        </p>
        <div className="flex justify-center gap-2 pt-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: "#8b5e3c",
                animation: `memoira-dot 0.9s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
        style={{ background: "linear-gradient(160deg, #f8f0df 0%, #f0e6ce 50%, #e8dcc8 100%)" }}
      >
        {inner}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {inner}
    </div>
  );
}
