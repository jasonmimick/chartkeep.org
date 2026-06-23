export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Back cover (stacked depth) */}
      <rect x="7" y="5" width="28" height="32" rx="3" fill="currentColor" opacity="0.2" />
      <rect x="5" y="3" width="28" height="32" rx="3" fill="currentColor" opacity="0.35" />

      {/* Front binder cover */}
      <rect x="3" y="1" width="28" height="32" rx="3" fill="currentColor" />

      {/* Spine strip */}
      <rect x="3" y="1" width="7" height="32" rx="3" fill="currentColor" opacity="0.5" />
      <rect x="7" y="1" width="3" height="32" fill="currentColor" opacity="0.5" />

      {/* Ring holes on spine */}
      <circle cx="6.5" cy="11" r="1.5" fill="white" opacity="0.6" />
      <circle cx="6.5" cy="17" r="1.5" fill="white" opacity="0.6" />
      <circle cx="6.5" cy="23" r="1.5" fill="white" opacity="0.6" />

      {/* ECG / pulse line on cover */}
      <path
        d="M13 17 L15.5 17 L17 13 L19 21 L21 17 L23.5 17 L25 17"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {/* Small heart below line */}
      <path
        d="M18.5 24.5 C18.5 24.5 16 22.5 16 21 C16 20 17 19.5 18.5 21 C20 19.5 21 20 21 21 C21 22.5 18.5 24.5 18.5 24.5Z"
        fill="white"
        opacity="0.75"
      />
    </svg>
  )
}
