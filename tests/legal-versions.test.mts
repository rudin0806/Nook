import assert from "node:assert/strict";
import test from "node:test";
import {
  consentOutcome,
  hasUnseenChange,
  needsReconsent,
  published,
  type Published,
} from "../src/lib/legal/versions.ts";

// A published set where the documents have moved on since the material change.
const moved: Published = {
  terms: "2026-12-01",
  privacy: "2026-12-01",
  reconsentFrom: "2026-09-19",
};

test("someone who never agreed is stopped, not merely told", () => {
  assert.equal(consentOutcome(null, moved), "reconsent");
  assert.equal(needsReconsent(null), true);
  assert.equal(hasUnseenChange(null), false);
});

test("an agreement older than the material change is stopped", () => {
  const old = { terms_version: "2026-01-01", privacy_version: "2026-01-01" };
  assert.equal(consentOutcome(old, moved), "reconsent");
  // Either document being stale is enough on its own.
  assert.equal(
    consentOutcome(
      { terms_version: "2026-12-01", privacy_version: "2026-01-01" },
      moved,
    ),
    "reconsent",
  );
  assert.equal(
    consentOutcome(
      { terms_version: "2026-01-01", privacy_version: "2026-12-01" },
      moved,
    ),
    "reconsent",
  );
});

test("a minor revision since the agreement is announced, not blocking", () => {
  assert.equal(
    consentOutcome(
      { terms_version: "2026-09-19", privacy_version: "2026-09-19" },
      moved,
    ),
    "notice",
  );
  assert.equal(
    consentOutcome(
      { terms_version: "2026-12-01", privacy_version: "2026-09-19" },
      moved,
    ),
    "notice",
  );
});

test("an agreement to the current documents asks for nothing", () => {
  assert.equal(
    consentOutcome(
      { terms_version: moved.terms, privacy_version: moved.privacy },
      moved,
    ),
    "ok",
  );
  assert.equal(
    consentOutcome({
      terms_version: published.terms,
      privacy_version: published.privacy,
    }),
    "ok",
  );
});

test("the two outcomes are exclusive, whatever the input", () => {
  for (const agreed of [
    null,
    { terms_version: "2020-01-01", privacy_version: "2020-01-01" },
    { terms_version: "2026-09-19", privacy_version: "2026-09-19" },
    { terms_version: moved.terms, privacy_version: moved.privacy },
  ]) {
    const outcome = consentOutcome(agreed, moved);
    assert.equal(
      ["ok", "reconsent", "notice"].includes(outcome),
      true,
      `unexpected outcome ${outcome}`,
    );
  }
  assert.equal(needsReconsent(null) && hasUnseenChange(null), false);
});
