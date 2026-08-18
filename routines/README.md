# /routines

Repeatable operating procedures — the work an AI employee runs on a cadence or on a trigger. **If it has been done twice, it belongs here.**

A routine is written to be executed, not read. Each states its trigger, its steps, its output, and how you know it worked.

| Routine | Trigger | Output |
|---|---|---|
| `daily-check.md` | Each working session | A short orientation and one prioritised next action |
| `weekly-review.md` | Weekly | An entry in `REVIEW.md`, a refreshed `ROADMAP.md` |
| `model-intake.md` | A new artefact lands in `context/inputs/` | Structured extraction into `/context`, new open questions |
| `customer-interview.md` | Before and after a buyer conversation | An interview file, updated hypotheses in `icp.md` |
| `spec-to-build.md` | A spec reaches `Ready` | Implemented, tested code and an updated spec status |
| `assumption-audit.md` | Monthly, and before any milestone closes | Every `ASSUMPTION:` tag confirmed, corrected or escalated |

## Conventions

- Routines produce **written output**. A routine that leaves no trace did not run.
- Routines end by naming the next action, with an owner.
- When a routine's steps stop matching reality, fix the routine — do not work around it.
