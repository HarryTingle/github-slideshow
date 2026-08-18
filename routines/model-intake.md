# Routine — Model intake

**Trigger:** a new artefact lands in `context/inputs/` — an Excel model, a rate card, brand guidelines, a proposal template, a signed contract.
**Runtime:** 45–90 minutes for a substantial Excel model.
**Output:** structured extraction into `/context`, new open questions, an updated `INDEX.md`.

This is the highest-value routine in the workspace. A real engagement model contains the true domain model, the true edge cases, and the errors the product exists to prevent. Reading it properly is worth more than a week of reasoning from first principles.

## Steps

### 1. Register
Add a row to `context/inputs/INDEX.md`: filename, what it is, which engagement or period, date received. Confirm it is redacted — client names, individual salaries and named personal cost rates removed or pseudonymised.

### 2. Map the structure
Before reading any formula: what are the sheets, what does each do, and where does the data flow? Note which sheets are inputs, which are calculation, which are output. Note which are dead.

### 3. Extract the taxonomy
- What roles exist? What grades? Are they independent axes or one ladder? *(→ `domain-model.md` §3, REVIEW Q6)*
- What rates are held, and are they cost, charge, or both? Fully loaded or salary-only?
- What is the unit of effort — days, hours, FTE-months?
- What is the calendar resolution — weeks, months, sprints?

### 4. Extract the maths
Follow the formulas, not the labels. For each derived number, write down the actual formula and check it against `domain-model.md`. Specifically hunt for:
- **Where is utilisation applied?** Capacity, cost, both, or inconsistently? *(REVIEW Q3 — the single most consequential question in the workspace)*
- How is availability handled — holidays, leave, part-time, ramp?
- How is non-billable effort treated?
- Where does rounding happen, and does it drift?
- Is margin over revenue or over cost?

### 5. Extract the commercial structure
Which structure is used? How is contingency applied — to effort, to price, or not at all? How are milestones valued? If outcome-based, exactly how is benefit defined and measured? *(→ `commercial-models.md`, REVIEW Q4)*

### 6. Find the errors
Every bespoke model has them, and each one is a product requirement in disguise:
- Broken or out-of-range references
- Hardcoded numbers where a formula should be
- Inconsistent assumptions between sheets
- Rows inserted outside a formula's range
- Rounding applied mid-calculation
Record each as a validation rule candidate for `domain-model.md` §9.

### 7. Capture the totals
Record the headline numbers — total effort days, cost, revenue, margin %, peak headcount, blended rate. **These become the golden test.** If this is the reference engagement, they are the acceptance criterion for M1.

### 8. Write it up
- Update `context/domain-model.md` and `context/commercial-models.md`, citing the source file
- Replace reasoned defaults with observed reality, and say in `REVIEW.md` what changed
- Raise every new unknown as an open question with an owner
- Mark the input as `Ingested` in `INDEX.md`

## How you know it worked

At least one `ASSUMPTION:` in `/context` has been replaced by an observed fact, and the headline totals are recorded well enough to write a test against.
