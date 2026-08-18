# 0002 — Delivery plan and resourcing

Milestone: M1
Status: Draft
Owner: Harry
Depends on: `context/domain-model.md`, `specs/0001-modelling-engine-core.md`
Last updated: 2026-08-18

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
- [ ] The allocation grid is directly editable — this is the interaction people already know
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
