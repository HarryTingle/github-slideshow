# 0006 — Output snapshots

Milestone: M3
Status: Built
Owner: Harry
Depends on: `specs/0004-shareable-outputs.md`, `context/business-context.md`
Last updated: 2026-08-20

## Job to be done

You issue an SLT pack on Tuesday. On Wednesday you flex a rate, add a Senior Consultant, push the go-live out a week. The pack the SLT is looking at now says something different from the pack they read — and nobody is told.

Today's tool has exactly one state: *now*. Every output is a live render of the current model. That is the right default for working, and completely wrong for anything that has been sent to someone. An issued output is a commitment, and a commitment that silently rewrites itself is worse than no record at all.

This is the gap between a modelling tool and something a sign-off chain can trust.

## Why now

M3 is about outputs that leave the building. Three of them do — the resourcing plan, the client proposal section and the SLT pack. Every one is a document someone else acts on. Until an issued output is frozen, the approval trail in M4 has nothing to attach to: you cannot approve a moving target.

## Behaviour

### Issuing

From the Outputs page, **Issue this pack** freezes the current model. A snapshot records:

- a **version number**, incrementing per engagement, and the audience it was issued to
- **who issued it, when**, and an optional note ("sent to Meridian procurement")
- the **complete engagement document** as it stood, and the scenario that was recommended
- the **headline figures as issued** — revenue, cost, margin, effort, cash exposure

Both the document and the figures are stored. The document is what makes the snapshot re-openable and diffable; the figures are what make it *provable*. Recomputing the frozen document must reproduce the stored figures exactly. If it ever does not, the calculation changed underneath an issued pack, and the app says so rather than quietly showing the new answer.

Snapshots are not part of the model. They are not undoable, they are not affected by Reset, and editing the model never edits a snapshot.

### Reading a snapshot back

Opening a snapshot shows the Outputs views rendered from the frozen document, not the live one — the same three views, the same numbers the recipient saw. The Excel export of an open snapshot exports the frozen model.

While a snapshot is open the model is read-only. Nothing on screen can write back to the live document, by construction: the views are handed a frozen model with no mutators at all.

### Saying what moved

For each snapshot, the app states its relationship to the live model in one line: identical, or what changed.

Two kinds of change, because they answer different questions:

- **Figures** — revenue, cost, gross margin, downside margin, effort days, duration, peak headcount, discount, cash exposure. Each with its issued value, its current value, and the movement. Margin moves are stated in percentage points, never as a percentage of a percentage.
- **Structure** — phases, workstreams, people, assignments, milestones, rates, scenarios and guardrails added, removed or changed. This is *why* the figures moved, and it is the half a reviewer actually needs: "revenue is up £24k" is a fact, "because Discovery grew by two weeks" is an explanation.

Structural changes are described in the language of the plan, not of the data model. "Ivy Chen added to Build" beats "assignment a-14 created".

## Maths

Snapshot figures come from the same `analyse()` path as the live model — there is no second implementation of any number, and there must never be one. A snapshot is a frozen *input*, not a frozen *output*, plus an assertion that the two agree.

Percentage-point movements are `to − from`, in points, not a ratio. A margin going 30% → 25% is **−5.0pp**, not −16.7%, and not −5%.

Figures that are null on one side and a number on the other (a T&M deal has no break-even overrun; a fixed-price one does) are reported as appearing or disappearing, never as a movement from zero.

## Acceptance criteria

- [x] Issuing a pack records version, audience, issuer, timestamp, note, scenario, the full document and the headline figures
- [x] Version numbers increment per engagement and never reuse a number
- [x] Editing the model after issuing does not change any issued snapshot
- [x] Undo and Reset do not touch snapshots
- [x] Recomputing a snapshot's frozen document reproduces its stored figures; a mismatch is surfaced, not hidden
- [x] A snapshot taken with no intervening edit diffs as unchanged
- [x] Figure movements are correct in direction and magnitude; margin in percentage points
- [x] Structural changes name the phase, workstream, person or scenario in plain English
- [x] Adding a person, moving a phase, changing a rate and switching structure are each detected
- [x] An open snapshot renders the Outputs views from the frozen document and cannot write to the live one
- [x] Excel export of an open snapshot exports the frozen model

## Out of scope

- Approval and sign-off *on* a snapshot — that is M4, `specs/0005-collaboration-and-signoff.md`. This spec provides the thing approval attaches to.
- Restoring the live model from a snapshot. Tempting and cheap, but it turns a record into a branch, and branching without multi-user identity is how you lose work.
- Server-side storage. Snapshots live beside the model until persistence lands in M4.
