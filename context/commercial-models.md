# Commercial models

Every commercial structure the tool must be able to model, with the maths and the levers. This is where bids are won, and it is the pain the product exists to solve.

> **Status: reasoned default, not evidence.** Reconcile against the real Excel models and any signed contracts in M0.

Last updated: 2026-08-18

---

## The core requirement

**One delivery plan, many commercial shapes, compared side by side.** The delivery plan and resource model are expensive to build. Changing the commercial structure must be near-free — a client asking "what would that look like fixed price?" should be answered in the meeting, not the following week.

Everything below is a transformation of the same underlying effort model into revenue, and therefore into margin and risk.

---

## 1. Time & Materials (T&M)

Bill actual days at agreed rates.

```
revenue = Σ effortDays(a, w) × chargeRate(a.grade, rateCard)
```

**Levers:** per-grade rates, client rate card, discount %, team shape (mix of grades), total effort.

**Risk:** sits with the client. Margin is predictable; revenue is not, since it flexes with actual delivery.

**Where it fails commercially:** clients increasingly resist open-ended T&M on data & AI work because they cannot forecast spend. This is why the other structures matter.

---

## 2. Capped T&M / not-to-exceed

T&M with a ceiling.

```
revenue = min(T&M revenue, cap)
```

**Levers:** the cap, and how much contingency effort sits between the plan and the cap.

**Risk:** asymmetric — we take the downside above the cap, the client takes the benefit below it. The engine must show margin at the *planned* case and at the *cap-breach* case, because a cap set at 100% of plan is a fixed price with extra steps.

```
capHeadroom  = (cap − plannedRevenue) / plannedRevenue
marginAtCap  = (cap − costAtCapEffort) / cap
```

---

## 3. Fixed price

Agreed total for agreed scope.

```
revenue = contractValue                        // independent of actual effort
margin  = contractValue − totalCost
margin% = (contractValue − totalCost) / contractValue
```

**Levers:** the price itself; contingency built into effort; team shape (a cheaper mix at the same price raises margin); phasing of billing.

**Risk:** entirely ours. This is where contingency modelling earns its place:

```
costWithContingency = totalCost × (1 + contingency%)
marginAtContingency = (contractValue − costWithContingency) / contractValue
```

**Overrun sensitivity** — the number that should be on screen whenever a fixed price is being set:

```
breakEvenOverrun% = (contractValue / totalCost) − 1
```
*"We can absorb a 23% overrun before this deal loses money."*

**Effective rate** matters more than blended rate here: `contractValue / totalEffortDays`. A fixed price that implies an effective rate below cost is a loss disguised as a win.

---

## 4. Milestone / deliverable-based

Fixed price with payment tied to delivery events.

```
Σ milestonePayments = contractValue        // hard validation rule
revenue(w) = Σ milestone payments falling in week w
```

**Levers:** the milestone schedule, front-loading vs back-loading, acceptance criteria.

**Risk:** commercial risk as fixed price, plus **cashflow risk**. The engine must show the cumulative cost curve against the cumulative revenue curve, and the maximum negative working-capital position:

```
maxCashExposure = max over w of ( cumulativeCost(w) − cumulativeRevenue(w) )
```

A back-loaded milestone schedule on a long engagement can be perfectly profitable and still be a bad deal.

---

## 5. Retainer / capacity (pod)

Client buys a standing team for a period.

```
revenue = podMonthlyRate × months
cost    = Σ cost of the pod's committed roles
```

**Levers:** pod composition, monthly rate, minimum term, flex clauses.

**Risk:** utilisation risk. If the client under-uses the pod we still hold the cost; if they over-demand it, scope creeps without revenue. Model both:

```
utilisationOfPod   = demandedDays / committedDays
marginAtFullDemand vs marginAtTypicalDemand
```

---

## 6. Outcome / ROI share

Some or all of the fee is contingent on measured value delivered.

Three shapes seen in practice — they are materially different and must not be conflated:

**(a) Percentage of measured benefit**
```
revenue = baseFee + (measuredBenefit × sharePercent)
```

**(b) Gain-share against a baseline**
```
gain    = actualOutcome − agreedBaseline
revenue = baseFee + max(0, gain × sharePercent)
```

**(c) Milestone bonus on outcome achievement**
```
revenue = baseFee + Σ (bonus_i if outcome_i achieved)
```

**Levers:** base fee vs contingent split, share percentage, the baseline, the measurement window, caps and collars.

**Risk:** the highest of any structure, and the hardest to model, because it depends on a number we do not control and often cannot audit. The engine must show three cases as standard:

| Case | Definition |
|---|---|
| Downside | Base fee only, no outcome achieved |
| Expected | Modelled benefit at the agreed share |
| Upside | Capped maximum |

**The rule:** a deal whose *downside* case is below cost is a deal the SLT must consciously accept, not one that slips through because the expected case looked attractive.

→ REVIEW Q4 — how these are actually structured here is unknown, and this is the least standardised structure in the market.

---

## 7. Hybrid structures

Real deals are usually mixed: fixed-price discovery, then T&M build, then a retained hypercare pod, with an outcome bonus on adoption. **The model must support per-phase commercial structures**, not one structure per engagement. This is a first-class requirement, not an edge case — and it is precisely what a single-sheet Excel model handles worst.

```
engagementRevenue = Σ over phases  revenue(phase, phase.structure)
```

---

## 8. Rate strategy and discounting

- **Standard rate card** — our list rates by grade.
- **Client rate card** — negotiated or framework rates, overriding standard for this client.
- **Blended rate** — a single rate for all grades. Simple for the client; only good for us if the actual grade mix stays richer in juniors than the blend assumes. The engine must show the **blend break-even mix**.
- **Discount ladder** — volume, term, or strategic discounts.

Always compute what was actually given away:

```
discountGiven% = 1 − (revenue / revenueAtStandardRates)
```

Discount hides inside team shape as well as inside rates. A "no discount" deal that quietly swapped a Principal for a Consultant has discounted itself.

---

## 9. Guardrails

Configurable thresholds that turn a modelling tool into a control:

- Minimum gross margin % by structure — fixed price and outcome-share should demand more than T&M, because we hold the risk
- Maximum discount without approval
- Maximum cash exposure
- Minimum downside margin on outcome-share deals
- Approval thresholds by deal value

Breaching a guardrail should be visible, explained, and routed to sign-off — never silent.

→ REVIEW Q5 — real thresholds and the real approval chain are unknown.

---

## 10. Scenario comparison

The core interaction of M2. A scenario is a fork of the commercial model over an unchanged delivery plan.

Compared on:

| | Scenario A | Scenario B | Scenario C |
|---|---|---|---|
| Structure | T&M | Fixed price | Fixed + outcome share |
| Revenue | | | |
| Cost | | | |
| Gross margin % | | | |
| Effective day rate | | | |
| Max cash exposure | | | |
| Downside case | | | |
| Guardrail status | | | |

**Design principle:** the comparison must fit on one screen and be defensible in a meeting. If it needs a walkthrough, it has failed.
