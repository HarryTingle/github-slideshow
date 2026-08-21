import type { Assignment, Engagement, WeekIndex } from './types';

/**
 * Structural edits to an engagement.
 *
 * These live in the engine rather than in the UI because they enforce an invariant the
 * whole model depends on, and an invariant is exactly the kind of thing that should be
 * provable by test rather than by clicking:
 *
 *   **a phase contains its workstreams, and a workstream contains its assignments.**
 *
 * Every editor below returns a new engagement and finishes by re-establishing that
 * containment, so the timeline and the allocation grid can never disagree about when a
 * piece of work happens. Nothing here mutates its input.
 */

function clampWeek(week: number, max = 520): WeekIndex {
  if (!Number.isFinite(week)) return 1;
  return Math.min(max, Math.max(1, Math.round(week)));
}

/**
 * Re-establish containment after any edit: workstreams grow to hold their assignments,
 * phases grow to hold their workstreams, and the engagement grows to hold its phases
 * and milestones.
 *
 * Growth only. Shrinking is always an explicit act by the user, because silently
 * dropping weeks would silently drop effort.
 */
export function normalise(engagement: Engagement): Engagement {
  const assignments = engagement.assignments.map((assignment) => {
    const startWeek = clampWeek(assignment.startWeek);
    const endWeek = Math.max(startWeek, clampWeek(assignment.endWeek));
    return { ...assignment, startWeek, endWeek };
  });

  const workstreams = engagement.workstreams.map((workstream) => {
    const mine = assignments.filter((assignment) => assignment.workstreamId === workstream.id);
    let startWeek = clampWeek(workstream.startWeek);
    let endWeek = Math.max(startWeek, clampWeek(workstream.endWeek));
    for (const assignment of mine) {
      startWeek = Math.min(startWeek, assignment.startWeek);
      endWeek = Math.max(endWeek, assignment.endWeek);
    }
    return { ...workstream, startWeek, endWeek };
  });

  const phases = engagement.phases.map((phase) => {
    const mine = workstreams.filter((workstream) => workstream.phaseId === phase.id);
    let startWeek = clampWeek(phase.startWeek);
    let endWeek = Math.max(startWeek, clampWeek(phase.endWeek));
    for (const workstream of mine) {
      startWeek = Math.min(startWeek, workstream.startWeek);
      endWeek = Math.max(endWeek, workstream.endWeek);
    }
    return { ...phase, startWeek, endWeek };
  });

  const weeks = Math.max(
    1,
    engagement.weeks,
    ...phases.map((phase) => phase.endWeek),
    ...engagement.milestones.map((milestone) => milestone.week),
  );

  return { ...engagement, assignments, workstreams, phases, weeks };
}

function mapAssignment(
  engagement: Engagement,
  assignmentId: string,
  change: (assignment: Assignment) => Assignment,
): Engagement {
  return normalise({
    ...engagement,
    assignments: engagement.assignments.map((assignment) =>
      assignment.id === assignmentId ? change(assignment) : assignment,
    ),
  });
}

/** Forget any per-week overrides that now sit outside the assignment's range. */
function pruneOverrides(
  overrides: Record<number, number>,
  startWeek: WeekIndex,
  endWeek: WeekIndex,
): Record<number, number> {
  const kept: Record<number, number> = {};
  for (const [week, value] of Object.entries(overrides)) {
    const w = Number(week);
    if (w >= startWeek && w <= endWeek) kept[w] = value;
  }
  return kept;
}

/**
 * Set one cell of the allocation grid.
 *
 * The cells are the only control over when a role starts and stops, so they have to
 * work in both directions:
 *
 * - Typing into a cell **outside** the range extends the range to reach it, and every
 *   week the extension passes over is explicitly set to zero. Growing the range alone
 *   would apply the default allocation to those weeks and quietly add effort nobody
 *   asked for.
 * - Clearing a cell at the **start or end** of the range shortens the row by that week,
 *   which is what blanking the last cell means to anyone who has used a spreadsheet. It
 *   also collapses past any explicit zeros left at that end — a zero week is not a
 *   booking, it is scaffolding from an earlier extension, and it should not hold the
 *   row open once the week beyond it is cleared.
 * - Clearing a cell **inside** the range returns that week to the assignment's default,
 *   because a week in the middle of a booking is still booked.
 *
 * A row never shrinks below a single week — removing it entirely is a separate act.
 */
