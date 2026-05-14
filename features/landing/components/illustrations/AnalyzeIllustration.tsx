export function AnalyzeIllustration() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full text-foreground"
      role="img"
      aria-label="AI form analysis"
    >
      {/* Scan corner brackets */}
      <path d="M8 20 L8 10 L18 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M72 20 L72 10 L62 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M8 60 L8 70 L18 70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M72 60 L72 70 L62 70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* Head */}
      <circle cx="40" cy="18" r="7" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" />
      {/* Torso */}
      <line x1="40" y1="25" x2="40" y2="46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {/* Arms reaching down (deadlift hinge) */}
      <line x1="40" y1="32" x2="24" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="32" x2="56" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Legs */}
      <line x1="40" y1="46" x2="28" y2="64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="46" x2="52" y2="64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Barbell */}
      <line x1="18" y1="50" x2="62" y2="50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="18" cy="50" r="5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" />
      <circle cx="62" cy="50" r="5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" />
    </svg>
  );
}
