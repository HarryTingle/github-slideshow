# 0003 — Commercial models and scenarios

Milestone: M2
Status: Draft
Owner: Harry
Depends on: `context/commercial-models.md`, `specs/0001-modelling-engine-core.md`
Last updated: 2026-08-18

## Job to be done

A Head of Commercial has a finished delivery plan and a client who has just asked what it would look like fixed price. They need to produce two or three defensible commercial options, see what each does to margin and risk, and know immediately whether any of them breaches the thresholds the SLT will apply — while the conversation is still live.

This is the pain the product exists to solve. Everything before it is prerequisite.

## Why now

The delivery plan is expensive to build; the commercial model must be cheap to change. If this is slow or fragile, the product has not solved the problem it was built for.

## Behaviour

- Apply a commercial structure to an engagement, or **to an individual phase** — hybrid deals are the norm, not an edge case
- Fork the commercial model into named scenarios over an **unchanged** delivery plan
- Compare scenarios side by side on one screen
- See guardrail status per scenario, with the breach explained
- Run sensitivity: what happens to each scenario if the plan slips, the mix shifts, or the discount deepens
- Trace any figure back to the assignments that produced it

## Data

```ts
CommercialStructure =
  | { type: 'tm', rateCardId }
  | { type: 'cappedTm', rateCardId, cap: Money }
  | { type: 'fixedPrice', contractValue: Money, contingencyPct: number }
  | { type: 'milestone', contractValue: Money, payments: { milestoneId, value: Money }[] }
  | { type: 'retainer', monthlyValue: Money, months: number, committedRoles }
  | { type: 'outcomeShare', baseFee: Money, shape: 'benefitPct'|'gainShare'|'bonus',
      sharePercent?, baseline?, expectedBenefit?, cap?, floor? }

RateCard  { id, name, clientId?, rates: Map<gradeId, Money>, discountPct? }
Scenario  { id, name, structurePerPhase: Map<phaseId, CommercialStructure>, notes }
Guardrail { id, metric, operator, threshold, appliesToStructure?, approvalRequired }
```

## Calculations

All formulas are in `context/commercial-models.md` and are the normative source. Summarised:

```
T&M            revenue = Σ effortDays × chargeRate
Capped T&M     revenue = min(tmRevenue, cap)
               capHeadroom = (cap − plannedRevenue) / plannedRevenue
Fixed price    revenue = contractValue
               costWithContingency = totalCost × (1 + contingencyPct)
               breakEvenOverrunPct = (contractValue / totalCost) − 1
Milestone      revenue(w) = Σ payments at w;  Σ payments must equal contractValue
               maxCashExposure = max over w of (cumCost(w) − cumRevenue(w))
Retainer       revenue = monthlyValue × months
               podUtilisation = demandedDays / committedDays
Outcome share  downside = baseFee
               expected = baseFee + expectedBenefit × sharePercent
               upside   = min(cap, baseFee + maxBenefit × sharePercent)

Hybrid         engagementRevenue = Σ over phases revenue(phase, phase.structure)
Discount       discountGivenPct = 1 − (revenue / revenueAtStandardRates)
Effective rate = revenue / totalEffortDays
```

### Worked example

Delivery plan: 220 effort days, total cost £86,400, revenue at standard T&M rates £198,000.

| | A: T&M | B: Fixed price | C: Fixed + outcome share |
|---|---|---|---|
| Contract value | £198,000 | £180,000 | £150,000 base + 10% of benefit |
| Expected revenue | £198,000 | £180,000 | £150,000 + £40,000 = £190,000 |
| Cost | £86,400 | £86,400 | £86,400 |
| Cost + 15% contingency | — | £99,360 | £99,360 |
| Gross margin | £111,600 | £80,640 | £90,640 |
| Gross margin % | 56.4% | 44.8% | 47.7% |
| Effective day rate | £900 | £818 | £864 |
| Discount vs standard | 0% | 9.1% | 4.0% |
| Break-even overrun | n/a | 108% | 73%* |
| **Downside case** | £198,000 (56.4%) | £180,000 (44.8%) | **£150,000 (33.8%)** |
| Guardrail (min 40% GM) | Pass | Pass | **Fail on downside** |

\* Break-even overrun for C is calculated on the **base fee** (£150,000 / £86,400 − 1 = 73%), not the expected
revenue — the contingent element cannot be relied on to absorb an overrun. Downside margin uses cost including
contingency: (£150,000 − £99,360) / £150,000 = 33.8%.

Scenario C looks competitive on the expected case and breaches the guardrail on the downside. **Surfacing that difference in one view is the product.**

## Acceptance criteria

- [ ] All six structures in `commercial-models.md` are implemented with the formulas as written
- [ ] A structure can be applied **per phase**; engagement revenue is the sum across phases
- [ ] Creating, renaming and deleting a scenario never mutates the delivery plan
- [ ] At least three scenarios compare side by side on one screen without scrolling
- [ ] Outcome-share scenarios always show downside, expected and upside — the downside case cannot be hidden
- [ ] Milestone payments are validated to sum to contract value; a mismatch blocks sign-off
- [ ] Max cash exposure is computed and shown for every non-T&M structure
- [ ] Guardrail breaches are shown with the metric, the threshold, the actual value, and who must approve
- [ ] Sensitivity: a slip of *n* weeks, a mix shift, or a discount of *n*% can be applied to all scenarios at once and the comparison updates
- [ ] Any figure can be traced back to the assignments and rates that produced it
- [ ] Producing three defensible options on a finished plan takes under ten minutes — measured, not assumed

## Edge cases

- Fixed price below cost — allowed as input, flagged loudly, blocked at sign-off
- Contingency that pushes cost above contract value
- Outcome share with no cap — the upside case is unbounded and must be shown as such rather than as a number
- A blended rate whose break-even mix is richer than the planned mix
- A cap set at or below planned revenue — behaves as fixed price; say so explicitly
- Retainer where demanded days exceed committed days
- Currency: a client billed in a different currency from the delivery cost base → out of scope for M2, flagged

## Out of scope

- Multi-currency
- Tax, VAT, withholding
- Payment terms and interest on late payment
- Automated commercial recommendation ("this should be fixed price") — the tool informs judgement, it does not replace it
- Contract generation

## Assumptions

`ASSUMPTION: outcome-share deals use one of the three shapes in commercial-models.md §6 — owner: Harry, raised: 2026-08-18` → REVIEW Q4
`ASSUMPTION: guardrails are margin-% and discount-% based with value-banded approval — owner: Harry, raised: 2026-08-18` → REVIEW Q5
`ASSUMPTION: contingency is applied to cost, not added to price — owner: Harry, raised: 2026-08-18. These are different levers and firms differ.`
