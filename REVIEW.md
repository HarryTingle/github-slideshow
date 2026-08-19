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

### 2026-08-19 — Excel export, and a formula that disagreed with the model
**Reviewed:** `packages/engine/src/workbook.ts` and the export control on Outputs.

**The shape.** Six sheets — Summary, Scenarios, Rates, Allocation, Resourcing, Detail. Detail is the spine: one row per assignment-week carrying availability, rates and arithmetic. Every other sheet summarises it by formula rather than restating it, so a reader can follow any figure down to the week it came from.

**Formulas, not frozen totals.** A workbook of values is a screenshot with extra steps. The point of exporting is that a colleague or a client can check our arithmetic, which they can only do if the arithmetic is there. Each formula is written with its computed value cached alongside, so Excel recalculates and agrees while anything that reads the file without calculating still shows a number.

**Which is where the export nearly shipped a lie.** The Rates sheet first computed revenue per grade as `days × rate` — the obvious formula, and wrong. Revenue is a sum of per-line figures each rounded to the penny; multiplying a rounded day count by a rate does not reproduce it. On the seeded plan the gap was £6.74 on the Director line. Small, and precisely the "your model does not add up" moment that costs a deal. The Rates sheet now uses SUMIF over Detail, which is exact.

**How it was caught, and the decision that made catching it possible.** The workbook builder is pure data — rows, formulas, and the value each formula should produce — so it lives in the engine rather than the app. That let a test evaluate every formula against the literal cells around it and assert it equals the cached value. 280-odd formulas checked; the evaluator understands only the shapes the export writes and throws on anything else, so a new formula cannot slip past untested.

**A misdiagnosis worth recording.** The headless browser reported the downloaded file as "download" rather than the engagement name, and I rewrote the save path by hand to fix it. A control test — a plain blob anchor with an explicit download attribute — reported "download" too, so the harness simply cannot observe the filename here. The rewrite was reverted; the filename is asserted on the plan by unit test instead.

**Known limit:** the published preview runs in an embedded frame, which blocks a page from saving files. The control says so rather than failing silently. Run the app locally to get the workbook.

### 2026-08-19 — Overview becomes a report, and leave becomes personal
**Reviewed:** the tab reorder, the scenario picker's move, and per-person leave.

**Overview reads last and reads only.** It carried the scenario picker, which made it the one page that both reported the model and changed it. Now it holds no control that writes — verified by counting inputs on the page, which is zero — and the app opens on the delivery plan instead, because a summary of a model has nothing to offer someone who has just arrived. The eyebrow names the scenario being reported so it is never ambiguous which deal the numbers belong to.

**The scenario picker moved to the top of Commercials**, where choosing a deal is the first thing you do, and the cramped select in the desk bar came out with it. One picker, in the place the decision is made.

**Per-person leave.** The allocation grid gained a mode switch: the same rows and the same weeks, showing either days booked or leave taken. Reusing the grid rather than building a second surface means leave is edited where the plan is, at the same resolution.

**What the row head had to explain.** Booking leave usually does *not* change total effort, which surprises people. The allowance is already provided for across the weeks somebody works, so putting it in the diary only decides which weeks lose the capacity. The row head therefore shows "3.0 of 6.2 booked", and turns terracotta once bookings pass the pro-rata allowance, because beyond that point it genuinely does cost capacity.

**A test I had to correct.** I first asserted that booking leave never changes the total. It does — by 0.19 days in the seeded plan — because J. Moreau is full time on the build and 0.6 on handover, so a day off during the build costs more than the same day smeared across a mixed allocation. The invariant only holds where allocation is flat. Two tests now: the exact one on a flat allocation, and the real behaviour on a varying one, which is a reason *when* leave falls is worth modelling at all.

### 2026-08-19 — Undo, finally
**Reviewed:** undo and redo across the whole model.

**Why now.** This has been logged as "the next thing that will hurt" for three sessions, and the pricing desk made it acute rather than merely likely: the target-margin solve rewrites *every* rate in the deal on one click. Before this, the only way back from a change you did not like was Reset, which throws away the afternoon along with the mistake.

