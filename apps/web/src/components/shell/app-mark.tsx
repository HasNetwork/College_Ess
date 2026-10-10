import Image from "next/image";

/**
 * The app's mark: the icon itself, so it matches the Home Screen and looks the same in both
 * themes. A "C" drawn in `--primary` turned into a dark letter on light blue in dark mode.
 * Decorative by default, as the name "College Ess" is usually beside it. Unoptimised, so it
 * is the same file the service worker already holds.
 */
export function AppMark({ size = 32, alt = "" }: { size?: number; alt?: string }) {
  return (
    <Image
      src="/icon-192.png"
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-[var(--radius-md)] shadow-[var(--shadow-sm)]"
    />
  );
}