export function setAllocation(
  engagement: Engagement,
  assignmentId: string,
  week: WeekIndex,
  value: number | null,
): Engagement {
  const target = clampWeek(week);
  return mapAssignment(engagement, assignmentId, (assignment) => {
    const overrides: Record<number, number> = { ...(assignment.allocationByWeek ?? {}) };

    if (value == null) {
      delete overrides[target];
      const single = assignment.startWeek === assignment.endWeek;
      const atStart = target === assignment.startWeek;
      const atEnd = target === assignment.endWeek;

      if (!single && (atStart || atEnd)) {
        let startWeek = atStart ? assignment.startWeek + 1 : assignment.startWeek;
        let endWeek = atEnd ? assignment.endWeek - 1 : assignment.endWeek;
        if (atStart) while (startWeek < endWeek && overrides[startWeek] === 0) startWeek += 1;
        if (atEnd) while (endWeek > startWeek && overrides[endWeek] === 0) endWeek -= 1;
        return {
          ...assignment,
          startWeek,
          endWeek,
          allocationByWeek: pruneOverrides(overrides, startWeek, endWeek),
        };
      }
      return { ...assignment, allocationByWeek: overrides };
    }

    const allocation = Math.max(0, Math.min(2, value));
    for (let w = target + 1; w < assignment.startWeek; w++) overrides[w] ??= 0;
    for (let w = assignment.endWeek + 1; w < target; w++) overrides[w] ??= 0;
    overrides[target] = allocation;

    return {
      ...assignment,
      allocationByWeek: overrides,
      startWeek: Math.min(assignment.startWeek, target),
      endWeek: Math.max(assignment.endWeek, target),
    };
  });
}

/** Move an assignment's whole range. Newly covered weeks take the default allocation. */
export function setAssignmentRange(
  engagement: Engagement,
  assignmentId: string,
  startWeek: number,
  endWeek: number,
): Engagement {
  return mapAssignment(engagement, assignmentId, (assignment) => ({
    ...assignment,
    startWeek: clampWeek(startWeek),
    endWeek: Math.max(clampWeek(startWeek), clampWeek(endWeek)),
  }));
}

export function setAssignmentGrade(
  engagement: Engagement,
  assignmentId: string,
  gradeId: string,
): Engagement {
  return mapAssignment(engagement, assignmentId, (assignment) => ({ ...assignment, gradeId }));
}

export function setAssignmentRole(
  engagement: Engagement,
  assignmentId: string,
  roleId: string,
): Engagement {
  return mapAssignment(engagement, assignmentId, (assignment) => ({ ...assignment, roleId }));
}

/**
 * Name the person on a row.
 *
 * Naming an unstaffed row staffs it — the resourcing gap closes as a side effect of
 * typing a name, which is how it happens in life. Clearing the name reopens the gap.
 * Renaming someone already on the engagement renames them everywhere, because it is
 * the same person.
 *
 * The name is stored exactly as typed. Trimming it here would defeat the caret: the
 * field is controlled, so the space between a first name and a surname would be
 * stripped the instant it was pressed and could never be typed. Emptiness is judged on
 * the trimmed value; the stored value is the raw one, tidied on blur by the caller.
 */
export function setPersonName(
  engagement: Engagement,
  assignmentId: string,
  name: string,
): Engagement {
  const assignment = engagement.assignments.find((candidate) => candidate.id === assignmentId);
  if (!assignment) return engagement;
  const trimmed = name.trim();

  if (assignment.personId) {
    if (trimmed === '') {
      return mapAssignment(engagement, assignmentId, ({ personId, ...rest }) => rest);
    }
    return normalise({
      ...engagement,
      people: engagement.people.map((person) =>
        person.id === assignment.personId ? { ...person, name } : person,
      ),
    });
  }

  if (trimmed === '') return engagement;
  const id = `p-${Math.random().toString(36).slice(2, 9)}`;
  return normalise({
    ...engagement,
    people: [
      ...engagement.people,
      { id, name, gradeId: assignment.gradeId, roleId: assignment.roleId },
    ],
    assignments: engagement.assignments.map((candidate) =>
      candidate.id === assignmentId ? { ...candidate, personId: id } : candidate,
    ),
  });
}

