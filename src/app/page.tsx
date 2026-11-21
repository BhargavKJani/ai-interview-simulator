import Link from "next/link";
import { Pricing } from "@/components/Pricing";
import { ROLES } from "@/lib/roles";

const FEATURES = [
  { icon: "🎙️", title: "Voice-first interviews", body: "The interviewer speaks each question aloud and transcribes your spoken answer in real time with the Web Speech API." },
  { icon: "🧠", title: "Claude-powered feedback", body: "Every answer is scored on clarity, depth and relevance, with strengths, fixes and a model answer outline." },
  { icon: "🎯", title: "Role & level specific", body: "Frontend, Android, Backend, Data, PM and HR rounds at junior, mid and senior difficulty." },
  { icon: "📊", title: "Report card", body: "A hire-signal verdict, grade, skill radar and question-by-question breakdown after every session." },
  { icon: "📈", title: "Progress dashboard", body: "Track score trends, streaks and per-role averages so you know exactly when you're ready." },
  { icon: "⚡", title: "No API key? No problem", body: "No API key? A built-in demo engine scores answers instantly so you can practise anywhere." },
];

const STEPS = [
  { n: "01", title: "Pick a role & level", body: "Choose from 6 tracks and 3 difficulty levels." },
  { n: "02", title: "Answer out loud", body: "Talk like the real thing, or type if you prefer." },
  { n: "03", title: "Get scored instantly", body: "See what landed, what didn't, and how to fix it." },
  { n: "04", title: "Level up", body: "Repeat, track progress, and walk in confident." },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
        <div className="animate-fade-up">
          <span className="chip mb-6">✨ Now with Claude Sonnet 5.5 · Free to start</span>
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Ace your next <span className="neon-text animate-shimmer">interview</span> with an AI that never sleeps.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/60">
            Realistic mock interviews by voice or text. Instant scores on clarity, depth and relevance. A report card and progress
            dashboard that show you exactly what to fix.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/interview" className="btn-neon px-8 py-4 text-lg" data-testid="hero-cta">Start free interview →</Link>
            <Link href="#pricing" className="btn-ghost px-6 py-4">See pricing</Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-8 text-sm text-white/50">
            <div><b className="block font-[family-name:var(--font-display)] text-2xl text-white">6</b>role tracks</div>
            <div><b className="block font-[family-name:var(--font-display)] text-2xl text-white">3</b>scoring dimensions</div>
            <div><b className="block font-[family-name:var(--font-display)] text-2xl text-white">₹0</b>to get started</div>
          </div>
        </div>

        {/* Mock interview preview */}
        <div className="animate-fade-up relative [animation-delay:150ms]">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-pink-500/20 blur-2xl" />
          <div className="glass-strong relative p-6">
            <div className="flex items-center gap-4">
              <div className="animate-pulse-ring grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-xl">🤖</div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">AI Interviewer · Frontend · Mid</p>
                <div className="mt-1 flex gap-0.5">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i} className="animate-wave h-4 w-1 origin-bottom rounded bg-cyan-300/80" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-5 font-[family-name:var(--font-display)] text-xl font-semibold">
              “How does React decide when to re-render a component, and how would you avoid unnecessary renders?”
            </p>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
              React re-renders when state, props or context change. First, I&apos;d profile with React DevTools, then memoise expensive
              children with <code className="text-cyan-300">React.memo</code> and stabilise callbacks with <code className="text-cyan-300">useCallback</code>…
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[["Clarity", 8.4], ["Depth", 7.6], ["Relevance", 9.1]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-white/5 p-3">
                  <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-emerald-300">{v}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Roles marquee */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="flex flex-wrap justify-center gap-3">
          {ROLES.map((r) => (
            <span key={r.id} className="chip !px-4 !py-2 !text-sm">{r.icon} {r.title}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center font-[family-name:var(--font-display)] text-4xl font-bold">
          Everything you need to <span className="neon-text">get hired</span>
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass group p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-300/30">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-2xl transition group-hover:scale-110">{f.icon}</div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-white/55">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center font-[family-name:var(--font-display)] text-4xl font-bold">How it works</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="glass p-6">
              <span className="neon-text font-mono text-3xl font-bold">{s.n}</span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-white/55">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-16">
        <h2 className="mb-10 text-center font-[family-name:var(--font-display)] text-4xl font-bold">
          Free to start. <span className="neon-text">₹399</span> to go all-in.
        </h2>
        <Pricing compact />
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 py-20">
        <div className="glass-strong relative overflow-hidden p-10 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-pink-500/10" />
          <h2 className="relative font-[family-name:var(--font-display)] text-3xl font-bold sm:text-4xl">Your next interview is closer than you think.</h2>
          <p className="relative mt-3 text-white/60">Practise for 10 minutes a day. Walk in calm.</p>
          <Link href="/interview" className="btn-neon relative mt-8 px-8 py-4 text-lg">Start practising — it&apos;s free</Link>
        </div>
      </section>
    </>
  );
}
