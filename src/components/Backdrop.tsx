export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="bg-grid absolute inset-0" />
      <div className="animate-float absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="animate-float-slow absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full bg-violet-600/20 blur-[130px]" />
      <div className="animate-float absolute -bottom-48 left-1/3 h-[480px] w-[480px] rounded-full bg-pink-500/15 blur-[120px]" />
    </div>
  );
}
