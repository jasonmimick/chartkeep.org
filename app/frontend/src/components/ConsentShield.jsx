export default function ConsentShield({ size = 36, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>

      {/* Shield shadow layers for depth */}
      <path
        d="M20 37.5 C20 37.5 6.5 30 6.5 19 L6.5 8.5 L20 4 L33.5 8.5 L33.5 19 C33.5 30 20 37.5 20 37.5Z"
        fill="currentColor" opacity="0.12"
        transform="translate(1.5 1)"
      />

      {/* Shield body */}
      <path
        d="M20 36 C20 36 7 29 7 18 L7 8 L20 3.5 L33 8 L33 18 C33 29 20 36 20 36Z"
        fill="currentColor" opacity="0.25"
      />
      <path
        d="M20 34 C20 34 8.5 27.5 8.5 17.5 L8.5 9 L20 5 L31.5 9 L31.5 17.5 C31.5 27.5 20 34 20 34Z"
        fill="currentColor"
      />

      {/* Inner shield highlight (top edge bevel) */}
      <path
        d="M20 7 L30 10.5 L30 17.5 C30 26 20 31.5 20 31.5"
        stroke="white" strokeWidth="0.5" opacity="0.2" strokeLinecap="round"
      />

      {/* Medical cross — clean, centered */}
      <rect x="17.5" y="13" width="5" height="13" rx="1.5" fill="white" opacity="0.95" />
      <rect x="13.5" y="17" width="13" height="5" rx="1.5" fill="white" opacity="0.95" />

      {/* Subtle heartbeat pulse behind the cross */}
      <path
        d="M13 19.5 L15 19.5 L16.5 17 L18 22 L19.5 19.5 L21.5 19.5 L23 17 L24.5 22 L26 19.5 L27 19.5"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
        opacity="0.3"
      />

    </svg>
  )
}
