"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getPlan } from "@/lib/history";
import type { Plan } from "@/lib/types";

const LINKS = [
  { href: "/interview", label: "Practice" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pricing", label: "Pricing" },
];

export function Nav() {
  const pathname = usePathname();
  const [plan, setPlanState] = useState<Plan>("free");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setPlanState(getPlan());
    sync();
    window.addEventListener("ais-plan", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ais-plan", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#05060f]/60 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-lg shadow-[0_0_24px_-4px_rgb(168_85_247/0.9)] transition group-hover:rotate-6">
            🎙️
          </span>
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
            Interview<span className="neon-text">AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                pathname.startsWith(l.href) ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span
            data-testid="plan-badge"
            className={`chip ${plan === "pro" ? "border-amber-300/40 bg-amber-300/10 text-amber-200" : ""}`}
          >
            {plan === "pro" ? "★ Pro" : "Free plan"}
          </span>
          <Link href="/interview" className="btn-neon hidden !px-4 !py-2 text-sm sm:inline-flex">
            Start interview
          </Link>
          <button className="btn-ghost !px-3 !py-2 md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            ☰
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-white/5 px-5 pb-4 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-white/80 hover:bg-white/5">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
