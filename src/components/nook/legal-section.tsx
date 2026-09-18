"use client";
import { useId, type ReactNode } from "react";

/** One collapsible article of a policy.
 *
 * The privacy policy ran 5.5 screens of continuous scroll, which is how a
 * document that is actually specific ends up unread. Collapsed, the whole
 * policy is a list of its thirteen headings and the reader opens what they came
 * for.
 *
 * `<details>` rather than state: it opens without JavaScript, the heading stays
 * a real heading for a screen reader, and the browser handles the toggle.
 */
export function LegalSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const id = useId();
  return (
    <details className="legal-section" open={defaultOpen}>
      <summary>
        <h2 id={id}>{title}</h2>
        <span className="legal-section-mark" aria-hidden="true" />
      </summary>
      <div className="legal-section-body">{children}</div>
    </details>
  );
}
