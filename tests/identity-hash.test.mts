import assert from "node:assert/strict";
import test from "node:test";
import {
  firstProviderIdentity,
  identityHash,
} from "../src/lib/auth/identity-hash.ts";

const secret = "x".repeat(40);
const google = { provider: "google", identity_data: { sub: "1029384756" } };

test("the digest is stable, keyed, and never the subject itself", () => {
  const first = identityHash(google, secret);
  assert.match(String(first), /^[a-f0-9]{64}$/);
  assert.equal(identityHash(google, secret), first);
  assert.notEqual(identityHash(google, "y".repeat(40)), first);
  assert.equal(String(first).includes("1029384756"), false);
  assert.notEqual(
    identityHash(
      { provider: "kakao", identity_data: { sub: "1029384756" } },
      secret,
    ),
    first,
  );
});

test("a missing key or an unusable identity produces no digest", () => {
  assert.equal(identityHash(google, undefined), null);
  assert.equal(identityHash(google, "short"), null);
  assert.equal(identityHash({ provider: "google" }, secret), null);
  assert.equal(identityHash({ identity_data: { sub: "1" } }, secret), null);
  assert.equal(
    identityHash({ provider: "google", identity_data: { sub: 7 } }, secret),
    null,
  );
  assert.equal(identityHash(undefined, secret), null);
});

test("an anonymous visitor has no sign-in method to block", () => {
  assert.equal(firstProviderIdentity([{ provider: "anonymous" }]), undefined);
  assert.equal(firstProviderIdentity([]), undefined);
  assert.equal(firstProviderIdentity(null), undefined);
  assert.deepEqual(
    firstProviderIdentity([{ provider: "anonymous" }, google]),
    google,
  );
});
