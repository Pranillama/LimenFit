export function OfflineIllustration() {
  return (
    <svg
      viewBox="0 0 80 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full text-foreground"
      role="img"
      aria-label="Works offline"
    >
      {/* Phone outline */}
      <rect x="22" y="6" width="36" height="58" rx="6" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.06" />
      {/* Screen */}
      <rect x="26" y="12" width="28" height="44" rx="2" fill="currentColor" fillOpacity="0.08" />
      {/* Home indicator */}
      <rect x="34" y="59" width="12" height="2.5" rx="1.25" fill="currentColor" opacity="0.4" />
      {/* Wifi arcs on screen (faded = no signal) */}
      <path d="M30 30 Q40 22 50 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.2" />
      <path d="M33 34 Q40 28 47 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.25" />
      {/* Slash through wifi */}
      <line x1="30" y1="22" x2="50" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Checkmark badge bottom-right */}
      <circle cx="56" cy="56" r="11" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" />
      <polyline points="51,56 54,59 61,51" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
