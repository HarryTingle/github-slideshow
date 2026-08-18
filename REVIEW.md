# REVIEW

The standing quality bar and the running log. `ROADMAP.md` says where we are going; this file says whether what we built is any good, and what we still do not know.

**Append, do not rewrite.** History matters more than tidiness here.

---

## 1. The bar

Work in this repo is judged against five questions. Anything that fails one is not done.

1. **Is the maths right?** Can the calculation be reproduced by hand, and is there a test that proves it? Does it match the reference engagement's real numbers?
2. **Is it traceable?** Can a user click any figure and see where it came from? A number nobody can defend in front of a client is a liability, not a feature.
3. **Does it survive a real bid?** Not a demo dataset — a real engagement with awkward availability, mid-project grade changes and a client who wants a different commercial shape.
4. **Would we show it to the SLT?** Output quality is a product requirement, not polish applied at the end.
5. **Is it configurable, not assumed?** Our rate card, our grades and our brand must be data. The moment they are hard-coded, M5 dies.

### Per-artefact checklists

**Engine change**
- [ ] Unit tests cover happy path, boundaries, and one real-world case
- [ ] Money in minor units; rounding is explicit and specified
- [ ] No presentation logic; no I/O; no dependencies
- [ ] Golden-file test still reproduces the reference engagement

**Spec**
- [ ] States the user and the job, not just the feature
- [ ] Every calculation written out in full, with worked example
- [ ] Acceptance criteria are testable by someone who did not write them
- [ ] Cites the `/context` files it depends on
- [ ] Assumptions tagged `ASSUMPTION:` with an owner

**Customer evidence**
- [ ] Quotes actual words, dated, attributed to a role
- [ ] Separates what they said from what we concluded
- [ ] Contradicting evidence recorded, not discarded

**Client-facing output**
- [ ] On brand, per the ingested guidelines
- [ ] Every figure traceable
- [ ] Plain commercial English — a CFO's vocabulary, no jargon, no hedging

---

## 2. Review log

Newest first. One entry per review. Use `routines/weekly-review.md`.

### 2026-08-18 — Workspace established
**Reviewed:** initial scaffold of the AI employee workspace.
**Outcome:** `CLAUDE.md`, `ROADMAP.md`, `REVIEW.md`, `/context`, `/customers`, `/specs`, `/demos`, `/routines` created. Domain model, commercial structures and initial specs written from first principles pending real source material.
**Quality note:** the domain model and rate/grade structures are currently *reasoned defaults, not evidence*. Everything derived from them is provisional until M0 ingestion completes. This is the single largest risk in the workspace right now — a plausible-but-wrong domain model is harder to spot than an obviously missing one.
**Next:** run `routines/model-intake.md` against the real Excel models and rate card, then re-review `context/domain-model.md` and `context/commercial-models.md` line by line.

---

## 3. Open questions

Live list. Move to *Resolved* with the answer and the date — do not delete.

| # | Question | Why it blocks or bends the work | Owner | Raised |
|---|---|---|---|---|
| Q1 | Which real engagement becomes the reference model for the golden test? | Defines the true scope of M1 and the shape of the domain model. | Harry | 2026-08-18 |
| Q2 | Are cost rates held per grade, per person, or both? | Changes the core data model. Per-person cost is more accurate but harder to source and more sensitive to share. | Harry | 2026-08-18 |
| Q3 | What is the real utilisation assumption used in pricing today — and is it applied to cost, to capacity, or to both? | This is the most common source of error in bespoke Excel models. Getting it wrong makes every margin number wrong. | Harry | 2026-08-18 |
| Q4 | How are outcome / ROI-share deals actually structured today? Percentage of measured benefit, gain-share against a baseline, or bonus on milestone? | M2 cannot model what we cannot define. Also the least standardised structure in the market. | Harry | 2026-08-18 |
| Q5 | Who signs off a deal, against what thresholds? | Determines the SLT pack contents and the guardrail logic. | Harry | 2026-08-18 |
| Q6 | Do resourcing teams work from named people or from role placeholders at bid stage? | Changes whether the resource model is people-first or role-first. | Harry | 2026-08-18 |
| Q7 | Is Excel import needed in M1 or can it wait until M3? | Import is a large, unbounded problem that could stall the engine. | Harry | 2026-08-18 |
| Q8 | Is "Scope" an acceptable working name, or is there an existing internal name? | Cheap to change now, expensive later. | Harry | 2026-08-18 |

### Resolved

| # | Question | Answer | Resolved |
|---|---|---|---|
| Q0 | Is this repo workspace-only or workspace + app code? | Workspace and application code live together here. | 2026-08-18 |
| Q0a | Internal tool or commercial product first? | Internal first, then productise. We are customer zero. | 2026-08-18 |
| Q0b | What anchors milestone one? | A correct, tested modelling engine. | 2026-08-18 |

---

## 4. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The domain model is invented rather than observed | Everything built on it is subtly wrong and nobody notices until a bid is lost | M0 ingestion of real Excel models is the gate to M1 |
| Excel remains easier for the last 10% of edge cases | Users keep a shadow spreadsheet and the tool never becomes the source of truth | Excel export/interop as a first-class feature; capture every edge case that sends someone back to Excel |
| Internal-only assumptions leak into the product | M5 productisation requires a rewrite | Configurability is a review criterion on every change |
| Commercial flex is fast but produces indefensible numbers | Loses trust exactly where the product must be strongest | Traceability requirement; guardrails on margin thresholds |
| Scope creep into project management or finance | Never finishes the thing that actually wins bids | Explicit out-of-scope list in `ROADMAP.md` |