export function setPhase(
  engagement: Engagement,
  phaseId: string,
  change: { name?: string; startWeek?: number; endWeek?: number },
): Engagement {
  return normalise({
    ...engagement,
    phases: engagement.phases.map((phase) =>
      phase.id === phaseId
        ? {
            ...phase,
            name: change.name ?? phase.name,
            startWeek: change.startWeek == null ? phase.startWeek : clampWeek(change.startWeek),
            endWeek: change.endWeek == null ? phase.endWeek : clampWeek(change.endWeek),
          }
        : phase,
    ),
  });
}

/**
 * Edit a workstream. Moving one moves everything staffed on it — the assignments keep
 * their offset from the start of the workstream, because a workstream that slips takes
 * its team with it.
 */
export function setWorkstream(
  engagement: Engagement,
  workstreamId: string,
  change: { name?: string; startWeek?: number; endWeek?: number },
): Engagement {
  const workstream = engagement.workstreams.find((candidate) => candidate.id === workstreamId);
  if (!workstream) return engagement;

  const startWeek = change.startWeek == null ? workstream.startWeek : clampWeek(change.startWeek);
  const endWeek = Math.max(
    startWeek,
    change.endWeek == null ? workstream.endWeek : clampWeek(change.endWeek),
  );
  const shift = startWeek - workstream.startWeek;

  return normalise({
    ...engagement,
    workstreams: engagement.workstreams.map((candidate) =>
      candidate.id === workstreamId
        ? { ...candidate, name: change.name ?? candidate.name, startWeek, endWeek }
        : candidate,
    ),
    assignments:
      shift === 0
        ? engagement.assignments
        : engagement.assignments.map((assignment) =>
            assignment.workstreamId === workstreamId
              ? {
                  ...assignment,
                  startWeek: clampWeek(assignment.startWeek + shift),
                  endWeek: clampWeek(assignment.endWeek + shift),
                  allocationByWeek: shiftOverrides(assignment.allocationByWeek, shift),
                }
              : assignment,
          ),
  });
}

function shiftOverrides(
  overrides: Record<number, number> | undefined,
  shift: number,
): Record<number, number> | undefined {
  if (!overrides) return undefined;
  const moved: Record<number, number> = {};
  for (const [week, value] of Object.entries(overrides)) {
    moved[clampWeek(Number(week) + shift)] = value;
  }
  return moved;
}

export function addAssignment(engagement: Engagement, workstreamId: string): Engagement {
  const workstream = engagement.workstreams.find((candidate) => candidate.id === workstreamId);
  if (!workstream) return engagement;
  const grade = [...engagement.grades].sort((a, b) => a.order - b.order)[1] ?? engagement.grades[0];
  if (!grade || !engagement.roles[0]) return engagement;

  return normalise({
    ...engagement,
    assignments: [
      ...engagement.assignments,
      {
        id: `a-${Math.random().toString(36).slice(2, 9)}`,
        workstreamId,
        roleId: engagement.roles[0].id,
        gradeId: grade.id,
        startWeek: workstream.startWeek,
        endWeek: workstream.endWeek,
        allocation: 1,
      },
    ],
  });
}

export function removeAssignment(engagement: Engagement, assignmentId: string): Engagement {
  return normalise({
    ...engagement,
    assignments: engagement.assignments.filter((assignment) => assignment.id !== assignmentId),
  });
}

/**
 * Move the whole engagement in time.
 *
 * Week indices are the model's base unit, so the plan does not move — only what the
 * weeks are called. Every allocation, milestone and phase boundary follows the new
 * start date automatically.
 */
export function setStartDate(engagement: Engagement, startDate: string): Engagement {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return engagement;
  return { ...engagement, startDate };
}

/** Shrink or grow the engagement. Shrinking is refused below the work already planned. */
export function setWeeks(engagement: Engagement, weeks: number): Engagement {
  return normalise({ ...engagement, weeks: clampWeek(weeks) });
}

