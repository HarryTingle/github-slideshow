# Routine — Daily check

**Trigger:** the start of each working session in this repo.
**Runtime:** 5 minutes.
**Output:** a short orientation and one prioritised next action.

## Steps

1. **Read `ROADMAP.md`** — which milestone is live, and what is unticked within it.
2. **Read the top of `REVIEW.md`** — the most recent review entry, and the open questions. Any question blocking the current milestone outranks new work.
3. **Check `context/inputs/INDEX.md`** — has new source material arrived that has not been ingested? If so, `model-intake.md` runs first. Real evidence always outranks reasoned defaults.
4. **Check for uncommitted work** — `git status`. This workspace runs in ephemeral containers; anything worth keeping is committed and pushed.
5. **Pick one thing.** The next action is the highest item that is (a) unblocked and (b) on the live milestone. Not the most interesting one.

## Output

```
Milestone:      M_
Blocked by:     _ (or nothing)
New evidence:   _ (or none)
Next action:    _
Why this one:   _
```

## How you know it worked

There is exactly one next action, and it is on the live milestone.