**The part that decides whether undo is worth having.** Typing "905" into a rate box fires three model updates. Undone naively, that is three steps, and walking back one character at a time is worse than no undo at all. Edits therefore carry a coalesce key — the field they touch — and a run of changes to the same field within 700ms extends the step already on the stack instead of adding another. Verified in the browser: typing 905 one character at a time is one undo, and it lands back on 740.

**Two judgement calls:**
- The shortcut is intercepted even inside a text field. Every input on these screens is controlled, so the browser's own undo fights the model rather than helping — and since a run of keystrokes in one field is already a single step, ours is what was meant anyway.
- Each step is labelled by what it changed, so the control reads "Undo the Consultant rate" or "Undo solving for 30%" rather than a bare arrow. Undo you cannot predict is undo you do not trust.

**Still absent:** history does not survive a reload, and sensitivity is deliberately outside it — the sliders are a lens on the model, not an edit to it.

### 2026-08-19 — A pricing desk, designed against the tool it replaces
**Reviewed:** `packages/engine/src/pricing.ts` and the pricing desk on the Commercials page. Decision recorded as `context/decisions/0004-pricing-levers.md`.

**Where it came from.** Harry shared the pricing screen from the tool he built before this, liked being able to fine-tune towards a margin, and said he did not think it was the best way to do it. Reading it carefully was worth more than any amount of speculation: it showed what to keep (one screen, margin always visible, per-row margin, price as a lump sum *or* a percentage of build-up, blended vs standard) and four specific things that cost time — the same grade rate edited once per row, no indication of which lever is worth pulling, no goal-seek, and annual leave sitting next to price as if it were a commercial control.

**The one I pushed back on.** Leave is a fact about capacity. Editing it to reach a margin does not improve the deal; it makes the plan wrong, in the direction of under-resourcing, which surfaces months later as an overrun. It stays on the delivery plan. Worth saying plainly rather than quietly not building it.

**What the leverage columns turned up**, which is the part I did not expect to be so stark:
- Under T&M the leverage follows *volume*, not rate. +£25 a day on Consultant is worth +0.62pp; the same £25 on Director is worth +0.01pp. Sixty times the effect for the same concession, and nothing in a rate card tells you that.
- Under a fixed price every rate lever is worth exactly zero, and the desk says so rather than letting someone spend ten minutes finding out.
- Under a fixed price the lever moves to team shape, concentrated at the top: a week moved from Associate Director down a rung is +1.12pp against +0.22pp at Consultant.
- Trading down is not always right — Senior Manager → Manager is −0.12pp at framework rates, because Senior Manager carries the better margin. A blanket "use cheaper people" would destroy margin here.

**Three defects the rendered page caught**, none of which a test would have: the margin read red when a solve landed exactly on target (float comparison against the displayed precision); the rate inputs were stretched across the column by a global `input[type=number] { width: 100% }` outranking the class; and a column headed "Cost" sat beside "Revenue" showing a rate rather than a total. That is the third session running where the real bugs appeared on screen rather than in the suite.

**Open:** goal-seek solves with a uniform rate move, which holds the shape of the deal but will not find the cleverest answer. The leverage columns are there for that, and it stays a judgement rather than a solve until the tool has been used on a live bid.

### 2026-08-19 — Days a week, and phases you can add
**Reviewed:** the units change on the allocation grid, and phase/workstream editing.

**Units.** Cells now read days a week — five is a full week — rather than fractional FTE. "Four days a week" is how the conversation actually happens; 0.8 is a translation people do in their heads and get wrong. The model still holds allocation as a fraction, because that is what composes correctly with a week carrying a bank holiday, so the conversion sits in the engine with a round-trip test across several working-week lengths rather than being done twice in the UI.

The distinction the grid now has to carry: **a cell books time, and time booked is not time delivered.** Five days booked in a week with a public holiday delivers four. The grid shows the booking, the engine computes the delivery, and the trace panel shows the step between them.

**A regression the change exposed.** The terracotta highlight marking short weeks fired on `availableDays < workingDaysPerWeek`, which was fine until annual leave started shaving *every* week by the same sliver — at which point it painted nearly the whole grid and stopped meaning anything. It now ignores the leave provision and marks only weeks short for a specific reason: a public holiday or booked leave. 15 cells of 238, which is a flag again rather than a wash. Caught by looking at the rendered grid, not by a test.

