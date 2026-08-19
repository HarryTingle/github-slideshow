# Domain model

The entities and the maths of delivery planning and resourcing. This is the specification the engine implements.

> **Status: part evidence, mostly still reasoned.** The grade ladder and capability list
> in §3 are the practice's real ones, given on 2026-08-19. Everything else — rates,
> utilisation, the treatment of non-billable effort — remains written from first
> principles pending the real Excel models and rate card (M0), and is tagged
> `ASSUMPTION:` where a choice was made without evidence.

Last updated: 2026-08-19

---

## 1. Core entities

```
Engagement
├── DeliveryPlan
│   ├── Phase[]            (Discovery, Build, Deploy, Hypercare …)
│   ├── Workstream[]       (Data Platform, ML, Change, PMO …)
│   └── Milestone[]        (dated, may gate payment)
├── ResourceModel
│   ├── Assignment[]       (who/what role, to which workstream, over which weeks, at what FTE)
│   ├── Role[]             (Data Engineer, ML Engineer, Solution Architect …)
│   ├── Grade[]            (seniority band, carries cost and charge rates)
│   └── Person[]           (optional — named individuals with real availability)
└── CommercialModel
    ├── Structure          (T&M | capped T&M | fixed price | milestone | retainer | outcome share)
    ├── RateCard           (charge rates by grade, client-specific overrides)
    ├── Contingency
    └── Scenario[]         (forks for comparison)
```

An **Engagement** owns exactly one delivery plan and one resource model, and any number of commercial scenarios over them. That asymmetry is the whole product: the plan is expensive to build, the commercials must be cheap to change.

---

## 2. Time

- **Base unit of effort:** the **day** (a person-day of delivery effort).
- **Base unit of calendar:** the **ISO week**. Weeks are the resolution at which allocation, burn and revenue are modelled.
- **Working days per week:** 5 by default, configurable per region.
- **Non-working time:** public holidays and leave reduce available days in a given week and must not silently inflate capacity.

ASSUMPTION: weekly resolution is sufficient. Daily resolution matters if engagements routinely staff people for part-weeks at specific dates. Owner: Harry. Raised: 2026-08-18.

---

## 3. Roles, grades and people

Three distinct concepts that bespoke spreadsheets routinely conflate.

- **Capability** — *what the work needs.* The practice's own list, below.
- **Grade** — *seniority and therefore rate.* The practice's own ladder, below.
- **Person** — *a named individual*, who has a home capability, a grade, real availability and possibly a personal cost rate.

### The grade ladder

**Source: given by Harry, 2026-08-19.** This is the practice's real ladder and is now the
canonical list in `packages/engine/src/seed.ts`.

| # | Grade |
|---|---|
| 1 | Associate |
| 2 | Senior Associate |
| 3 | Consultant |
| 4 | Senior Consultant |
| 5 | Manager |
| 6 | Senior Manager |
| 7 | Associate Director |
| 8 | Director |

### The capabilities

**Source: given by Harry, 2026-08-19.**

| Capability |
|---|
| Applied Data Intelligence |
| AI (ML & Gen AI) |
| Data & AI Product Management |
| Data & AI Governance |
| AI Business Partners |
| Platform Engineering |

**Confirmed by these two lists:** capability and grade are independent axes, not one
ladder. A Platform Engineer can be an Associate or a Director. The earlier assumption to
that effect is now evidence.

### The standard rate card — charge rates

**Source: Solutions standard day rate card, given by Harry 2026-08-19.** Real. Loaded
verbatim into `packages/engine/src/seed.ts` and asserted by test.

| Grade | Standard day rate |
|---|---|
| Associate | £525 |
| Senior Associate | £650 |
| Consultant | £800 |
| Senior Consultant | £900 |
| Manager | £1,100 |
| Senior Manager | £1,350 |
| Associate Director | £2,000 |
| Director | £2,500 |

Note the step at Associate Director: the rate roughly doubles between Senior Manager and
Director, far faster than cost plausibly does. That shape is why grade mix moves margin,
and why a "small discount" achieved by swapping a Director for a Senior Manager is a
much larger concession than it looks.

### Cost rates — still unknown

**No cost data has been supplied.** The engine therefore derives a placeholder:

`ASSUMPTION: fully-loaded cost is 50% of the standard day rate from Associate to Senior
Manager, and 42% at Associate Director and Director — owner: Harry, raised: 2026-08-19.`

A single stated ratio is used in place of eight individually plausible numbers on
purpose: it is obviously a placeholder, auditable in one line, and does not pretend to
encode knowledge of the cost base we do not have.

**What this means for the app:** revenue is now correct for a given plan. **Margin is
not.** Gross margin, downside cases, break-even overrun and the guardrail verdicts all
depend on cost, and cost is invented. This is the single highest-value gap left in the
model — see REVIEW Q15.

At bid stage a plan is normally **role + grade** placeholders. Named people are attached later, or partially, or never. **The model must be valid with zero named people.**

~~ASSUMPTION: role and grade are independent axes.~~ **Confirmed 2026-08-19** — two
separate lists were supplied, so the axes are independent..

### Rates

Every grade carries two rates, and confusing them is the classic modelling error:

| Rate | Meaning | Used for |
|---|---|---|
| **Cost rate** | What a delivery day costs us | Cost, margin |
| **Charge rate** | What we bill the client per day | Revenue under T&M |

