import type { ReactNode } from "react";

/** The one heading block every screen uses.
 *
 * Each page used to write its own: the drawer ran the browser's default h1
 * against an unsized subtitle, the account panel sat at 24px, the policies at
 * 34/26 and the example screen at 38 — so no two screens ranked their text the
 * same way. The scale lives in CSS on these three classes; pages pass content.
 *
 * A subtitle takes no full stop. It is a label, not a sentence.
 */
export function PageHeading({
  kicker,
  title,
  subtitle,
  as: Tag = "h1",
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The account panel's heading is not the page's first heading. */
  as?: "h1" | "h2";
  /** Anything that belongs with the heading, such as an effective date. */
  children?: ReactNode;
}) {
  return (
    <div className="desk-heading">
      {kicker ? <p className="preview-kicker">{kicker}</p> : null}
      <Tag className="desk-greeting">{title}</Tag>
      {subtitle ? <p className="desk-intro">{subtitle}</p> : null}
      {children}
    </div>
  );
}