export function setSprintWeeks(engagement: Engagement, sprintWeeks: number): Engagement {
  return { ...engagement, sprintWeeks: Math.max(1, Math.min(12, Math.round(sprintWeeks) || 1)) };
}

/**
 * Cells are expressed in **days per week**, not fractional FTE.
 *
 * "Four days a week" is how resourcing conversations actually happen; 0.8 is a
 * translation people have to do in their heads, and get wrong. The engine keeps
 * allocation as a fraction because that is what composes correctly with a week that
 * has a bank holiday in it — so the conversion lives here, tested, rather than being
 * done twice in the UI.
 */
export function daysToAllocation(days: number, workingDaysPerWeek: number): number {
  if (!workingDaysPerWeek || workingDaysPerWeek <= 0) return 0;
  return days / workingDaysPerWeek;
}

export function allocationToDays(allocation: number, workingDaysPerWeek: number): number {
  return allocation * workingDaysPerWeek;
}

/**
 * Set a cell from a number of days a week.
 *
 * Note this books *time*, and time booked is not time delivered: a full five days in a
 * week carrying a bank holiday still delivers four. The grid shows what was booked, the
 * engine computes what lands, and the trace panel shows the step between them.
 */
export function setAllocationDays(
  engagement: Engagement,
  assignmentId: string,
  week: WeekIndex,
  days: number | null,
): Engagement {
  if (days == null) return setAllocation(engagement, assignmentId, week, null);
  return setAllocation(
    engagement,
    assignmentId,
    week,
    daysToAllocation(days, engagement.calendar.workingDaysPerWeek),
  );
}

/** A phase, with one workstream in it so roles can be added straight away. */
export function addPhase(engagement: Engagement, name = 'New phase'): Engagement {
  const lastEnd = engagement.phases.reduce((end, phase) => Math.max(end, phase.endWeek), 0);
  const order = engagement.phases.reduce((max, phase) => Math.max(max, phase.order), 0) + 1;
  const startWeek = clampWeek(lastEnd + 1);
  const endWeek = clampWeek(startWeek + 3);
  const id = `ph-${Math.random().toString(36).slice(2, 9)}`;

  return normalise({
    ...engagement,
    phases: [...engagement.phases, { id, name, order, startWeek, endWeek }],
    workstreams: [
      ...engagement.workstreams,
      { id: `ws-${Math.random().toString(36).slice(2, 9)}`, name: 'New workstream', phaseId: id, startWeek, endWeek },
    ],
  });
}

/**
 * Remove a phase, and with it every workstream and every role staffed on it.
 *
 * Cascading is the only honest option — an orphaned workstream would keep costing money
 * from a phase that no longer exists. The UI asks first, because there is no undo.
 */
export function removePhase(engagement: Engagement, phaseId: string): Engagement {
  const workstreamIds = new Set(
    engagement.workstreams.filter((ws) => ws.phaseId === phaseId).map((ws) => ws.id),
  );
  return normalise({
    ...engagement,
    phases: engagement.phases.filter((phase) => phase.id !== phaseId),
    workstreams: engagement.workstreams.filter((ws) => ws.phaseId !== phaseId),
    assignments: engagement.assignments.filter((a) => !workstreamIds.has(a.workstreamId)),
  });
}

export function addWorkstream(engagement: Engagement, phaseId: string, name = 'New workstream'): Engagement {
  const phase = engagement.phases.find((candidate) => candidate.id === phaseId);
  if (!phase) return engagement;
  return normalise({
    ...engagement,
    workstreams: [
      ...engagement.workstreams,
      {
        id: `ws-${Math.random().toString(36).slice(2, 9)}`,
        name,
        phaseId,
        startWeek: phase.startWeek,
        endWeek: phase.endWeek,
      },
    ],
  });
}

/** Remove a workstream and everything staffed on it. */
export function removeWorkstream(engagement: Engagement, workstreamId: string): Engagement {
  return normalise({
    ...engagement,
    workstreams: engagement.workstreams.filter((ws) => ws.id !== workstreamId),
    assignments: engagement.assignments.filter((a) => a.workstreamId !== workstreamId),
  });
}

