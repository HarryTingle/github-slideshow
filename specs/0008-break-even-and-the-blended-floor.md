# 0008 — Break-even and the blended floor

Milestone: M2
Status: Built
Owner: Harry
Depends on: `specs/0003-commercial-models-and-scenarios.md`, `context/decisions/0004-pricing-levers.md`
Last updated: 2026-08-20

## Job to be done

The pricing desk answers *which lever is worth pulling*. This answers the question asked immediately before walking into a negotiation, and the one bid teams most often guess at:

> **How low can I actually go?**

Two numbers, neither of which is a rate anybody can set. A blended day rate is an *output* of the team on the job, so the floor moves whenever the mix moves — which is why it has to be computed against the plan rather than looked up on a card.

## Why now

Every commercial structure in M2 is a way of arranging revenue. None of them says where the bottom is. Without it, "can we do 10% off?" is answered by intuition in the room, and intuition is exactly what loses the margin the rest of this tool exists to protect.

## Behaviour

### The three headline numbers

- **Billing** — the blended day rate this deal earns today, over the days in the plan.
- **Break-even** — the blended day rate at which the deal makes nothing. Delivery cost per day *plus* the non-billable overhead and absorbed expenses the mix also has to carry. Both halves are shown, because the gap between them is invisible on a rate card and real in the P&L.
- **Needed for target** — the blended day rate that clears the margin the practice is pricing towards.

### The headline sentence

The deepest discount that still clears each bar, **stated as a share of the price**.

This is the point of the card. The identity is that **the deepest discount you can give is your current margin** — a deal at 22% margin can give away 22% of its *price*, and no more. Not 22 points of margin. The two are confused constantly and the confusion is expensive, so the card says which one it means every time it says it.

Three states:
- **Room** — how much of the price can go and still clear the target, then how much more takes it to break-even.
- **Below target** — how far short, and the warning that the remaining room is margin the practice already said it would not give.
- **Below break-even** — what it is losing, and that there is no discount to give at all.

### The mix behind the floor

Per grade on the plan: days, share of days, billed rate, cost rate, the margin a day earns, and what it contributes to the blended rate. Any grade earning less than the target is marked, because a grade below the bar carrying a large share of the days is the reason a healthy-looking blended margin is fragile.

### One target, shared

The margin being priced towards is held once and used by both the pricing desk's solve and this card. It starts from the practice's own gross-margin guardrail rather than an invented default. Two controls disagreeing about what "target" means would be worse than either alone.

## Maths

```
blendedRate       = revenue / days
blendedCostRate   = cost / days                       [cost is fully loaded]
breakEvenRate     = blendedCostRate

revenueAtTarget   = cost / (1 − target)               [solves (r − c)/r = target]
targetRate        = revenueAtTarget / days

roomToBreakEven   = revenue − cost
roomToTarget      = revenue − revenueAtTarget
discountToBreakEven = (revenue − cost) / revenue      [≡ gross margin]
discountToTarget    = (revenue − revenueAtTarget) / revenue
```

Per grade, margin is **before** overhead: `(chargeRate − costRate) / chargeRate`. The blended cost rate carries overhead and the grade lines do not, and the card says so — treating the two as comparable would understate the floor by the whole of the overhead.

Rates are the ones this scenario actually bills, not the practice standard. A deal priced below the card must be measured against what it will really earn.

A target of 100% or more has no solution and returns null rather than infinity.

## Acceptance criteria

- [x] Break-even blended rate equals the blended cost rate, and both are shown against the delivery-only rate
- [x] The target rate produces exactly the target margin when multiplied back out over the days
- [x] `discountToBreakEven` is identically the current gross margin
- [x] Room and discount go negative, and are labelled as a shortfall, once a bar is breached
- [x] A deal already losing money is reported as below break-even with no discount available
- [x] Grade lines cover only grades on the plan, senior first, with shares summing to 1
- [x] Grade contributions to the blended rate sum to the blended rate built from rates
- [x] Grades earning less than the target are marked
- [x] The scenario's billed rates are used, not the standard card
- [x] An empty plan returns nulls rather than dividing by zero; an impossible target returns null
- [x] The pricing desk and this card share one target, seeded from the gross-margin guardrail

## Out of scope

- **Discount ladders** (volume, term, strategic). This gives the floor; a ladder is policy about how to approach it, and needs Q5 answered first — who signs off against what thresholds.
- Solving for a *mix* that hits the target. The leverage per grade is already on the pricing desk; searching the space of team shapes is a different feature and probably a worse one than showing a commercial lead the two numbers and letting them choose.
