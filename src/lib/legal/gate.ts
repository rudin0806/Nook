import "server-only";
import { createSupabaseReaderClient } from "@/lib/supabase/reader";
import { consentOutcome } from "./versions";

export type ConsentState = "ok" | "reconsent" | "notice";

/** Signed-out visitors and unlinked visitors are not gated: they have nothing
 * recorded and nothing kept. A member whose agreement predates a material
 * change is stopped until they agree again; a member who has simply not seen a
 * minor revision is told, not blocked.
 */
export async function readConsentState(): Promise<ConsentState> {
  try {
    const supabase = await createSupabaseReaderClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return "ok";
    const consent = await supabase
      .from("consents")
      .select("terms_version,privacy_version")
      .maybeSingle();
    // A read that fails must not lock a member out of their own records.
    if (consent.error) return "ok";
    const agreed =
      consent.data &&
      typeof consent.data.terms_version === "string" &&
      typeof consent.data.privacy_version === "string"
        ? {
            terms_version: consent.data.terms_version,
            privacy_version: consent.data.privacy_version,
          }
        : null;
    return consentOutcome(agreed);
  } catch {
    return "ok";
  }
}