Charge rates may be overridden by a **client rate card** (negotiated, framework, or preferred-supplier rates). Cost rates never are.

ASSUMPTION: cost rates are held per grade, not per person. Per-person costing is more accurate and more sensitive. Owner: Harry. Raised: 2026-08-18. → REVIEW Q2.

---

## 4. Capacity and availability

The part spreadsheets get wrong most often.

For a person `p` in week `w`:

```
availableDays(p, w) = workingDays(w)
                    − publicHolidays(w)
                    − leave(p, w)
```

```
deliverableDays(p, w) = availableDays(p, w) × targetUtilisation(p)
```

**Utilisation is not a discount on price. It is a constraint on capacity and a driver of cost recovery.** Applying it in the wrong place is how a model shows healthy margin on work that cannot be staffed.

- Applied to **capacity**, it caps how many delivery days a person can supply.
- Applied to **cost**, it determines how much of their fully-loaded cost must be recovered by billable work.

Doing both simultaneously without noticing double-counts the effect. The engine must be explicit about which is being applied where.

→ REVIEW Q3 — this must be resolved against the real Excel models before M1.

**Ramp-up:** people joining an engagement are not productive on day one. Modelled as a productivity multiplier over the first `n` weeks.

**Shared people:** a person may be allocated across concurrent engagements. Total allocation across all engagements must not exceed their deliverable days. Whether the engine enforces this in M1 or M4 depends on REVIEW Q3/Q6.

---

## 5. Allocation

An **Assignment** binds supply to demand:

```
Assignment {
  workstream, role, grade
  person?            // optional at bid stage
  startWeek, endWeek
  allocation         // fractional FTE, e.g. 0.6
  rampWeeks?
}
```

Effort delivered by an assignment in week `w`:

```
effortDays(a, w) = allocation(a)
                 × availableDays(a.person ?? standardWeek, w)
                 × rampFactor(a, w)
```

Total engagement effort:

```
totalEffortDays = Σ over assignments Σ over weeks  effortDays(a, w)
```

**Team shape** — the distribution of effort across grades — is derived, not entered. It drives the blended rate, and it is the first thing a client challenges.

```
gradeMix(g) = effortDays(g) / totalEffortDays
```

---

## 6. Cost

```
cost(a, w)   = effortDays(a, w) × costRate(a.grade)
totalCost    = Σ cost(a, w)  +  nonBillableCost  +  expenses
```

**Non-billable cost** covers effort that is real but not charged: PMO overhead beyond the billed allocation, pre-sales carried into delivery, QA and assurance time, account management. It must be modellable or margins come out flattering.

**Expenses** — travel, subsistence, licences, cloud, third-party — may be rechargeable or absorbed. The flag matters: an absorbed expense hits margin, a rechargeable one does not.

ASSUMPTION: cost rates are fully loaded (salary, employer costs, benefits, overhead allocation). If they are salary-only, an overhead multiplier is required and every margin figure changes. Owner: Harry. Raised: 2026-08-18.

---

## 7. Revenue

Revenue depends entirely on the commercial structure — see `commercial-models.md`. The base case:

```
T&M revenue(a, w) = effortDays(a, w) × chargeRate(a.grade, clientRateCard)
```

---

## 8. Derived metrics

The numbers a Head of Commercial actually looks at.

| Metric | Formula | Note |
|---|---|---|
| Gross margin | `revenue − cost` | Absolute |
| Gross margin % | `(revenue − cost) / revenue` | The headline. Guardrails are set against it. |
| Blended day rate | `revenue / totalEffortDays` | What the client is effectively paying per day |
| Blended cost rate | `cost / totalEffortDays` | |
| Effective rate | `revenue / billableDays` | Diverges from blended rate under fixed price — the number that reveals whether a fixed price is actually good |
| Contribution | `revenue − directCost` | Before overhead allocation |
| Burn curve | cost by week, cumulative | Cashflow shape |
| Revenue curve | revenue by week, cumulative | Under milestone billing this is lumpy and matters |
| Peak headcount | max FTE in any week | Feasibility check for resourcing |
| Effort by grade | `effortDays(g)` | Team shape |
| Discount vs standard | `1 − (revenue / revenueAtStandardRates)` | What we actually gave away |

**Rounding rule:** all money is held in integer minor units. Rounding happens once, at presentation, using half-up. Rates are held to 2 decimal places. Effort is held to 2 decimal places of a day. No intermediate rounding — that is the source of spreadsheet drift.

---

## 9. Validation rules

The engine should refuse, or loudly flag, models that are internally inconsistent. Each of these represents a real failure mode in bespoke spreadsheets:

- An assignment extends beyond its workstream's dates
- A person is allocated beyond their deliverable capacity
- A phase has no assignments (planned but unstaffed)
- A milestone falls outside the plan's dates
- A grade has no cost rate, or no charge rate, and is used
- Gross margin is negative, or breaches the configured guardrail
- Peak headcount exceeds a stated resourcing constraint
- Total milestone payment values do not sum to the contract value
- Utilisation is applied to both capacity and cost without an explicit flag

---

## 10. Open modelling questions

Tracked in `REVIEW.md`. The ones that most change the engine:

- **Q2** — cost rates per grade, per person, or both
- **Q3** — where utilisation is actually applied today
- **Q6** — named people or role placeholders at bid stage

None of these can be answered from first principles. They come from the Excel models in `/context/inputs`.
