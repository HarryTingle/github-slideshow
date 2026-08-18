# Routine — Assumption audit

**Trigger:** monthly, and before any milestone is closed.
**Runtime:** 30 minutes.
**Output:** every `ASSUMPTION:` tag confirmed, corrected, or escalated.

The workspace was seeded from reasoned defaults, not evidence. Those defaults are useful and they are dangerous — a plausible-but-wrong domain model is much harder to spot than an obviously missing one. This routine exists to stop them hardening into fact through repetition.

## Steps

1. **Collect them all.**
   ```
   grep -rn "ASSUMPTION:" --include="*.md" .
   ```

2. **For each one, decide:**

   | Verdict | When | Action |
   |---|---|---|
   | **Confirmed** | Evidence now exists — a real model, a real conversation | Replace the tag with the fact, cite the source, note the change in `REVIEW.md` |
   | **Corrected** | Evidence contradicts it | Fix it, and trace what was built on top of it. Corrections propagate. |
   | **Still open, low stakes** | Nothing depends on it yet | Leave it, re-date it |
   | **Still open, load-bearing** | Code, specs or commercials now depend on it | Escalate to an open question in `REVIEW.md` with an owner and a date |

3. **Check ownership.** An assumption with no owner will never be resolved. Assign one or delete it.

4. **Check for silent assumptions** — things now treated as fact that were never tagged. The domain model, the ICP and the commercial structures are the usual places. Anything that arrived by reasoning rather than by evidence and is now being relied on gets a tag.

5. **Check what was built on the shaky ones.** For every corrected assumption, list what depended on it and verify each. This is the step that gets skipped, and it is the whole point.

## How you know it worked

Every remaining `ASSUMPTION:` has an owner and a date, and none of the load-bearing ones is more than a month old without being escalated.
