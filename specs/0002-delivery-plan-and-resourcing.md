# 0002 — Delivery plan and resourcing

Milestone: M1
Status: Built
Owner: Harry
Depends on: `context/domain-model.md`, `specs/0001-modelling-engine-core.md`
Last updated: 2026-08-19 (grid editing added)

## Job to be done

A delivery lead needs to lay out how the engagement will actually run — phases, parallel workstreams, milestones — and then staff it with a team that could plausibly exist: right roles, right seniority mix, allowing for the fact that the people who might do it are already half-committed elsewhere and take holiday.

Today this is a grid in Excel that somebody built by hand and that nobody else can safely edit.

## Why now

The resource model is the input to every commercial calculation. It is also the artefact the resourcing team needs. Getting it structurally right is what makes the commercial flex in 0003 cheap.

## Behaviour

**Delivery plan**
- Define phases in sequence, each with a date range
- Define workstreams within or across phases, each with its own range
- Place milestones on the timeline; optionally flag one as payment-gating
- Express dependencies between workstreams and milestones (finish-to-start is sufficient for M1)

**Resource model**
- Add assignments: role + grade, to a workstream, over weeks, at fractional FTE
- Optionally attach a named person to an assignment
- Model real availability: holidays, leave, ramp-up, partial availability
- See the shape of the team as it is built: FTE by week, effort by grade, peak headcount
- See the gaps: assignments with no named person, and weeks where demand exceeds any plausible supply

**Views over the same model**
- Timeline (Gantt-like) — phases, workstreams, milestones
- Allocation grid — role/person down, weeks across, FTE in cells. The view that most resembles what people already use, deliberately.
- Team shape — effort distribution across grades

## Data

Introduces nothing beyond 0001's entities. Adds `Dependency { fromId, toId, type: 'finish-to-start' }`.

## Calculations

Delegated entirely to the engine (0001). This spec adds only aggregations for display:

```
fteByWeek(w)          = Σ over active assignments of allocation
fteByRoleWeek(r, w)   = Σ over active assignments with role r of allocation
unstaffedEffort       = Σ effortDays where assignment.personId is null
gapWeeks              = weeks where fteByWeek(w) > statedResourcingCapacity
```

### Worked example

Three workstreams over 12 weeks. Data Platform (W1–W8, 2 Data Engineers at 1.0, 1 Architect at 0.4), ML (W5–W12, 2 ML Engineers at 1.0), PMO (W1–W12, 1 Delivery Lead at 0.5).

```
Peak headcount = week 5–8: 2.0 + 0.4 + 2.0 + 0.5 = 4.9 FTE
Week 1–4:                  2.0 + 0.4 + 0.5       = 2.9 FTE
Week 9–12:                       2.0 + 0.5       = 2.5 FTE
```

Peak-to-average ratio flags a staffing profile the resourcing team will struggle with — a genuine finding a spreadsheet rarely surfaces.

## Acceptance criteria

- [ ] A plan can be built with phases, workstreams and milestones, and validated against `domain-model.md` §9
- [ ] Assignments can be made at role+grade level with **no named people**, and the model is fully valid and fully costed
- [ ] Named people can be attached later without rebuilding the assignment
- [ ] Holidays, leave and ramp reduce effort visibly in the allocation grid, not only in totals
- [ ] FTE by week, peak headcount, and effort by grade are shown live as the plan is edited
- [ ] Unstaffed assignments are visible as gaps, not hidden
- [ ] Changing an assignment's dates or allocation updates every downstream number immediately
- [x] The allocation grid is directly editable — this is the interaction people already know
- [x] Cells are **days a week**, not fractional FTE: five is a full week. The engine keeps allocation as a fraction because that is what composes correctly with a short week; the conversion is tested at the boundary rather than done in the UI
- [x] Phases and workstreams can be added and deleted in the grid. Deleting cascades to everything staffed beneath, and asks first, naming what would go — there is no undo
- [x] **Every** cell takes a number, including cells outside a row's current dates; typing outside the range extends it, and the weeks stepped over are set to zero so no effort appears uninvited
- [x] The cells are the *only* date control on a role row: clearing the box at either end shortens the row, collapsing past any zeros left behind by an earlier extension, so extending and undoing is an exact round trip
- [x] Clearing a box inside a row returns that week to the row's default rather than shortening it — a week in the middle of a booking is still booked
- [x] **A span is filled in one action.** The unit of work is "three days a week, weeks four to eleven", not one cell. Drag across cells, or click one and shift-click another, then type: every selected cell takes the value. Selection spans rows as well as weeks, so a whole block of the plan can be set at once
- [x] A fill is **one edit and one undo step**, labelled by how many cells it covered
- [x] A filled range is byte-identical to typing the same cells one at a time, extension and trimming rules included — asserted by test rather than by inspection, because a second implementation of the containment rules is how a plan starts disagreeing with itself
- [x] Arrow keys move between cells, shift-arrows extend the selection, Escape collapses it. Left and right only leave the cell once the caret has run out of value, so a decimal can still be edited a character at a time
- [x] Phase and workstream names and dates are editable in the grid, and the timeline is a view of the same fields rather than a second copy
- [x] A phase contains its workstreams and a workstream contains its assignments, enforced in the engine after every edit, so the two views can never disagree
- [x] Moving a workstream moves the team staffed on it, per-week overrides included
- [x] A consultant's name, level and capability are editable on their row; naming an unstaffed row staffs it and closes the gap
- [x] The engagement's start date, duration and sprint length are editable; changing the start date re-labels every week without moving the plan
- [x] Sprint and calendar-quarter rulers sit above the week numbers
- [ ] A plan can be duplicated as the starting point for a new engagement

## Edge cases

- Workstream extending beyond its phase
- Milestone outside the plan's date range
- Assignment on a workstream that is later shortened — flagged, not silently truncated
- A person double-booked across workstreams within the engagement
- Plan shortened after assignments exist — must warn before discarding effort
- A phase with no workstreams, or a workstream with no assignments — valid while drafting, flagged before sign-off

## Out of scope

- Task-level planning. We stop above tasks; this is not a PM tool.
- Complex dependency types (start-to-start, lags) — finish-to-start only in M1
- Skills matching and automated resource suggestions
- Cross-engagement capacity across the portfolio → M4
- Critical path calculation

## Assumptions

`ASSUMPTION: bid-stage plans are built role-first, with people attached later or never — owner: Harry, raised: 2026-08-18` → REVIEW Q6
`ASSUMPTION: finish-to-start dependencies are sufficient at bid-stage granularity — owner: Harry, raised: 2026-08-18`
