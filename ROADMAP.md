# ROADMAP

**Product:** Scope — delivery planner & commercial modelling tool for consulting practices.
**Strategy:** Internal first, then productise. We are customer zero.
**Anchor:** Milestone 1 is a correct, tested modelling engine. Everything else is presentation on top of maths that must be right.

Last reviewed: 2026-08-20

---

## Why this sequence

The commercial pain is the sharp end — flexing T&M, fixed price and risk-share structures fast enough to win a bid. But you cannot flex commercials on top of a resource model you do not trust. So the order is: **get the resource maths right → make the commercials flex on top of it → make the outputs shareable → open it to the team → productise.**

Building the UI first would feel faster and would produce a tool nobody trusts with a real bid.

---

## M0 — Workspace and evidence *(in progress)*

Establish the operating system for the work and extract the real domain model from what already exists.

- [x] Workspace scaffold: `CLAUDE.md`, `ROADMAP.md`, `REVIEW.md`, `/context`, `/customers`, `/specs`, `/demos`, `/routines`
- [ ] Ingest existing Excel delivery & commercial models into `/context/inputs` → run `routines/model-intake.md`
- [x] Ingest rate card and role/seniority taxonomy → grade ladder, capabilities, charge and cost rates, annual leave, all in `context/domain-model.md` §3 and asserted by test
- [ ] Ingest brand guidelines and proposal templates → constrains output design in M3
- [ ] Confirm stack and architecture decision (`context/decisions/0002-stack-and-architecture.md`)
- [ ] Pick the reference engagement: one real, recently-run engagement whose model the app must reproduce exactly

**Done when:** the domain model in `/context` is derived from real artefacts rather than first principles, and one reference engagement is chosen as the golden test case.

---

## M1 — The modelling engine

A pure, tested calculation core. No UI. The unit of proof is: *the engine reproduces the reference engagement's Excel model, to the penny.*

- [ ] M1-0 Remove the Learning Lab / reveal.js scaffold and initialise the real project
- [ ] Domain primitives: role, grade, person, availability, rate (cost and charge), calendar
- [ ] Delivery plan: phases, workstreams, milestones, dependencies, durations in ISO weeks
- [ ] Resource model: allocation of people/roles to workstreams over time, at fractional FTE
- [ ] Capacity truth: utilisation, holiday, ramp-up, partial availability, shared people across engagements
- [ ] Cost model: cost of delivery from grade cost rates, including non-billable overhead
- [ ] Revenue model: T&M as the base case
- [ ] Derived metrics: gross margin, blended day rate, effective rate, contribution, burn curve by week
- [ ] Golden-file test reproducing the reference engagement end to end

**Done when:** a spreadsheet-free engine produces the same totals as the reference Excel model, and every number is unit tested.

**Spec:** `specs/0001-modelling-engine-core.md`, `specs/0002-delivery-plan-and-resourcing.md`

---

## M2 — Commercial flex *(built)*

The thing that wins bids. Same delivery plan, many commercial shapes, compared side by side in seconds.

- [x] Commercial structures: T&M, capped T&M, fixed price, milestone-based, retainer/pod, outcome & ROI share
- [x] Hybrid deals — a different structure per phase, summed
- [x] Rate strategy: per-grade rates, client-specific rate cards, discount measured against standard
- [x] Scenario engine: fork a scenario, change the structure, compare on one screen
- [x] Sensitivity: plan slip and additional discount, applied across every scenario at once
- [x] Risk & contingency: contingency on cost, downside/expected/upside cases, break-even overrun, cash exposure
- [x] Guardrails: thresholds with a plain-English explanation and a named approver
- [ ] Blended-rate break-even mix
- [ ] Discount ladders (volume, term, strategic)

**Done when:** a Head of Commercial can take a finished delivery plan and produce three defensible commercial options in under ten minutes.

**Spec:** `specs/0003-commercial-models-and-scenarios.md`

---

## M3 — Shareable outputs *(built, bar the brand)*

One model, three audiences. This is where the "no repeatable output" pain is killed.

- [x] Resourcing view — roles, FTE by week, named people, gaps to fill
- [x] Client view — approach, key dates, team shape as capability, commercial summary. Cost, margin, internal grades and other scenarios are structurally absent, not styled out of sight.
- [x] SLT sign-off pack — recommendation, every scenario considered, risk, guardrail status
- [x] Traceability: hover any allocation cell for the arithmetic behind it
- [x] Excel export — six sheets, formulas rather than frozen totals, every aggregate summing the Detail sheet
- [ ] Brand application from the ingested guidelines — **blocked on M0**
- [x] Output snapshots with a recorded version, so an issued pack does not change — and says what has moved since
- [ ] Approval trail

**Done when:** a full engagement can go from blank model to client-ready proposal section and SLT pack without touching Excel.

**Spec:** `specs/0004-shareable-outputs.md`

---

### Carried into M2/M3 as the app was used

- [x] Undo and redo across the model, with a run of keystrokes in one field as a single step
- [ ] History that survives a reload

## M4 — Collaboration

Consulting and commercial teams working on the same picture — the core of the promise.

- [ ] Multi-user projects and persistence (Postgres)
- [ ] Roles and permissions: delivery lead, commercial lead, resourcing, SLT approver
- [ ] Model versioning and change history
- [ ] Comments and review threads on a model
- [ ] Approval workflow for SLT sign-off

**Spec:** `specs/0005-collaboration-and-signoff.md`

---

## M5 — Productisation

Turn the internal tool into something another practice can buy.

- [ ] Multi-tenancy and configurable taxonomies (their grades, their rate card, their brand)
- [ ] Onboarding: import an existing Excel model and get a working plan out
- [ ] Templates and best-practice model library
- [ ] Design partner programme with 3–5 practices (see `/customers`)
- [ ] Pricing and packaging

---

## Out of scope for now

Recorded so we stop relitigating them:

- Time tracking / timesheets — we model plans, we do not replace the PSA system
- Invoicing and revenue recognition — export to finance, do not become finance
- CRM and pipeline management — a bid tool, not a sales tool
- Generic project management (tasks, tickets, Gantt-for-its-own-sake) — the plan exists to drive the commercials
- AI-generated delivery plans — tempting, but the trust problem must be solved before automation is added

---

## Open sequencing questions

| Question | Why it matters | Owner |
|---|---|---|
| Which real engagement becomes the reference model? | It defines the golden test and therefore the scope of M1. | Harry |
| Do we need Excel *import* in M1, or is export enough until M3? | Import is significantly harder and could stall the engine work. | Harry |
| How many concurrent engagements does a person get shared across in practice? | Determines whether cross-engagement capacity is M1 or M4. | Harry |
