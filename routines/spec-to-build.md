# Routine — Spec to build

**Trigger:** a spec reaches status `Ready`.
**Output:** implemented, tested code; updated spec status; a review entry.

## Before writing code

1. **Re-read the spec end to end.** If any calculation is not written out in full, or any acceptance criterion is not testable by someone who did not write it, the spec is not `Ready` — send it back.
2. **Re-read the `/context` files it cites.** The spec is downstream of them; if they have moved, the spec may be stale.
3. **Check the assumptions.** Any `ASSUMPTION:` that is load-bearing for this build and still unconfirmed — flag it in `REVIEW.md` before building on it.
4. **Write the worked example as a test first.** The spec's worked example becomes a failing test. That test passing is the definition of the feature working.

## While building

- **Engine first, always.** Every calculation goes in `packages/engine`, with no I/O, no framework, no dependencies. If a number can only be produced by clicking through the UI, it is not finished.
- Money in integer minor units. No floating-point currency. No intermediate rounding.
- Every calculation gets unit tests: happy path, boundaries, and at least one real-world case.
- Every edge case listed in the spec gets a test — that list exists to be executed.
- Nothing about our own grades, rates, brand or thresholds gets hard-coded. Configuration, not assumption.

## Before calling it done

Run the definition of done in `CLAUDE.md` §6, then:

- [ ] The spec's worked example passes as a test
- [ ] Every acceptance criterion is satisfied and demonstrably so
- [ ] Every edge case in the spec has a test
- [ ] The golden test still reproduces the reference engagement
- [ ] Outputs are traceable back to inputs
- [ ] Spec status updated to `Built`, with the date
- [ ] `ROADMAP.md` ticked
- [ ] `REVIEW.md` entry written, including anything that turned out harder or different than the spec assumed

## If the spec was wrong

It will happen — the spec was written before the domain was fully understood. **Update the spec, do not just change the code.** A spec that no longer describes the system is worse than no spec, because it will be trusted. Note the change in `REVIEW.md`.
