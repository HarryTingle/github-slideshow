/**
 * Domain types for the Scope modelling engine.
 *
 * Implements `specs/0001-modelling-engine-core.md` and `context/domain-model.md`.
 *
 * Two conventions matter throughout and are enforced by the type names:
 *
 *  - `Money` is an **integer** number of minor units (pence). Never a float pound value.
 *  - `Days` is effort in days, held at full precision internally.
 *
 * Calendar resolution is the week. Weeks are 1-based indices from the engagement's
 * start; `startDate` exists only so a week index can be labelled ("2026-W34") for
 * display. The engine itself never touches dates — that keeps it pure and testable.
 */

/** Integer minor units (pence). */
export type Money = number;

/** Effort in days. */
export type Days = number;

/** 1-based week index from the start of the engagement. */
export type WeekIndex = number;

export interface Grade {
  id: string;
  name: string;
  /** Seniority order, ascending. Used for display and for grade-mix reporting. */
  order: number;
  /** What a delivery day of this grade costs us. */
  costRate: Money;
  /** What we bill the client per day at standard rates. */
  chargeRate: Money;
}

export interface Role {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  gradeId: string;
  roleId: string;
  /** Overrides the grade cost rate when present. Cost only — never charge. */
  costRate?: Money;
  /** Specific, booked leave, by week index. Counts against the annual allowance. */
  leave?: Record<WeekIndex, Days>;
  /** Overrides the engagement's annual leave allowance for this person. */
  annualLeaveDays?: Days;
}

export interface Calendar {
  workingDaysPerWeek: number;
  /** Public holiday days, by week index. Applies to everyone. */
  publicHolidays?: Record<WeekIndex, Days>;
}

export interface Phase {
  id: string;
  name: string;
  order: number;
  startWeek: WeekIndex;
  endWeek: WeekIndex;
}

export interface Workstream {
  id: string;
  name: string;
  phaseId: string;
  startWeek: WeekIndex;
  endWeek: WeekIndex;
}

export interface Milestone {
  id: string;
  name: string;
  week: WeekIndex;
  /** Present when this milestone gates a payment. */
  paymentValue?: Money;
}

export interface Assignment {
  id: string;
  workstreamId: string;
  roleId: string;
  gradeId: string;
  /** Absent at bid stage. A model with no named people is fully valid and fully costed. */
  personId?: string;
  startWeek: WeekIndex;
  endWeek: WeekIndex;
  /** Fractional FTE, e.g. 0.6. The default for every week of the assignment. */
  allocation: number;
  /**
   * Per-week overrides, by week index. This is how people actually work — they change
   * one cell in the grid because someone is half on another engagement that fortnight.
   * Absent weeks fall back to `allocation`.
   */
  allocationByWeek?: Record<WeekIndex, number>;
  /** Weeks to reach full productivity. Linear ramp. */
  rampWeeks?: number;
}

/** A set of charge rates. Standard (ours) or client-specific (negotiated). */
export interface RateCard {
  id: string;
  name: string;
  /** Charge rate overrides by grade id. Missing grades fall back to the grade's standard rate. */
  rates: Record<string, Money>;
}

export type CommercialStructure =
  | { type: 'tm'; rateCardId?: string }
  | { type: 'cappedTm'; rateCardId?: string; cap: Money }
  | { type: 'fixedPrice'; contractValue: Money; contingencyPct: number }
  | { type: 'milestone'; contractValue: Money; payments: MilestonePayment[]; contingencyPct: number }
  | { type: 'retainer'; monthlyValue: Money; months: number }
  | {
      type: 'outcomeShare';
      baseFee: Money;
      shape: 'benefitPct' | 'gainShare' | 'bonus';
      sharePercent: number;
      /** Expected client benefit, or expected outcome under gain-share. */
      expectedBenefit: Money;
      /** Agreed baseline. Gain-share only. */
      baseline?: Money;
      /** Maximum total fee. Absent means uncapped — the upside is unbounded, not a number. */
      cap?: Money;
      contingencyPct: number;
    };

export interface MilestonePayment {
  milestoneId: string;
  value: Money;
}

export interface Scenario {
  id: string;
  name: string;
  /** Default structure for the engagement. */
  structure: CommercialStructure;
  /**
   * Per-phase overrides. Real deals are hybrids — fixed-price discovery, T&M build,
   * retained hypercare — so this is a first-class feature, not an edge case.
   */
  structureByPhase?: Record<string, CommercialStructure>;
  notes?: string;
}

export interface Guardrail {
  id: string;
  label: string;
  metric: 'grossMarginPct' | 'downsideMarginPct' | 'discountPct' | 'maxCashExposure';
  operator: 'gte' | 'lte';
  threshold: number;
  /** Who must approve when this is breached. */
  approver: string;
}

export interface Engagement {
  id: string;
  name: string;
  client: string;
  /** ISO date of the Monday of week 1. Display only. */
  startDate: string;
  weeks: number;
  /** Weeks per sprint, for the sprint ruler above the allocation grid. */
  sprintWeeks?: number;
  /**
   * Annual leave allowance in days per person-year. Pro-rated across each person's
   * weeks on the engagement and deducted from availability. Booked leave counts
   * against it rather than adding to it. Set to 0 to switch the deduction off.
   */
  annualLeaveDays?: Days;
  calendar: Calendar;
  grades: Grade[];
  roles: Role[];
  people: Person[];
  phases: Phase[];
  workstreams: Workstream[];
  milestones: Milestone[];
  assignments: Assignment[];
  rateCards: RateCard[];
  /**
   * Weeks between billing and cash landing. Drives cash exposure — without it,
   * every structure appears to be cash-neutral, which is never true.
   */
  paymentTermsWeeks?: number;
  /** Effort that is real but not charged: PMO overhead, assurance, account management. */
  nonBillableCost?: Money;
  expenses?: { rechargeable: Money; absorbed: Money };
  scenarios: Scenario[];
  guardrails: Guardrail[];
}
