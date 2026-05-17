export function PlanShareIllustration() {
  return (
    <svg
      viewBox="0 0 80 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full text-foreground"
      role="img"
      aria-label="Share training plan"
    >
      {/* Center node (plan document) */}
      <rect
        x="30"
        y="22"
        width="20"
        height="24"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <line
        x1="34"
        y1="29"
        x2="46"
        y2="29"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="34"
        y1="34"
        x2="46"
        y2="34"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="34"
        y1="39"
        x2="41"
        y2="39"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Left person */}
      <circle
        cx="12"
        cy="20"
        r="7"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M5 38 Q5 32 12 32 Q19 32 19 38"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Right-top person */}
      <circle
        cx="68"
        cy="14"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M62 28 Q62 23 68 23 Q74 23 74 28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Right-bottom person */}
      <circle
        cx="68"
        cy="50"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M62 64 Q62 59 68 59 Q74 59 74 64"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Connection lines */}
      <line
        x1="19"
        y1="28"
        x2="30"
        y2="32"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        opacity="0.5"
      />
      <line
        x1="50"
        y1="28"
        x2="62"
        y2="18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        opacity="0.5"
      />
      <line
        x1="50"
        y1="38"
        x2="62"
        y2="48"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        opacity="0.5"
      />
    </svg>
  );
}