**Phases and workstreams** can be added and deleted in the grid. Deleting cascades — an orphaned workstream would keep costing money from a phase that no longer exists — so the control asks first and names what would go ("Delete + 3 workstreams, 9 roles?"). Two clicks rather than a browser dialog, because `window.confirm` is blocked in a sandboxed frame and, with no undo, deleting nine people should take more than a stray click. A plan can now be emptied completely and rebuilt, which is asserted by test.

### 2026-08-19 — The rate card was living in the wrong place
**Reported:** the new levels and capabilities had not pulled through into the delivery planner.

**Root cause, reproduced before changing anything:** a saved engagement carried its own copy of the grade ladder, capability list, rate card and guardrails, and the saved copy shadowed the seed entirely. Anyone who had edited the model once was pinned to whatever reference data existed that day — old grades in the dropdowns, old rates behind every figure, leave at zero. Clearing the browser fixed the symptom and hid the defect.

**Why it matters beyond the demo:** reference data belongs to the *practice*, not to a document. Left alone, this is a saved bid that keeps pricing at last year's rates, silently, with nothing on screen to say so. That is the same class of failure as the spreadsheet problems in the pain statement, reproduced in the tool meant to fix them.

**Fix:** `packages/engine/src/reference.ts`. A saved document is reconciled against the current practice reference on load: the ladder, capabilities, rates and guardrails are replaced, and the document's own references are remapped onto them — by name where a name still exists, otherwise by position in the ladder, so a grade that sat 5th of 6 lands 7th of 8 rather than at the bottom. Anything that moved is reported on screen rather than applied quietly, because a grade that silently becomes a different grade changes the price. An explicit annual-leave setting is respected, including zero; only a document predating the field takes the practice default.

**Also:** the week-range controls came off the phase and workstream rows at Harry's request. Phases and workstreams now size themselves to the work staffed on them, which is one fewer thing to keep in step and one fewer way to disagree with the grid.

### 2026-08-19 — Real cost rates and annual leave; a discrepancy worth resolving before anything else
**Reviewed:** the resourcing model extract — charge and cost rates for all eight grades, billable days, and annual leave.

**Outcome:** both sides of the rate card are now real and asserted by test. Margin percentages are real for a given plan. Annual leave is modelled as a 23-day allowance pro-rated to the weeks each person works, with booked leave counted against it rather than added to it.

**A conclusion I got wrong yesterday, corrected.** On the charge-only card I wrote that the doubling between Senior Manager and Director meant "swapping a Director for a Senior Manager is a much larger concession than it looks". With real cost that is backwards. Margin *falls* as seniority rises — Associate 34.9%, Director 20.5% — so trading a Director down **improves** margin. That is a commercial conclusion, it was inferred from a rate card with the cost half missing, and it would have been repeated in front of a client. Half a rate card is not most of a rate card.

**The finding that matters most.** The extract shows Billable Days 253, Estimated AL −23, and then carries **253** forward rather than 230. 253 reconciles exactly to 261 weekdays less 8 public holidays, so the 23 days are not inside it. Either leave is applied somewhere downstream of this extract, or it is not applied at all — in which case planned capacity is overstated by about **9%**, and every fixed-price bid built on it is under-resourced by the same margin. Raised as Q19. This is precisely the class of error in the pain statement, found on the first real resourcing artefact we have looked at.

Rather than pick a side, the app models leave properly, exposes the allowance as an editable field, and prints a capacity basis on the plan page that annualises its own calendar to **253 days before leave and 230 after** — the same two numbers as the sheet, so the two models can be compared instead of argued about.

**Guardrails re-set, and still invented.** The old thresholds (40% gross margin, 35% downside) were chosen against a placeholder cost base implying a 50%-margin business. The real card runs at 20–30%, so every scenario breached at once and the guardrails said nothing. They are now 20% / 10% / 10% / £75k — inside the range the real card produces, and therefore discriminating again. They remain guesses (Q5), and a wrong guardrail is worse than no guardrail because it launders a bad deal through an approval.

