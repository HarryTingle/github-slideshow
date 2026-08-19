# 0004 — Price by leverage, not by nudging

Status: Accepted
Date: 2026-08-19
Deciders: Harry

## Context

Harry shared the tool he built before this one. Its pricing screen puts an editable
charge rate and an editable leave figure on every role row, with revenue, cost,
contribution and margin computed beside them, and a running total above. He likes being
able to make small edits to fine-tune towards a margin — and said he does not think it is
the best way to do it.

He is right, and the reasons are worth writing down because they shaped what replaced it.

**What that design gets right**, and what we kept: everything on one screen; margin
visible while you edit; per-row margin so you can see what is dragging; the price
expressed both as a lump sum and as a percentage of the build-up; the blended rate shown
against standard.

**Where it costs time.**

1. *The same rate is edited many times.* Rates are held per grade, but the rows are per
   person, so a six-row phase with two Associates and two Consultants means editing the
   same two numbers four times. The screenshot shows exactly this — two rows at £525, two
   at £800.
2. *No indication of which lever is worth pulling.* Every row invites the same edit, and
   the rows are not equally worth editing. Finding the one that moves margin is done by
   trial.
3. *No goal-seek.* The target margin is in the operator's head; the tool never solves for
   it, so hitting it is iteration.
4. *Leave is editable next to price.* This is the deepest problem. Annual leave is a fact
   about delivery capacity. Editing it to reach a commercial number does not improve the
   deal — it makes the plan wrong, and it makes it wrong in the direction of under-
   resourcing, which is the failure that shows up months later as an overrun.

## Decision

A pricing desk built on **leverage**, not on nudging.

- **Rates are edited once per grade**, on the deal, not per row. A scenario carries its
  own `rateOverrides` layered over the client rate card over the practice standard, so
  "which rate is this?" has one answer and pricing a bid never touches the practice card.
- **A sticky readout** carries price, margin against target, discount, blended rate and
  guardrail status, and stays on screen while the rates beneath it are edited. Pricing is
  a loop and the loop is only fast when cause and effect are visible together.
- **Two leverage columns** state what each lever is worth, in points of total margin:
  putting £25 a day on a grade, and moving a week of work down one rung.
- **Goal-seek**: enter a target margin and the desk solves for it in closed form —
  a uniform rate move under T&M, a price under a fixed structure — and applies it.
- **Leave is not a pricing control.** It stays on the delivery plan, where it is a
  statement about capacity.

## Consequences

**What this makes visible that the old design could not.** The leverage is
structure-dependent, and starkly so:

- Under T&M, leverage follows *volume*. On the seeded plan, +£25 a day on Consultant is
  worth **+0.62pp** of margin; the same £25 on Director is worth **+0.01pp**, because
  there are 100 days of one and 1.4 of the other. Sixty times the effect for the same
  concession.
- Under a fixed price, a rate change is worth **nothing at all** — revenue is the price.
  The desk says so rather than letting someone spend ten minutes discovering it.
- Under a fixed price the lever moves to team shape, and on this rate card the gain is
  concentrated at the top: moving a week from Associate Director down a rung is
  **+1.12pp**, against **+0.22pp** for the same move at Consultant.
- Trading down is not always right. At framework rates, Senior Manager → Manager is
  **−0.12pp**, because Senior Manager carries the better margin. A blanket "use cheaper
  people" instinct destroys margin here, and only the per-grade numbers show it.

**Accepted costs.**

- Per-grade rates cannot express a rate agreed for one person or one workstream. If that
  turns out to be needed, it is a per-assignment override layered under the grade rate —
  additive, not a rework.
- Goal-seek solves with a *uniform* rate move, which holds the shape of the deal. It will
  not find the cleverest answer, only the neutral one. The leverage columns are there for
  the cleverer answer, which is a judgement rather than a solve.
- The desk prices one scenario at a time. Comparing several remains the job of the
  comparison table below it.

## Alternatives considered

- **Keep per-row rate editing.** Faithful to the old tool and to the spreadsheet, but it
  is the specific thing that costs time, and it invites the same rate to diverge between
  two rows of the same grade by accident.
- **A slider per lever.** Attractive, but a slider hides the number, and a commercial lead
  needs to type £900 rather than approach it.
- **Full optimisation** — solve for the cheapest combination of moves to reach a target.
  Rejected for now: the answer would be a mix change the delivery lead has to agree to,
  so proposing it as a fact rather than an option is the wrong posture. Revisit once the
  tool is used on a live bid.
