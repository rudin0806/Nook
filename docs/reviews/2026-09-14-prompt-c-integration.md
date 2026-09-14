# Prompt C v2 integration

## Implemented

- Original attachment preserved in `docs/proposals/prompt-c-v2.md`.
- `src/prompts/prompt-reframe.ts`: proposal-only generation, separate evidence JSON, no Judge redecision. Removed ungrounded repetition/comparison examples and the inferred intention “정하고 싶은”.
- `src/engine/reframe.ts`: SHIFT/HIGH only; reuses existing Judge context validator without calling Judge. Resolves evidence from the exact current window and validated carryover; never expands scope via a DB lookup. Unknown/assistant/duplicate evidence, altered history and invalid promotion IDs are rejected.
- Previous saved question text is not model evidence. Original Judge evidence IDs and promotion ID stay as server provenance; `evidence_sentence` can later map to `shift_edges.reason_text` after user confirmation.
- Strict two-field output, size/question-mark checks and normalized exact duplicate detection. Errors throw without exposing provider text or retrying. No proposal or Node write on errors.
- Server SDK adapter `runReframe`, explicit server-supplied Terra/Sol config, store=false, timeout 30s, SDK retries=0, output cap <=2048. Model tier remains unselected.

## Document limitations retained explicitly

- A router cannot recognize a semantic Judge false-positive just by checking `SHIFT/HIGH`. R-01/02/03 are non-call tests when actual Judge outputs are REFLECT or CLOSE. Semantic false-positive testing remains a separate Judge eval task.
- S-04 has hedged evidence and no session hedge context, so it is a writing example, not a verified SHIFT/HIGH fixture.
- One-line checks are not a Korean sentence parser. Normalized exact duplicate checks are not semantic equivalence checks. Evidence faithfulness, confidence preservation, Depth Guard and tone still need generation evaluation and review.
- Provided examples overlap prompt examples. They are not a held-out evaluation set. No claims about model quality or token count were adopted.

## Verification and remaining integration

Six focused tests cover blocked actions, carryover text, provenance, tampering, schema/duplicates, provider failures and model restrictions. Typecheck, lint and production build passed. No paid model calls.

No public generation endpoint, authentication lifecycle, Safety gate or approval transaction was added in this change. Caller must enforce identity/ownership, Safety, explicit controls, structural limits and quotas before invoking the internal adapter. It must preserve the current state on errors and never create a replacement REFLECT/SHIFT decision automatically.

Next: authentication initialization/OAuth, Safety contract reconciliation and classifier, Prompt A including the still-pending focus_required path, full turn orchestration, pending proposal approval transaction, then live C/D evaluations and browser-to-DB tests.
