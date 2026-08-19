import type { Days, Engagement, Grade, Guardrail, RateCard, Role } from './types';

/**
 * Practice reference data, and reconciling a saved engagement against it.
 *
 * A grade ladder, a capability list, a rate card and a set of commercial guardrails
 * belong to the **practice**, not to any one engagement. Storing them inside a saved
 * document pins whoever opens it to whatever the card looked like the day they first
 * touched it — so a bid saved last year keeps pricing at last year's rates, silently and
 * forever. That is the failure mode this module exists to prevent.
 *
 * On load, reference data is taken from the practice and the document's own references
 * are remapped onto it. Where a remap is not exact it is reported rather than guessed at
 * quietly, because a grade that silently became a different grade changes the price.
 */
export interface ReferenceData {
  grades: Grade[];
  roles: Role[];
  guardrails: Guardrail[];
  annualLeaveDays?: Days;
}

export interface Reconciliation {
  engagement: Engagement;
  /** Plain-English account of anything that moved. Empty when nothing did. */
  notes: string[];
  changed: boolean;
}

/**
 * Map an id from a stored ladder onto the current one.
 *
 * Exact name first — "Senior Consultant" is "Senior Consultant" whatever its id. Failing
 * that, position in the ladder: a grade that sat 5th of 6 maps to the grade 5/6 of the
 * way up the new ladder, which keeps relative seniority when a ladder is re-cut.
 */
function mapGrade(oldGrade: Grade | undefined, oldLadder: Grade[], newLadder: Grade[]): Grade | undefined {
  if (!newLadder.length) return undefined;
  if (!oldGrade) return undefined;

  const byName = newLadder.find((candidate) => candidate.name === oldGrade.name);
  if (byName) return byName;

  const sortedOld = [...oldLadder].sort((a, b) => a.order - b.order);
  const sortedNew = [...newLadder].sort((a, b) => a.order - b.order);
  const position = sortedOld.findIndex((candidate) => candidate.id === oldGrade.id);
  if (position < 0) return sortedNew[sortedNew.length - 1];

  const fraction = (position + 1) / sortedOld.length;
  const index = Math.min(sortedNew.length - 1, Math.max(0, Math.round(fraction * sortedNew.length) - 1));
  return sortedNew[index];
}

function mapRole(oldRole: Role | undefined, newRoles: Role[]): Role | undefined {
  if (!newRoles.length || !oldRole) return undefined;
  return newRoles.find((candidate) => candidate.name === oldRole.name) ?? newRoles[0];
}

export function reconcileReferences(stored: Engagement, reference: ReferenceData): Reconciliation {
  const notes: string[] = [];

  const oldGrades = stored.grades ?? [];
  const oldRoles = stored.roles ?? [];
  const newGrades = reference.grades;
  const newRoles = reference.roles;

  const gradeIds = new Set(newGrades.map((grade) => grade.id));
  const roleIds = new Set(newRoles.map((role) => role.id));

  // Work out the remapping once, so the same old grade always lands in the same place.
  const gradeMap = new Map<string, string>();
  const roleMap = new Map<string, string>();
  for (const grade of oldGrades) {
    if (gradeIds.has(grade.id)) continue;
    const replacement = mapGrade(grade, oldGrades, newGrades);
    if (replacement) {
      gradeMap.set(grade.id, replacement.id);
      notes.push(
        replacement.name === grade.name
          ? `${grade.name} matched the current ladder.`
          : `${grade.name} is no longer a grade — moved to ${replacement.name}.`,
      );
    }
  }
  for (const role of oldRoles) {
    if (roleIds.has(role.id)) continue;
    const replacement = mapRole(role, newRoles);
    if (replacement) {
      roleMap.set(role.id, replacement.id);
      notes.push(
        replacement.name === role.name
          ? `${role.name} matched the current capabilities.`
          : `${role.name} is no longer a capability — moved to ${replacement.name}.`,
      );
    }
  }

  const remapGrade = (id: string) => (gradeIds.has(id) ? id : (gradeMap.get(id) ?? newGrades[0]?.id ?? id));
  const remapRole = (id: string) => (roleIds.has(id) ? id : (roleMap.get(id) ?? newRoles[0]?.id ?? id));

  const ratesChanged = oldGrades.some((grade) => {
    const current = newGrades.find((candidate) => candidate.id === grade.id);
    return current && (current.chargeRate !== grade.chargeRate || current.costRate !== grade.costRate);
  });
  if (ratesChanged) notes.push('Rates have been refreshed from the current rate card.');

  const engagement: Engagement = {
    ...stored,
    grades: newGrades,
    roles: newRoles,
    guardrails: reference.guardrails,
    // An explicit choice by the user is respected; only a document that predates the
    // field takes the practice default.
    annualLeaveDays: stored.annualLeaveDays ?? reference.annualLeaveDays,
    assignments: stored.assignments.map((assignment) => ({
      ...assignment,
      gradeId: remapGrade(assignment.gradeId),
      roleId: remapRole(assignment.roleId),
    })),
    people: stored.people.map((person) => ({
      ...person,
      gradeId: remapGrade(person.gradeId),
      roleId: remapRole(person.roleId),
    })),
    // Client rate cards are keyed by grade, so they move with the ladder.
    rateCards: stored.rateCards.map((card: RateCard) => ({
      ...card,
      rates: Object.fromEntries(
        Object.entries(card.rates).map(([gradeId, rate]) => [remapGrade(gradeId), rate]),
      ),
    })),
  };

  if (stored.annualLeaveDays == null && reference.annualLeaveDays) {
    notes.push(`Annual leave set to the practice allowance of ${reference.annualLeaveDays} days.`);
  }

  return { engagement, notes, changed: notes.length > 0 };
}