**What the demo now shows, truthfully:** T&M at framework rates returns 20.7%; fixed price 22.0%; the hybrid 21.5%; and the outcome-share deal has the best expected margin at 25.2% and a downside that **loses money** at −9.3%. It is the only breach.

**Quality note:** effort dropped 8.6% (283.9 → 259.6 days) the moment leave was applied. Any earlier figure quoted from this workspace is now wrong, which is worth remembering about every figure still in it.

### 2026-08-19 — Real charge rates in; margin still invented
**Reviewed:** the Solutions standard day rate card, now loaded verbatim and asserted by test.

**Outcome:** charge rates are real for all eight grades. Revenue is therefore correct for any given plan — the first genuinely sourced output the app produces.

**The thing to be careful about.** Cost rates were not supplied, and margin is revenue minus cost. So the app now shows a real revenue number sitting next to a margin, a downside case, a break-even overrun and a set of guardrail verdicts that are all built on an invented cost base. Half-sourced numbers are more dangerous than wholly invented ones, because the sourced half lends its authority to the rest. Three responses:

1. Cost is derived from charge by one stated ratio (50% to Senior Manager, 42% above) rather than eight individually plausible figures — obviously a placeholder, auditable in a line, and it does not pretend to knowledge we lack.
2. The provenance marker on every page now reads *"Charge rates real · cost placeholder"* rather than the vaguer "Fictional data", and the cost tile says the margins below it are provisional.
3. A test asserts the cost/charge ratio holds. If anyone ever replaces it with hand-picked numbers, that test fails — which is the point, because at that moment every margin in the app becomes a fabrication wearing the authority of a real rate card.

**Cost of the choice:** grade mix barely moves margin below Associate Director, because the ratio is flat there. That flattens one of the more interesting parts of the model and is a reason to chase the real cost rates rather than a reason to invent better-looking ones.

**Worth noticing in the card itself:** the rate roughly doubles between Senior Manager (£1,350) and Director (£2,500), far faster than cost plausibly rises. That shape means swapping a Director for a Senior Manager is a much bigger concession than it looks — exactly the kind of thing the comparison view exists to make visible.

**Scenario prices re-set** against the new revenue base. The demo story is now at its sharpest: the outcome-share deal has the **best** expected margin of the four and the **worst** downside, and it is the only scenario that breaches a guardrail.

### 2026-08-19 — First real domain input, and a bug that made the product unusable
**Reviewed:** the grade ladder and capability list supplied by Harry, now in `context/domain-model.md` §3 and the seed; and a reported bug in the consultant name field.

**The bug.** You could not type a space between a first name and a surname. `setPersonName` trimmed on every keystroke, and because the field is controlled, the space was stripped the instant it was pressed — "Ian Payne" arrived as "IanPayne". The name is now stored exactly as typed and tidied on blur instead.

Worth recording *how* it was nearly missed: the first regression test I wrote fed whole strings in and passed against the broken code as well as the fixed code. A test that passes before and after the fix proves nothing. The real test types one character at a time and feeds the stored value back in each round, exactly as a controlled input does — and it fails with `IanPayne` against the old behaviour, which was verified by reintroducing the trim.

**The taxonomy.** Eight grades (Associate → Director) and six capabilities. This confirms an assumption that had been sitting in the domain model since day one: capability and grade are independent axes, not a single ladder.

**The risk this creates.** The seed now carries a *real* structure and *invented* rates. A model that is right about the shape and wrong about the numbers is more persuasive than one that is obviously fake, so the "fictional data" marker is doing more work than it was yesterday. Recorded in `CLAUDE.md`: the rate card must be replaced wholesale when the real one arrives, never adjusted towards it.

**Also:** scenario prices were re-set against the new cost base so the demo still tells the truth — outcome share remains the only scenario that breaches a guardrail, and it breaches on the downside case, which is the point.

### 2026-08-19 — The allocation grid became an editor
**Reviewed:** `packages/engine/src/edit.ts` (31 new tests) and the rewritten allocation grid.

