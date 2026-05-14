export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 320 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full text-foreground"
      role="img"
      aria-label="Dumbbell"
    >
      {/* Left outer plate */}
      <rect x="16" y="24" width="20" height="72" rx="5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
      {/* Left inner plate */}
      <rect x="40" y="34" width="14" height="52" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
      {/* Bar */}
      <rect x="54" y="52" width="212" height="16" rx="4" fill="currentColor" fillOpacity="0.15" />
      {/* Right inner plate */}
      <rect x="266" y="34" width="14" height="52" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
      {/* Right outer plate */}
      <rect x="284" y="24" width="20" height="72" rx="5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
      {/* Grip knurling marks */}
      <line x1="130" y1="55" x2="130" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="144" y1="55" x2="144" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="158" y1="55" x2="158" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="172" y1="55" x2="172" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="186" y1="55" x2="186" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}