/** How much work a phase or workstream is carrying — for a delete confirmation. */
export function contentsOf(engagement: Engagement, phaseId: string): { workstreams: number; roles: number } {
  const workstreams = engagement.workstreams.filter((ws) => ws.phaseId === phaseId);
  const ids = new Set(workstreams.map((ws) => ws.id));
  return {
    workstreams: workstreams.length,
    roles: engagement.assignments.filter((a) => ids.has(a.workstreamId)).length,
  };
}

/** Set the rate this deal bills for a grade. The practice standard is left alone. */
export function setScenarioRate(
  engagement: Engagement,
  scenarioId: string,
  gradeId: string,
  rate: number | null,
): Engagement {
  return {
    ...engagement,
    scenarios: engagement.scenarios.map((scenario) => {
      if (scenario.id !== scenarioId) return scenario;
      const overrides = { ...(scenario.rateOverrides ?? {}) };
      if (rate == null) delete overrides[gradeId];
      else overrides[gradeId] = Math.max(0, Math.round(rate));
      return { ...scenario, rateOverrides: overrides };
    }),
  };
}

/**
 * Move every billed rate by the same factor.
 *
 * The blunt instrument, and the one a target-margin solve produces: it holds the shape
 * of the deal and moves only its price, so the team you promised is the team you priced.
 */
export function applyRateMultiplier(
  engagement: Engagement,
  scenarioId: string,
  multiplier: number,
  billedRates: Record<string, number>,
): Engagement {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return engagement;
  return {
    ...engagement,
    scenarios: engagement.scenarios.map((scenario) => {
      if (scenario.id !== scenarioId) return scenario;
      const overrides: Record<string, number> = {};
      for (const grade of engagement.grades) {
        const current = billedRates[grade.id] ?? grade.chargeRate;
        overrides[grade.id] = Math.max(0, Math.round(current * multiplier));
      }
      return { ...scenario, rateOverrides: overrides };
    }),
  };
}

/** Drop every rate override, returning the deal to the card it inherits. */
export function clearScenarioRates(engagement: Engagement, scenarioId: string): Engagement {
  return {
    ...engagement,
    scenarios: engagement.scenarios.map((scenario) =>
      scenario.id === scenarioId ? { ...scenario, rateOverrides: undefined } : scenario,
    ),
  };
}

/** Set the headline value of whatever fixed-price structure a scenario carries. */
export function setContractValue(
  engagement: Engagement,
  scenarioId: string,
  value: number,
): Engagement {
  const price = Math.max(0, Math.round(value));
  const reprice = (structure: Engagement['scenarios'][number]['structure']) =>
    structure.type === 'fixedPrice' || structure.type === 'milestone'
      ? { ...structure, contractValue: price }
      : structure.type === 'cappedTm'
        ? { ...structure, cap: price }
        : structure.type === 'outcomeShare'
          ? { ...structure, baseFee: price }
          : structure;

  return {
    ...engagement,
    scenarios: engagement.scenarios.map((scenario) =>
      scenario.id === scenarioId
        ? {
            ...scenario,
            structure: reprice(scenario.structure),
            structureByPhase: scenario.structureByPhase
              ? Object.fromEntries(
                  Object.entries(scenario.structureByPhase).map(([id, s]) => [id, reprice(s)]),
                )
              : undefined,
          }
        : scenario,
    ),
  };
}

/**
 * Book leave for a person in a given week.
 *
 * Booking leave does not usually change the total effort on an engagement — it changes
 * *when* it is taken. The annual allowance is already provided for across the weeks
 * somebody works, and booked leave is set against that provision rather than added to
 * it. What moves is the shape of the plan: the week they are away loses its capacity and
 * the rest of the weeks gain a little back.
 */
export function setPersonLeave(
  engagement: Engagement,
  personId: string,
  week: WeekIndex,
  days: number | null,
): Engagement {
  const target = clampWeek(week);
  return {
    ...engagement,
    people: engagement.people.map((person) => {
      if (person.id !== personId) return person;
      const leave = { ...(person.leave ?? {}) };
      if (days == null || days <= 0) delete leave[target];
      else leave[target] = Math.min(engagement.calendar.workingDaysPerWeek, days);
      return { ...person, leave };
    }),
  };
}

