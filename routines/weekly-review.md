# Routine — Weekly review

**Trigger:** weekly, or at the close of any milestone.
**Runtime:** 30 minutes.
**Output:** an entry in `REVIEW.md`; a refreshed `ROADMAP.md`.

## Steps

1. **What actually shipped this week?** List it. Compare against what was planned. Do not soften the gap — the gap is the signal.
2. **Run the quality bar** (`REVIEW.md` §1) against everything that shipped. Anything failing a criterion is not done; move it back.
3. **Assumptions.** Grep for `ASSUMPTION:` across the repo. Any that became answerable this week — answer them. Any that are now load-bearing and still unconfirmed — escalate to an open question.
   ```
   grep -rn "ASSUMPTION:" --include="*.md" .
   ```
4. **Open questions.** Review every entry in `REVIEW.md` §3. Resolve what can be resolved; note what is now blocking.
5. **Evidence check.** Did anything land in `context/inputs/` or `customers/interviews/` that should change the domain model, the ICP, or the roadmap? Reasoned defaults must yield to evidence the moment evidence exists.
6. **Roadmap reality.** Update `ROADMAP.md`: tick what is done, re-sequence what moved, and record *why* it moved. A roadmap that only ever gains items is not being reviewed.
7. **Risks.** Review `REVIEW.md` §4. Anything new, anything materialised, anything now dead.
8. **Write the entry.**

## Review log entry format

```
### YYYY-MM-DD — Title
**Reviewed:**
**Outcome:**
**Quality note:**
**Next:**
```

## How you know it worked

`ROADMAP.md` reflects reality, `REVIEW.md` has a new entry, and at least one open question moved in either direction.
