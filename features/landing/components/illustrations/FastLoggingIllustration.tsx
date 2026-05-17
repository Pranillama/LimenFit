export function FastLoggingIllustration() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full text-foreground"
      role="img"
      aria-label="Fast logging stopwatch"
    >
      {/* Crown */}
      <rect x="32" y="10" width="16" height="5" rx="2.5" fill="currentColor" opacity="0.5" />
      {/* Button */}
      <circle cx="40" cy="10" r="3.5" fill="currentColor" opacity="0.7" />
      {/* Body */}
      <circle
        cx="40"
        cy="48"
        r="26"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="currentColor"
        fillOpacity="0.06"
      />
      {/* Tick marks */}
      <line
        x1="40"
        y1="24"
        x2="40"
        y2="28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="40"
        y1="68"
        x2="40"
        y2="72"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="16"
        y1="48"
        x2="14"
        y2="48"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="66"
        y1="48"
        x2="64"
        y2="48"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Minute hand */}
      <line
        x1="40"
        y1="48"
        x2="40"
        y2="32"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Second hand */}
      <line
        x1="40"
        y1="48"
        x2="55"
        y2="54"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Center */}
      <circle cx="40" cy="48" r="3" fill="currentColor" />
      {/* Checkmark */}
      <polyline
        points="52,64 56,69 65,59"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