**Outcome:** phase, workstream and assignment dates, consultant names, levels and capabilities, the engagement start date, duration and sprint length are all editable in the grid, and every cell takes a number rather than only the filled ones. Sprint and calendar-quarter rulers sit above the week numbers.

**The decision worth recording.** The structural edits went in the *engine*, not the component, because they enforce an invariant rather than manipulate a view: a phase contains its workstreams, and a workstream contains its assignments. Growth is automatic and shrinking is always explicit, since silently dropping weeks would silently drop effort. That invariant is what lets the timeline and the grid be two views of one set of fields instead of two copies to keep in step — and it is provable by test, which a click-through never is.

**Two behaviours chosen deliberately, both worth challenging:**
- Typing into a cell beyond a row's dates extends the row, and every week stepped over is set to **zero**. Extending alone would apply the default allocation to those weeks and add effort nobody asked for. Asserted by test: typing 0.5 into one empty week adds exactly 2.5 days.
- A named person keeps their own cost rate whatever level they are booked at — their salary does not change because the row does. Charge rate follows the level, cost does not. This is right, but it looks wrong the first time you see it, so the trace panel shows both rates.

**Corrected the same day.** The per-row week-range control was redundant: the cells already say when a role starts and stops, and two ways to set the same thing is one too many. Removing it exposed a real gap — the cells could only extend a row, never shorten it — so clearing a box at either end now trims the row, collapsing past any zeros an earlier extension left behind. Extending to a week and clearing it is now an exact round trip, asserted by test. Phases and workstreams keep their range controls, having no cells of their own.

**Quality note:** the grid is now the primary editing surface and has no undo. Reset is all-or-nothing. That is the next thing that will hurt. *(Resolved 2026-08-19 — see the undo entry above.)*

### 2026-08-19 — Engine and app built on fictional data
**Reviewed:** `packages/engine` (45 unit tests) and `apps/web` (four pages), built to specs 0001–0004.

**Outcome:** M1 and M2 are functionally complete and M3 is complete on screen. The app builds clean, typechecks, and all four user flows were exercised in a browser: switching scenario, editing an allocation cell and watching every downstream number move, applying sensitivity across all scenarios, and generating the three audience views.

**Three changes the build forced on the specs.** Recorded here rather than made silently:

1. **Rounding policy reversed.** Spec 0001 called for no intermediate rounding and a single rounding at presentation. Implemented instead as rounding once per (assignment × week) line, half-up, with totals as the sum of rounded lines. The spec's approach produces a total that differs from the visible detail by a penny or two; in a product whose promise is traceability, a total that does not equal the lines a user can point at is a worse failure than the drift. Spec updated, test asserts `sum(lines) === total`.
2. **Payment terms added to the engagement.** Without a billing lag every structure computed as cash-neutral and maximum cash exposure was always zero — a metric that existed but said nothing. Cost is now incurred weekly and cash lands after the agreed terms.
3. **Case margins put on one basis.** Downside/expected/upside were being computed on direct cost while the headline gross margin used fully-loaded cost, so the T&M downside margin (51.4%) read *higher* than its gross margin (47.8%). Caught by looking at the rendered page, not by a test. Every case is now stated fully loaded, and a test asserts the downside can never beat the expected case.

**Two bugs found and fixed during the build**, both invisible until the app rendered:
- `analyse` never applied a scenario's rate card, so every scenario silently billed at standard rates and the discount metric always read 0%.
- The fixed-price-below-cost check compared a *phase* price against the *whole engagement's* cost, flagging every hybrid deal as an error.

**Quality note:** the engine is correct against arithmetic we invented. The golden test — reproducing a real engagement's Excel model to the penny — is the one that matters and it cannot be written yet. Until M0 ingestion happens, "the maths is right" means "the maths is internally consistent and matches its own worked examples", which is a much weaker claim and should be described that way to anyone who asks.

**Deliberately not built:** target utilisation. Where it applies is Q3 and guessing would poison every margin figure in the app.

