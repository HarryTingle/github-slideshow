# 0007 — Leave as a commercial lever

Milestone: M2
Status: Built
Owner: Harry
Depends on: `context/domain-model.md` §3 (the 23-day allowance), `specs/0003-commercial-models-and-scenarios.md`
Last updated: 2026-08-20

## Job to be done

On a fixed price the client pays the same whoever is in the room. A day somebody does not work is a day we do not pay for, and it falls straight to margin. That makes leave a genuine commercial lever — and one currently discovered after the fact rather than modelled before signature.

A Head of Commercial needs to see, per person: what they are **due** over their weeks here, what the plan is actually **carrying** for them, and what the difference is **worth** on the deal in front of them. Then adjust it — the senior who never takes their allowance, the consultant with a fortnight booked in August — and watch the margin move without leaving the page.

## Why here and not in the delivery plan

Leave has two faces. *When* somebody is off is a delivery question, booked week by week in the grid. *How much* the plan assumes the team takes is a commercial question, because it moves the margin and nothing else. Putting the second on the delivery plan — as a red tint on short weeks — made the plan look like it had a problem when the plan was fine, and put the lever on a different page from the number it moves.

## Behaviour

### What each person shows

- **Due** — the annual allowance pro-rated to the weeks that person is actually on this engagement. Derived from a sourced figure and never edited here.
- **Booked** — days already in the diary, within those weeks. A fact.
- **Adjust** — the lever. Days added to, or taken off, the entitlement. Held as a delta so the entitlement stays the truth and the adjustment stays visibly an assumption.
- **Planned** — booked + the provision for what is not yet booked. What the plan is carrying. Highlighted when it differs from Due, because that difference is the thing worth arguing about.
- **Delivering** — effort days this person contributes after leave.
- **Days lost** — delivery days leave has taken out of the plan.
- **Effect** — what those days are worth on the selected scenario.

### The lever is structure-aware, and the sign flips

Under a **fixed price**, revenue does not move, so cost avoided is margin: the effect is positive.

Under **time and materials**, the day is not billed either. A charge rate exceeds a cost rate, so an unbilled day loses more revenue than it saves in cost: the effect is **negative**. Reporting one number for both structures would be the most expensive kind of wrong, so the effect column and the summary both name the scenario they are computed against.

### Days lost is shown next to the money, always

Margin taken out of somebody's absence is only real if the work still fits in the days that remain. A fixed price built on 100 delivery days that now plans 92 has not earned eight days of margin — it has created eight days of delivery risk, and which it turns out to be is decided after signature. The card says so in as many words.

### What the lever cannot do

Negative adjustments cannot un-book leave already in the diary. The provision for unbooked leave floors at zero and booked days stand. Booked leave is removed where it was booked — week by week, in the delivery plan.

## Maths

For each capacity holder, over the distinct weeks they are on the engagement:

```
entitlement  = annualAllowance × (weeksOnEngagement / 52)
expected     = entitlement + adjustment
provision    = max(0, expected − booked) / weeksWithNothingBooked     [per week]
planned      = booked + provision × weeksWithNothingBooked
variance     = planned − entitlement
```

The provision deliberately avoids weeks that already carry booked leave: adding a provision on top of a week somebody is already off would push availability below zero, be clamped away, and quietly lose part of the allowance.

**Days lost, cost saved and revenue forgone are derived, not estimated.** The engine computes a second plan with every form of leave switched off — public holidays stay, because they are not leave and nobody chooses them — and takes the difference per person. There is no separate formula for what leave costs, and there must never be one.

```
marginEffect = revenueFollowsEffort ? costSaved − revenueForgone : costSaved
```

An unstaffed role gets an entitlement too. Otherwise a role placeholder would look cheaper and more available than the person who ends up filling it, and the plan would flatter itself right up until it was staffed.

## Assumptions

**ASSUMPTION** (owner: Harry, `REVIEW.md` Q21): that a grade cost rate is an annual cost divided by *billable* days rather than by working days. If it is the latter, leave is already unrecovered cost inside the rate, deducting absent days again double-counts it, and margin does not rise at all. Every figure in this spec depends on that answer. Until it is settled, the direction of the lever is right and its magnitude is unproven.

## Acceptance criteria

- [x] Each person shows entitlement, booked, adjustment, planned, variance, delivery days, days lost and money effect
- [x] Entitlement is the allowance pro-rated to weeks on the engagement, never a whole-year figure
- [x] Booked leave sets against the entitlement rather than adding to it
- [x] A positive adjustment removes delivery days; a negative one gives them back
- [x] A negative adjustment cannot un-book leave; the provision floors at zero and booked days stand
- [x] Adjusting one person changes nobody else's delivery days
- [x] Under fixed price the effect is positive and margin rises; under T&M the effect is negative and margin percentage barely moves
- [x] Days lost is derived from a leave-free plan, not from a second formula
- [x] Unstaffed roles carry an entitlement
- [x] The delivery plan no longer tints short weeks; the arithmetic remains on hover

## Out of scope

- Predicting *when* unbooked leave will be taken. The provision is a reserve spread across free weeks, not a forecast, and presenting it as a date would be false precision.
- Utilisation. Deliberately absent from the engine — `REVIEW.md` Q3, deferred by Harry on 2026-08-20.
