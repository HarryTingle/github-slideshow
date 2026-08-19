import { describe, expect, it } from 'vitest';
import { computePlan } from './compute';
import { practiceReference, meridian } from './seed';
import { reconcileReferences } from './reference';
import type { Engagement } from './types';

/**
 * A document saved before the current rate card existed — the exact shape a browser was
 * still holding after the grade ladder and rate card landed.
 */
function savedOnAnOldLadder(): Engagement {
  return {
    ...meridian,
    annualLeaveDays: undefined,
    grades: [
      { id: 'g-analyst', name: 'Analyst', order: 1, costRate: 21500, chargeRate: 54000 },
      { id: 'g-consultant', name: 'Consultant', order: 2, costRate: 31000, chargeRate: 76000 },
      { id: 'g-senior', name: 'Senior Consultant', order: 3, costRate: 45000, chargeRate: 95000 },
      { id: 'g-managing', name: 'Managing Consultant', order: 4, costRate: 58000, chargeRate: 118000 },
      { id: 'g-principal', name: 'Principal', order: 5, costRate: 72000, chargeRate: 145000 },
      { id: 'g-partner', name: 'Partner', order: 6, costRate: 98000, chargeRate: 195000 },
    ],
    roles: [
      { id: 'r-de', name: 'Data Engineer' },
      { id: 'r-ml', name: 'ML Engineer' },
    ],
    people: [{ id: 'p1', name: 'J. Moreau', gradeId: 'g-senior', roleId: 'r-de' }],
    assignments: [
      { id: 'a1', workstreamId: 'ws-platform', roleId: 'r-de', gradeId: 'g-senior', personId: 'p1', startWeek: 4, endWeek: 11, allocation: 1 },
      { id: 'a2', workstreamId: 'ws-platform', roleId: 'r-ml', gradeId: 'g-principal', startWeek: 4, endWeek: 11, allocation: 1 },
    ],
    rateCards: [{ id: 'rc', name: 'Client', rates: { 'g-senior': 89000 } }],
  };
}

describe('reconciling a saved engagement against the practice', () => {
  it('replaces the ladder and the capabilities with the current ones', () => {
    const { engagement } = reconcileReferences(savedOnAnOldLadder(), practiceReference);
    expect(engagement.grades.map((grade) => grade.name)).toEqual(
      practiceReference.grades.map((grade) => grade.name),
    );
    expect(engagement.roles.map((role) => role.name)).toEqual(
      practiceReference.roles.map((role) => role.name),
    );
  });

  it('keeps a grade whose name still exists', () => {
    const { engagement } = reconcileReferences(savedOnAnOldLadder(), practiceReference);
    const moved = engagement.assignments.find((a) => a.id === 'a1')!;
    const grade = engagement.grades.find((g) => g.id === moved.gradeId)!;
    expect(grade.name).toBe('Senior Consultant');
  });

  it('keeps relative seniority when a grade has been cut from the ladder', () => {
    // Principal sat 5th of 6. The new ladder has 8 grades, so it lands 7th — Associate
    // Director — rather than being dumped at the bottom or silently kept as a dead id.
    const { engagement } = reconcileReferences(savedOnAnOldLadder(), practiceReference);
    const moved = engagement.assignments.find((a) => a.id === 'a2')!;
    const grade = engagement.grades.find((g) => g.id === moved.gradeId)!;
    expect(grade.name).toBe('Associate Director');
  });

  it('says out loud what it moved', () => {
    const { notes, changed } = reconcileReferences(savedOnAnOldLadder(), practiceReference);
    expect(changed).toBe(true);
    expect(notes.some((note) => note.includes('Principal') && note.includes('Associate Director'))).toBe(true);
    expect(notes.some((note) => note.includes('Data Engineer'))).toBe(true);
  });

  it('leaves no assignment pointing at a grade or capability that does not exist', () => {
    const { engagement } = reconcileReferences(savedOnAnOldLadder(), practiceReference);
    const gradeIds = new Set(engagement.grades.map((g) => g.id));
    const roleIds = new Set(engagement.roles.map((r) => r.id));
    for (const assignment of engagement.assignments) {
      expect(gradeIds.has(assignment.gradeId)).toBe(true);
      expect(roleIds.has(assignment.roleId)).toBe(true);
    }
    for (const person of engagement.people) {
      expect(gradeIds.has(person.gradeId)).toBe(true);
      expect(roleIds.has(person.roleId)).toBe(true);
    }
    // And it costs, rather than silently pricing dead references at zero.
    expect(computePlan(engagement).directCost).toBeGreaterThan(0);
  });

  it('moves a client rate card onto the new ladder', () => {
    const { engagement } = reconcileReferences(savedOnAnOldLadder(), practiceReference);
    const card = engagement.rateCards[0]!;
    const gradeIds = new Set(engagement.grades.map((g) => g.id));
    for (const gradeId of Object.keys(card.rates)) expect(gradeIds.has(gradeId)).toBe(true);
  });

  it('gives a document that predates annual leave the practice allowance', () => {
    const { engagement } = reconcileReferences(savedOnAnOldLadder(), practiceReference);
    expect(engagement.annualLeaveDays).toBe(23);
  });

  it('respects an allowance the user set deliberately, including zero', () => {
    const stored = { ...savedOnAnOldLadder(), annualLeaveDays: 0 };
    expect(reconcileReferences(stored, practiceReference).engagement.annualLeaveDays).toBe(0);
  });

  it('is quiet and idempotent for a document already on the current reference data', () => {
    const first = reconcileReferences(meridian, practiceReference);
    expect(first.changed).toBe(false);
    expect(first.notes).toEqual([]);
    const second = reconcileReferences(first.engagement, practiceReference);
    expect(JSON.stringify(second.engagement)).toBe(JSON.stringify(first.engagement));
  });
});
