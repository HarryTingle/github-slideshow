# 0001 — Modelling engine core

Milestone: M1
Status: Draft
Owner: Harry
Depends on: `context/domain-model.md`, `context/decisions/0002-stack-and-architecture.md`
Last updated: 2026-08-18

## Job to be done

A Head of Commercial needs to trust the numbers. Before any interface exists, there must be a calculation core that turns a delivery plan and a resource model into effort, cost, revenue and margin — and does it identically to the way a careful person would do it by hand.

The proof is not a demo. It is that the engine reproduces the reference engagement's real Excel model **to the penny**.

## Why now

Everything downstream is presentation. Commercial flex (0003) is a transformation of this output; shareable outputs (0004) render it. Building either on an engine that is wrong produces a tool that loses bids confidently.

## Behaviour

A pure library. Given an engagement document, it returns a fully computed model: effort by assignment and week, cost, revenue, all derived metrics, and a list of validation findings. No I/O, no state, no framework, deterministic.

## Data

```ts
Money        = integer minor units (pence)
Days         = number, 2dp
IsoWeek      = { year: number, week: number }

Grade        { id, name, order, costRate: Money, chargeRate: Money }
Role         { id, name }
Person       { id, name, gradeId, roleId, leave: IsoWeek[] → Days, costRate?: Money }
Calendar     { workingDaysPerWeek, publicHolidays: IsoWeek[] → Days }

Workstream   { id, name, phaseId, startWeek, endWeek }
Phase        { id, name, order, startWeek, endWeek }
Milestone    { id, name, week, paymentValue?: Money }

Assignment   { id, workstreamId, roleId, gradeId, personId?,
               startWeek, endWeek, allocation: number, rampWeeks?: number }

Engagement   { id, name, calendar, phases, workstreams, milestones,
               grades, roles, people, assignments, commercial }
```

## Calculations

All per assignment `a`, per ISO week `w` within `[a.startWeek, a.endWeek]`.

**Available days**
```
availableDays(w, person?) = calendar.workingDaysPerWeek
                          − publicHolidays(w)
                          − leave(person, w)          // 0 if no named person
```

**Ramp factor** — linear ramp to full productivity over `rampWeeks`:
```
weeksIn    = index of w within the assignment, 0-based
rampFactor = rampWeeks ? min(1, (weeksIn + 1) / rampWeeks) : 1
```

**Effort**
```
effortDays(a, w) = a.allocation × availableDays(w, a.person) × rampFactor(a, w)
totalEffortDays  = Σ effortDays(a, w)
```

**Cost**
```
costRate(a)   = a.person?.costRate ?? grade(a.gradeId).costRate
cost(a, w)    = effortDays(a, w) × costRate(a)
totalCost     = Σ cost(a, w) + nonBillableCost + absorbedExpenses
```

**Revenue (T&M base case; other structures in 0003)**
```
chargeRate(a) = clientRateCard[a.gradeId] ?? grade(a.gradeId).chargeRate
revenue(a, w) = effortDays(a, w) × chargeRate(a)
totalRevenue  = Σ revenue(a, w) + rechargeableExpenses
```

**Derived metrics**
```
grossMargin       = totalRevenue − totalCost
grossMarginPct    = grossMargin / totalRevenue
blendedDayRate    = totalRevenue / totalEffortDays
blendedCostRate   = totalCost / totalEffortDays
effectiveRate     = totalRevenue / totalEffortDays        // diverges under fixed price
peakHeadcount     = max over w of Σ over a of a.allocation (active in w)
gradeMix(g)       = effortDays(g) / totalEffortDays
burnCurve(w)      = cumulative cost to end of w
revenueCurve(w)   = cumulative revenue to end of w
maxCashExposure   = max over w of (burnCurve(w) − revenueCurve(w))
```

**Rounding** — no intermediate rounding. Money held in minor units throughout; a single half-up rounding at presentation. Effort held to 2dp. Rates to 2dp.

### Worked example