/** Give one person a different annual allowance from the rest. `null` restores the default. */
export function setPersonAnnualLeave(
  engagement: Engagement,
  personId: string,
  days: number | null,
): Engagement {
  return {
    ...engagement,
    people: engagement.people.map((person) =>
      person.id === personId
        ? { ...person, annualLeaveDays: days == null ? undefined : Math.max(0, Math.min(60, days)) }
        : person,
    ),
  };
}

/**
 * Flex one person's leave for commercial purposes: days on top of, or off, what they
 * are due over their weeks here. `null` returns them to the entitlement.
 *
 * A delta rather than an absolute, deliberately. The entitlement is derived from the
 * real allowance and stays the truth; this is the assumption laid over it, and holding
 * it separately is what lets the app show both numbers side by side.
 *
 * Bounded either side so a stray keystroke cannot silently rewrite the delivery plan.
 */
export function setPersonLeaveAdjustment(
  engagement: Engagement,
  personId: string,
  days: number | null,
): Engagement {
  return {
    ...engagement,
    people: engagement.people.map((person) =>
      person.id === personId
        ? {
            ...person,
            leaveAdjustmentDays:
              days == null || days === 0 ? undefined : Math.max(-60, Math.min(60, days)),
          }
        : person,
    ),
  };
}

/** Rename the engagement. Stored raw so a space can be typed mid-name. */
export function setEngagementName(engagement: Engagement, name: string): Engagement {
  return { ...engagement, name };
}

/** Who the work is for. Stored raw for the same reason. */
export function setClient(engagement: Engagement, client: string): Engagement {
  return { ...engagement, client };
}

/** Days a week the practice works. Rarely moved, but it is an assumption, not a constant. */
export function setWorkingDaysPerWeek(engagement: Engagement, days: number): Engagement {
  return {
    ...engagement,
    calendar: { ...engagement.calendar, workingDaysPerWeek: Math.max(1, Math.min(7, days)) },
  };
}

/** Weeks between billing and cash landing. Drives the cash-exposure figure. */
export function setPaymentTerms(engagement: Engagement, weeks: number): Engagement {
  return { ...engagement, paymentTermsWeeks: Math.max(0, Math.min(52, Math.round(weeks))) };
}

/**
 * Fill a rectangle of the grid in one go.
 *
 * The unit of work in a resource plan is almost never a single week: it is "R. Kaur,
 * three days a week, weeks four to eleven". Typing that a cell at a time is eight
 * separate edits, eight undo steps, and the reason people go back to Excel.
 *
 * Folded over the same per-cell function the grid already uses, so a filled range is
 * indistinguishable from the same cells typed one by one — including the rules that make
 * typing outside a row's dates extend it, and clearing an edge cell shorten it. Doing it
 * any faster would mean a second implementation of those rules, and two implementations
 * of a containment rule is how a plan starts disagreeing with itself.
 *
 * The whole fill is a single edit, so one undo takes all of it back.
 */
export function fillAllocationDays(
  engagement: Engagement,
  assignmentIds: string[],
  fromWeek: WeekIndex,
  toWeek: WeekIndex,
  days: number | null,
): Engagement {
  const first = Math.min(clampWeek(fromWeek), clampWeek(toWeek));
  const last = Math.max(clampWeek(fromWeek), clampWeek(toWeek));
  const known = new Set(engagement.assignments.map((assignment) => assignment.id));

  let next = engagement;
  for (const assignmentId of assignmentIds) {
    if (!known.has(assignmentId)) continue;
    // Clearing runs from the outside in. Trimming an edge cell shortens the row, so
    // working left to right would move the edge out from under the cells still to be
    // cleared and leave a tail of zeros behind.
    const weeks: WeekIndex[] = [];
    for (let week = first; week <= last; week++) weeks.push(week);
    if (days == null) weeks.reverse();
    for (const week of weeks) {
      next = setAllocationDays(next, assignmentId, week, days);
    }
  }
  return next;
}
