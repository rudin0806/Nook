import Link from "next/link";

/** The one place the mark is built. It was previously written out at six call
 * sites, three of which still carried a lowercase "nook" and a coloured full
 * stop, which is how the dot kept coming back. Do not inline it again.
 *
 * The mark is "Nook": SUIT 800, ink only, no dot and no other ornament. The
 * wide half is scaled because SUIT has a weight axis but no width axis.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      className={className ? `app-wordmark ${className}` : "app-wordmark"}
      href="/"
      aria-label="Nook 홈"
    >
      <span className="logo-n">N</span>
      <span className="logo-wide">ook</span>
    </Link>
  );
}
