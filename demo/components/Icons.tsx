/**
 * Minimal inline icons — DESIGN.md §4 items 4 and 6 call for muted 16px glyphs,
 * and the placeholder text labels read as unfinished.
 *
 * Inline SVG rather than an icon package: four glyphs do not justify a dependency,
 * and `currentColor` means they inherit the token colour of whatever contains them.
 */

type Props = { size?: number; className?: string };

function Svg({
  size = 16,
  className,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconX(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 4l16 16M20 4L4 20" />
    </Svg>
  );
}

export function IconGitHub(props: Props) {
  return (
    <Svg {...props}>
      <path d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5a3 3 0 0 0-.9-2.3c3-.3 6.1-1.5 6.1-6.7A5.2 5.2 0 0 0 18.8 5a4.9 4.9 0 0 0-.1-3.6s-1.1-.3-3.7 1.4a12.6 12.6 0 0 0-6.6 0C5.8 1.1 4.7 1.4 4.7 1.4A4.9 4.9 0 0 0 4.6 5a5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.1 6.4 6.1 6.7a3 3 0 0 0-.9 2.3V21" />
    </Svg>
  );
}

export function IconDiscord(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0M14 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0" />
      <path d="M8.5 6.5c-2 .4-3.5 1.3-3.5 1.3C3.5 11 3 14.5 3.2 17.8c1.4 1 2.8 1.6 4.2 2l.9-1.5" />
      <path d="M15.5 6.5c2 .4 3.5 1.3 3.5 1.3 1.5 3.2 2 6.7 1.8 10-1.4 1-2.8 1.6-4.2 2l-.9-1.5" />
      <path d="M8.5 6.5 9 5c2-.4 4-.4 6 0l.5 1.5c-2.3-.5-4.7-.5-7 0" />
    </Svg>
  );
}

export function IconGlobe(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
    </Svg>
  );
}

export function IconPin(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}