One assignment. Senior Consultant, cost rate £450/day, charge rate £950/day. Allocated 0.6 FTE to the Data Platform workstream for 4 weeks. 5 working days per week. One public holiday in week 3. No named person, no ramp.

| Week | Working days | Holidays | Available | Effort (×0.6) | Cost @£450 | Revenue @£950 |
|---|---|---|---|---|---|---|
| W1 | 5 | 0 | 5.00 | 3.00 | £1,350.00 | £2,850.00 |
| W2 | 5 | 0 | 5.00 | 3.00 | £1,350.00 | £2,850.00 |
| W3 | 5 | 1 | 4.00 | 2.40 | £1,080.00 | £2,280.00 |
| W4 | 5 | 0 | 5.00 | 3.00 | £1,350.00 | £2,850.00 |
| **Total** | | | **19.00** | **11.40** | **£5,130.00** | **£10,830.00** |

```
totalEffortDays = 11.40
totalCost       = 513000 minor units  (£5,130.00)
totalRevenue    = 1083000 minor units (£10,830.00)
grossMargin     = 570000               (£5,700.00)
grossMarginPct  = 570000 / 1083000 = 0.5263…  → 52.63%
blendedDayRate  = 1083000 / 11.40 = 95000     (£950.00)
```

Blended rate equals the charge rate because there is only one grade — the check that the mix logic is not silently applied.

With `rampWeeks = 2`: W1 effort = 0.6 × 5 × 0.5 = 1.50 days, W2 onward at full. Total effort 9.90 days, cost £4,455.00, revenue £9,405.00.

## Acceptance criteria

- [ ] Engine is a standalone package with zero runtime dependencies and no I/O
- [ ] Given the engagement document above, produces exactly the totals in the worked example
- [ ] All money handled in integer minor units; no floating-point currency anywhere
- [ ] No intermediate rounding — verified by a test where naive rounding would drift
- [ ] Every derived metric in `context/domain-model.md` §8 is implemented and tested
- [ ] Ramp-up, public holidays and personal leave each independently reduce effort, and compose correctly
- [ ] Named-person cost rate overrides grade cost rate; absence of a named person is valid
- [ ] Client rate card overrides standard charge rate; cost rate is never overridden
- [ ] Every value is traceable: the engine returns per-assignment, per-week detail, not only totals
- [ ] Validation findings are returned for every rule in `context/domain-model.md` §9
- [ ] **Golden test:** the reference engagement's real Excel model is reproduced to the penny

## Edge cases

- Assignment spanning a year boundary (ISO week 52/53)
- Zero-day week (full public holiday week) — effort is 0, not an error, and does not divide by zero in metrics
- Allocation > 1.0 for a named person — valid input, flagged by validation
- Assignment outside its workstream's dates
- Grade with no charge rate used on a T&M engagement — error, not silent zero
- `totalEffortDays = 0` — every rate metric must return null rather than NaN or Infinity
- Person assigned to two workstreams on the same engagement, totalling over 1.0 FTE
- Rate change mid-engagement (annual uplift) — see assumptions

## Out of scope

- Commercial structures other than T&M → 0003
- Any UI → 0002 onward
- Persistence beyond a serialisable document
- Excel import
- Cross-engagement capacity across a portfolio

## Assumptions

`ASSUMPTION: weekly resolution is sufficient; part-week allocation at specific dates is not needed — owner: Harry, raised: 2026-08-18`
`ASSUMPTION: ramp-up is linear over rampWeeks — owner: Harry, raised: 2026-08-18`
`ASSUMPTION: rates are constant for the duration of an engagement; no mid-engagement uplift — owner: Harry, raised: 2026-08-18. Likely wrong for engagements crossing a rate-review date.`
`ASSUMPTION: cost rates are fully loaded — owner: Harry, raised: 2026-08-18`

## Open questions

- REVIEW Q1 — which engagement is the reference model
- REVIEW Q2 — cost rates per grade, per person, or both
- REVIEW Q3 — where utilisation is applied. **Deliberately absent from the formulas above**, because applying it in the wrong place is the most consequential error available. To be added once the real models are read.
