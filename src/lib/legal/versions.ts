/** Bump when the published text changes. The value is stored with each consent
 * record, so it must match the date shown on the documents themselves.
 */
export const TERMS_VERSION = "2026-09-19";
export const PRIVACY_VERSION = "2026-09-19";

/** A material change — a new collected field, a new purpose, a new processor, or
 * anything that puts the member at a disadvantage — cannot ride on the old
 * agreement. Set this to the version that introduced it, and everyone who
 * agreed to something older is asked again before they can go on.
 *
 * A wording fix or a new contact detail is not material: leave this alone and
 * the change is announced without blocking anyone.
 */
export const RECONSENT_REQUIRED_FROM = "2026-09-19";

export type Agreed = {
  terms_version: string;
  privacy_version: string;
} | null;

export type Published = {
  terms: string;
  privacy: string;
  reconsentFrom: string;
};

export const published: Published = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
  reconsentFrom: RECONSENT_REQUIRED_FROM,
};

/** Versions are ISO dates, so string order is chronological. Both the published
 * set and the agreement are arguments so the two outcomes can be exercised
 * without the module's own constants having to disagree with each other.
 */
export function consentOutcome(
  agreed: Agreed,
  current: Published = published,
): "ok" | "reconsent" | "notice" {
  if (!agreed) return "reconsent";
  if (
    agreed.terms_version < current.reconsentFrom ||
    agreed.privacy_version < current.reconsentFrom
  )
    return "reconsent";
  return agreed.terms_version !== current.terms ||
    agreed.privacy_version !== current.privacy
    ? "notice"
    : "ok";
}

export function needsReconsent(agreed: Agreed): boolean {
  return consentOutcome(agreed) === "reconsent";
}

export function hasUnseenChange(agreed: Agreed): boolean {
  return consentOutcome(agreed) === "notice";
}

/** What the dismissal of the non-blocking notice is keyed to, so a later
 * revision shows the notice again instead of staying dismissed forever. */
export const POLICY_NOTICE_VERSION = `${TERMS_VERSION}+${PRIVACY_VERSION}`;