**Next:** ingest the real Excel models and rate card (M0), then write the golden test.

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
| Q3 | What is the real utilisation assumption used in pricing today — and is it applied to cost, to capacity, or to both? | This is the most common source of error in bespoke Excel models. Getting it wrong makes every margin number wrong. | Harry | 2026-08-18 |
| Q4 | How are outcome / ROI-share deals actually structured today? Percentage of measured benefit, gain-share against a baseline, or bonus on milestone? | M2 cannot model what we cannot define. Also the least standardised structure in the market. | Harry | 2026-08-18 |
| Q5 | Who signs off a deal, against what thresholds? | Determines the SLT pack contents and the guardrail logic. | Harry | 2026-08-18 |
| Q6 | Do resourcing teams work from named people or from role placeholders at bid stage? | Changes whether the resource model is people-first or role-first. | Harry | 2026-08-18 |
| Q7 | Is Excel import needed in M1 or can it wait until M3? | Import is a large, unbounded problem that could stall the engine. | Harry | 2026-08-18 |
| Q8 | Is "Scope" an acceptable working name, or is there an existing internal name? | Cheap to change now, expensive later. | Harry | 2026-08-18 |
| Q9 | Is rounding per line, with totals summing the visible detail, the right call — or does finance expect unrounded totals? | Decided in the build for traceability. Reversing it later changes every stored figure. | Harry | 2026-08-19 |
| Q10 | What are the real payment terms, and do they differ by client or structure? | Currently a flat 4 weeks. Drives the whole cash-exposure metric. | Harry | 2026-08-19 |
| Q11 | Should contingency reduce reported margin, or sit outside it as a reserve? | Currently held against the downside case only. Firms differ, and it changes the headline number. | Harry | 2026-08-19 |
| Q12 | Is a stated resourcing capacity constraint (currently hard-coded at 5 FTE on the demand chart) a real concept, and where does the number come from? | It is the one figure in the UI not sourced from the model. | Harry | 2026-08-19 |
| Q13 | Should moving a workstream move the team staffed on it, or hold them still? | Currently it moves them, on the reasoning that a workstream that slips takes its team with it. The opposite is defensible when people are committed to dates rather than to work. | Harry | 2026-08-19 |
| Q14 | Does a person's level ever change mid-engagement (promotion, or booked at a different grade per workstream)? | Level is currently held per assignment, so the same person can sit at two levels. That may be a feature or a trap. | Harry | 2026-08-19 |

### Resolved

| # | Question | Answer | Resolved |
|---|---|---|---|
| Q0 | Is this repo workspace-only or workspace + app code? | Workspace and application code live together here. | 2026-08-18 |
| Q0a | Internal tool or commercial product first? | Internal first, then productise. We are customer zero. | 2026-08-18 |
| Q0b | What anchors milestone one? | A correct, tested modelling engine. | 2026-08-18 |
| Q2 | Are cost rates held per grade, per person, or both? | Per grade. The engine keeps a per-person override for people paid off-band. | 2026-08-19 |
| Q15 | What are the real cost rates by grade? | Received. Associate £342 to Director £1,988. | 2026-08-19 |
| Q6a | Are capability and grade independent axes, or one ladder? | Independent. Two separate lists supplied, 8 grades × 6 capabilities. | 2026-08-19 |

---

## 4. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The domain model is invented rather than observed | Everything built on it is subtly wrong and nobody notices until a bid is lost | M0 ingestion of real Excel models is the gate to M1 |
| A working app makes the invented data feel authoritative | Someone quotes a Meridian figure, or assumes the model is validated because it renders convincingly | Every page carries a "fictional data" marker; the README and seed file both say so plainly. Weak mitigation — real data is the only real fix. |
| Excel remains easier for the last 10% of edge cases | Users keep a shadow spreadsheet and the tool never becomes the source of truth | Excel export/interop as a first-class feature; capture every edge case that sends someone back to Excel |
| Internal-only assumptions leak into the product | M5 productisation requires a rewrite | Configurability is a review criterion on every change |
| Commercial flex is fast but produces indefensible numbers | Loses trust exactly where the product must be strongest | Traceability requirement; guardrails on margin thresholds |
| Scope creep into project management or finance | Never finishes the thing that actually wins bids | Explicit out-of-scope list in `ROADMAP.md` |
