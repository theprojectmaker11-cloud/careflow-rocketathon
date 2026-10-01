/**
 * One icon set, one import. Stroke-based, 24px grid, currentColor.
 * No icon library dependency, and no decorative icons — every name here
 * is chosen to carry meaning.
 */

const P: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.2 12 3l9 7.2" />
      <path d="M5 9.6V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.6" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2.5-7 4 14L16 12h5" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  chat: (
    <>
      <path d="M20 15.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </>
  ),
  send: (
    <>
      <path d="M4.5 12 20 4l-4 16-4.5-6.5z" />
      <path d="M11.5 13.5 20 4" />
    </>
  ),
  check: (
    <>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </>
  ),
  alert: (
    <>
      <path d="M10.6 4.2 2.9 17.5A1.5 1.5 0 0 0 4.2 20h15.6a1.5 1.5 0 0 0 1.3-2.5L13.4 4.2a1.5 1.5 0 0 0-2.8 0Z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 5.8v5.4c0 4.3 2.9 8.2 7 9.6 4.1-1.4 7-5.3 7-9.6V5.8z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </>
  ),
  pill: (
    <>
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M4.5 3h3M11.5 3h3" />
      <path d="M10 12v2.5a5.5 5.5 0 0 0 11 0V13" />
      <circle cx="20" cy="11" r="2" />
    </>
  ),
  heart: (
    <>
      <path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3C19.5 15.4 12 20 12 20Z" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12M18 6 6 18" />
    </>
  ),
  check_small: (
    <>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </>
  ),
  chevron_right: (
    <>
      <path d="m9.5 5 7 7-7 7" />
    </>
  ),
  chevron_down: (
    <>
      <path d="m5 9.5 7 7 7-7" />
    </>
  ),
  chevron_left: (
    <>
      <path d="m14.5 5-7 7 7 7" />
    </>
  ),
  arrow_left: (
    <>
      <path d="M20 12H4" />
      <path d="m10 6-6 6 6 6" />
    </>
  ),
  arrow_right: (
    <>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 17.5h6" />
      <path d="M9.8 20.5h4.4" />
      <path d="M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1-.9 1.7H9.3c0-.7-.3-1.2-.9-1.7A6 6 0 0 1 12 3Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  phone: (
    <>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3.5h10V9" />
      <path d="M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14.5h10v6H7z" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M4 12.5A8 8 0 0 0 17.7 17.7L20 15.5" />
      <path d="M20 20v-4.5h-4.5" />
    </>
  ),
  translate: (
    <>
      <path d="M3.5 6h8M7.5 4v2M9.8 6c0 4-2.6 7-6.3 8.3" />
      <path d="M5 10.6c1.2 2.4 3.2 4 5.6 4.8" />
      <path d="m12.5 20 4-10 4 10M14 17h5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 13.5h4l1.5 3h6l1.5-3h4" />
      <path d="M5.6 5.2 3.5 13.5v4a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4l-2.1-8.3a2 2 0 0 0-2-1.7H7.6a2 2 0 0 0-2 1.7Z" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 3.5s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z" />
    </>
  ),
};

export type IconName = keyof typeof P;

export function Icon({
  name,
  size = 18,
  className = "",
  strokeWidth = 1.6,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {P[name]}
    </svg>
  );
}

/** CareFlow mark: a shield-crest holding a pulse line. Trust + monitoring. */
export function Logo({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path
        d="M16 6.5 9.5 9v6.2c0 4.2 2.7 7.9 6.5 9.3 3.8-1.4 6.5-5.1 6.5-9.3V9z"
        fill="none"
        stroke="white"
        strokeWidth="1.7"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path
        d="M11.5 16.2h2.2l1.2-3.2 1.9 6 1.1-2.8h1.6"
        fill="none"
        stroke="white"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
