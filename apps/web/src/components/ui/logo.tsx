/** An original mark (nested diamonds in navy, cream and gold). Not the BIL logo. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label="BIL Knowledge Partner mark">
      <path d="M20 1.5 38.5 20 20 38.5 1.5 20Z" fill="#1b2a4e" stroke="#b87d0a" strokeWidth="1.5" />
      <path d="M20 8 32 20 20 32 8 20Z" fill="#f5f0ea" />
      <path d="M20 14.5 25.5 20 20 25.5 14.5 20Z" fill="#b87d0a" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={30} />
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-semibold tracking-tight">BIL Knowledge</span>
        <span className="block text-[11px] uppercase tracking-[0.14em] opacity-75">Partner</span>
      </span>
    </span>
  );
}
