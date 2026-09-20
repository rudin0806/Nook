import Link from "next/link";

/** The one place the mark is built. It was previously written out at six call
 * sites, three of which still carried a lowercase "nook" and a coloured full
 * stop, which is how the dot kept coming back. Do not inline it again.
 *
 * The mark is three leaning bars over "Nook" in SUIT 800. The wide half of the
 * word is scaled because SUIT has a weight axis but no width axis.
 *
 * Geometry and colour are measured from the supplied artwork (108×64), not
 * guessed. Each bar is 23×25 with a 7 corner radius, skewed 17° so the top
 * leans right, on a 26 pitch. Those numbers were fitted by rendering
 * candidates headless and comparing bounding boxes against the artwork: this
 * pair reproduces span 26 and height 25 per bar, the closest of the sweep.
 */
/** Degrees of lean, fitted against the artwork. */
const SKEW = 17;
const BARS = [
  { fill: "#6C6BF1", x: 2 },
  { fill: "#00C38B", x: 28 },
  { fill: "#FF831A", x: 54 },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      className={className ? `app-wordmark ${className}` : "app-wordmark"}
      href="/"
      aria-label="Nook 홈"
    >
      <svg
        className="logo-bars"
        viewBox="0 0 80 25"
        aria-hidden="true"
        focusable="false"
      >
        {BARS.map((bar) => (
          <rect
            key={bar.fill}
            x={bar.x}
            y="0"
            width="23"
            height="25"
            rx="7"
            fill={bar.fill}
            transform={`skewX(-${SKEW}) translate(${(25 * Math.tan((SKEW * Math.PI) / 180) - 2).toFixed(3)} 0)`}
          />
        ))}
      </svg>
      <span className="logo-word">
        <span className="logo-n">N</span>
        <span className="logo-wide">ook</span>
      </span>
    </Link>
  );
}
