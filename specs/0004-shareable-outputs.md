# 0004 — Shareable outputs

Milestone: M3
Status: Built — on screen; export and snapshots outstanding
Owner: Harry
Depends on: `context/business-context.md`, `specs/0003-commercial-models-and-scenarios.md`, brand guidelines in `context/inputs/`
Last updated: 2026-08-19

## Job to be done

One model, three audiences. The resourcing team needs to know who and when. The client needs a plan and a price they can believe. The SLT needs margin, risk and contingency laid out well enough to sign.

Today each of these is a bespoke rebuild — a screenshot to resourcing, a slide deck for the client, a summary tab for the SLT. This is pain point 4, and killing it is what turns the tool from a calculator into something the whole practice depends on.

## Why now

Until the outputs exist, the tool is a better spreadsheet used by one person. The outputs are what pull the other users in — and what make the model the source of truth rather than a source for one.

## Behaviour

Three generated views over the same model, plus export.

### Resourcing view
For the resourcing team.
- Roles and grades required, FTE by week
- Named people where known; **gaps clearly marked** where not
- Start and end dates per assignment, peak headcount, weeks of highest demand
- Exportable to Excel and to whatever the resourcing process actually consumes

### Client view
For the proposal. On brand, proposal-ready, no rebuild.
- Delivery approach: phases, workstreams, milestones
- Team shape: roles and seniority, expressed as capability rather than internal grades
- Commercial summary for the selected scenario, at the level of detail the client is being given
- **Never exposes:** cost rates, margin, internal grade names, other scenarios, or guardrails

### SLT sign-off pack
For deal approval.
- Revenue, cost, gross margin % — for every scenario, not only the recommended one
- Contingency, downside case, break-even overrun
- Max cash exposure and the revenue/cost curve
- Guardrail status with each breach explained
- The recommendation, and what is being asked of the approver
- An approval trail: who saw what, when

### Excel export
- Full model as a workbook the client or a colleague can interrogate without the app
- Formulas preserved where practical, not just values — interrogability is the point
- Sheet-per-view, matching the three views above

## Data

Introduces `Output { id, type, scenarioId, generatedAt, generatedBy, snapshotHash }`.

Outputs are **snapshots**. A pack sent to the SLT must not silently change when someone edits the model afterwards. Every output records the model version it was generated from.

## Calculations

None new. All figures come from the engine (0001) and the commercial layer (0003). Outputs render; they never calculate.

**This is a hard rule.** The moment an output computes its own number, it can disagree with the model, and the tool loses the trust it exists to create.

## Acceptance criteria

- [ ] Three views generate from a single model with no re-entry of data
- [ ] Client view provably cannot expose cost, margin, internal grades, or other scenarios — tested, not merely intended
- [ ] Client view applies the ingested brand guidelines
- [ ] SLT pack shows every scenario, including the ones not recommended
- [ ] Every figure in every output traces back to its inputs, in the app
- [ ] Outputs are snapshots with a recorded version; editing the model afterwards does not alter an issued output
- [ ] Excel export opens cleanly and reproduces the model's totals exactly
- [ ] A full engagement goes from blank model to client-ready proposal section and SLT pack **without opening Excel**
- [ ] Generating all three outputs takes under a minute

## Edge cases

- Model changed after an output was issued — show that the output is stale, do not regenerate silently
- Scenario deleted after an SLT pack referenced it — the snapshot must survive
- Assignments with no named person in the resourcing view — a gap is information, not an error
- Very long engagements (52+ weeks) — the weekly grid must remain readable in print and export
- Client view for a hybrid deal with different structures per phase

## Out of scope

- Slide/PowerPoint generation → assess after Excel and PDF land
- Editing the model from within an output
- E-signature
- Sending outputs from the app (email, portals) — export and share manually first
- Client-facing portal access

## Assumptions

`ASSUMPTION: the client receives a document, not a live link, in the first version — owner: Harry, raised: 2026-08-18`
`ASSUMPTION: brand guidelines constrain colour, type and layout sufficiently to generate on-brand output without a designer in the loop — owner: Harry, raised: 2026-08-18. To be tested against the real guidelines.`

## Open questions

- What does the resourcing team actually consume today — a system, a spreadsheet, or a conversation? Determines the export target. → REVIEW
- Does the client ever receive the working model, or only the summary? Changes how much Excel export must hide.
