import { pounds } from './money';
import type { Engagement } from './types';

/**
 * ⚠️ Real rate card, fictional engagement.
 *
 * **Real, sourced, and safe to rely on:**
 *  - the grade ladder and capability list (`context/domain-model.md` §3)
 *  - **charge and cost rates** for all eight grades, given 2026-08-19
 *  - the 23-day annual leave allowance
 *
 * **Invented — do not quote:**
 *  - Meridian Retail Group, the plan, the team, the client rate card, the contract
 *    values, and the guardrail thresholds
 *
 * The rate card is now real on both sides, so margin percentages produced by this
 * model are real *for a given plan*. The plan is not real, so the absolute figures are
 * not either.
 *
 * Shape chosen to be representative rather than convenient: three phases, five
 * workstreams, part-time and ramped people, three deliberate resourcing gaps, and a
 * public holiday in the middle of the build.
 */

/**
 * The practice's grade ladder and rate card. Both rates are real, given 2026-08-19.
 *
 * The implied gross margin is worth reading down the column, because it does not do
 * what a rate card usually does:
 *
 *   Associate           34.9%   <- the best margin on the ladder
 *   Senior Associate    31.2%
 *   Consultant          30.0%
 *   Senior Consultant   24.8%
 *   Manager             28.6%
 *   Senior Manager      33.9%
 *   Associate Director  27.0%
 *   Director            20.5%   <- the worst
 *
 * Margin falls as seniority rises, and it is not monotonic: Senior Consultant is the
 * weakest grade below Director, and Senior Manager recovers. A rich team is therefore
 * expensive in margin terms, and trading a Director down for a Senior Manager *improves*
 * margin rather than conceding it. Grade mix is a live commercial lever here, in the
 * opposite direction to the intuition a rate card alone suggests.
 */
function grade(id: string, name: string, order: number, chargeRate: number, costRate: number) {
  return { id, name, order, costRate: pounds(costRate), chargeRate: pounds(chargeRate) };
}

const GRADES = [
  grade('g-associate', 'Associate', 1, 525, 342),
  grade('g-senior-associate', 'Senior Associate', 2, 650, 447),
  grade('g-consultant', 'Consultant', 3, 800, 560),
  grade('g-senior-consultant', 'Senior Consultant', 4, 900, 677),
  grade('g-manager', 'Manager', 5, 1100, 785),
  grade('g-senior-manager', 'Senior Manager', 6, 1350, 893),
  grade('g-associate-director', 'Associate Director', 7, 2000, 1460),
  grade('g-director', 'Director', 8, 2500, 1988),
];

/** The practice's capabilities. A capability is what someone does; a grade is how senior they are. */
const ROLES = [
  { id: 'c-adi', name: 'Applied Data Intelligence' },
  { id: 'c-ai', name: 'AI (ML & Gen AI)' },
  { id: 'c-product', name: 'Data & AI Product Management' },
  { id: 'c-governance', name: 'Data & AI Governance' },
  { id: 'c-partners', name: 'AI Business Partners' },
  { id: 'c-platform', name: 'Platform Engineering' },
];

export const meridian: Engagement = {
  id: 'eng-meridian',
  name: 'Data Platform & Demand Forecasting',
  client: 'Meridian Retail Group',
  startDate: '2026-09-07',
  weeks: 14,
  sprintWeeks: 2,
  /**
   * 23 days per person-year, given 2026-08-19, pro-rated across each person's weeks
   * on the engagement.
   *
   * ASSUMPTION: annual leave is deducted from available days. The source sheet shows
   * 253 billable days (261 weekdays less 8 public holidays) alongside an estimated
   * 23 days of leave, and then carries 253 forward rather than 230 — so leave is either
   * applied somewhere downstream or is not applied at all. Deducting it is the
   * arithmetically correct treatment of capacity; set this to 0 if the 253 already
   * accounts for it. Owner: Harry. Raised: 2026-08-19. → REVIEW Q19.
   */
  annualLeaveDays: 23,
  calendar: {
    workingDaysPerWeek: 5,
    // August bank holiday equivalent in week 8, and a company day in week 13.
    publicHolidays: { 8: 1, 13: 1 },
  },
  grades: GRADES,
  roles: ROLES,
  people: [
    { id: 'p-lindqvist', name: 'M. Lindqvist', gradeId: 'g-director', roleId: 'c-partners' },
    { id: 'p-osei', name: 'T. Osei', gradeId: 'g-senior-manager', roleId: 'c-product' },
    {
      id: 'p-whitfield',
      name: 'A. Whitfield',
      gradeId: 'g-associate-director',
      roleId: 'c-platform',
      // Two weeks of leave in the middle of the build — visible in the grid.
      leave: { 9: 5, 10: 5 },
    },
    { id: 'p-moreau', name: 'J. Moreau', gradeId: 'g-senior-consultant', roleId: 'c-platform' },
    { id: 'p-bello', name: 'S. Bello', gradeId: 'g-consultant', roleId: 'c-adi' },
    { id: 'p-ferreira', name: 'D. Ferreira', gradeId: 'g-senior-consultant', roleId: 'c-ai' },
    { id: 'p-nakamura', name: 'P. Nakamura', gradeId: 'g-manager', roleId: 'c-partners' },
    { id: 'p-kaur', name: 'R. Kaur', gradeId: 'g-consultant', roleId: 'c-adi', leave: { 12: 2 } },
  ],
  phases: [
    { id: 'ph-discovery', name: 'Discovery', order: 1, startWeek: 1, endWeek: 3 },
    { id: 'ph-build', name: 'Build', order: 2, startWeek: 4, endWeek: 11 },
    { id: 'ph-deploy', name: 'Deploy & Handover', order: 3, startWeek: 12, endWeek: 14 },
  ],
  workstreams: [
    { id: 'ws-discovery', name: 'Discovery & Design', phaseId: 'ph-discovery', startWeek: 1, endWeek: 3 },
    { id: 'ws-platform', name: 'Data Platform', phaseId: 'ph-build', startWeek: 4, endWeek: 11 },
    { id: 'ws-forecast', name: 'Forecasting Models', phaseId: 'ph-build', startWeek: 5, endWeek: 11 },
    { id: 'ws-change', name: 'Change & Adoption', phaseId: 'ph-build', startWeek: 4, endWeek: 11 },
    { id: 'ws-deploy', name: 'Deploy & Handover', phaseId: 'ph-deploy', startWeek: 12, endWeek: 14 },
  ],
  milestones: [
    { id: 'm-discovery', name: 'Discovery complete', week: 3 },
    { id: 'm-platform', name: 'Platform live', week: 11 },
    { id: 'm-golive', name: 'Go-live & handover', week: 14 },
  ],
  assignments: [
    // Discovery
    { id: 'a1', workstreamId: 'ws-discovery', roleId: 'c-platform', gradeId: 'g-associate-director', personId: 'p-whitfield', startWeek: 1, endWeek: 3, allocation: 0.6 },
    { id: 'a2', workstreamId: 'ws-discovery', roleId: 'c-adi', gradeId: 'g-consultant', personId: 'p-kaur', startWeek: 1, endWeek: 3, allocation: 1 },
    { id: 'a3', workstreamId: 'ws-discovery', roleId: 'c-product', gradeId: 'g-senior-manager', personId: 'p-osei', startWeek: 1, endWeek: 3, allocation: 0.4 },
    { id: 'a4', workstreamId: 'ws-discovery', roleId: 'c-partners', gradeId: 'g-director', personId: 'p-lindqvist', startWeek: 1, endWeek: 3, allocation: 0.1 },

    // Build — Data Platform
    { id: 'a5', workstreamId: 'ws-platform', roleId: 'c-platform', gradeId: 'g-senior-consultant', personId: 'p-moreau', startWeek: 4, endWeek: 11, allocation: 1 },
    { id: 'a6', workstreamId: 'ws-platform', roleId: 'c-platform', gradeId: 'g-consultant', startWeek: 4, endWeek: 11, allocation: 1, rampWeeks: 2 },
    { id: 'a7', workstreamId: 'ws-platform', roleId: 'c-adi', gradeId: 'g-consultant', personId: 'p-bello', startWeek: 4, endWeek: 11, allocation: 0.8, rampWeeks: 2 },
    { id: 'a8', workstreamId: 'ws-platform', roleId: 'c-platform', gradeId: 'g-associate-director', personId: 'p-whitfield', startWeek: 4, endWeek: 11, allocation: 0.3 },

    // Build — Forecasting
    { id: 'a9', workstreamId: 'ws-forecast', roleId: 'c-ai', gradeId: 'g-senior-consultant', personId: 'p-ferreira', startWeek: 5, endWeek: 11, allocation: 1, rampWeeks: 2 },
    { id: 'a10', workstreamId: 'ws-forecast', roleId: 'c-ai', gradeId: 'g-consultant', startWeek: 6, endWeek: 11, allocation: 0.8 },
    { id: 'a11', workstreamId: 'ws-forecast', roleId: 'c-governance', gradeId: 'g-senior-associate', startWeek: 6, endWeek: 11, allocation: 0.5 },

    // Build — Change
    { id: 'a12', workstreamId: 'ws-change', roleId: 'c-partners', gradeId: 'g-manager', personId: 'p-nakamura', startWeek: 4, endWeek: 11, allocation: 0.5 },
    { id: 'a13', workstreamId: 'ws-change', roleId: 'c-product', gradeId: 'g-senior-manager', personId: 'p-osei', startWeek: 4, endWeek: 11, allocation: 0.5 },

    // Deploy
    { id: 'a14', workstreamId: 'ws-deploy', roleId: 'c-product', gradeId: 'g-senior-manager', personId: 'p-osei', startWeek: 12, endWeek: 14, allocation: 0.5 },
    { id: 'a15', workstreamId: 'ws-deploy', roleId: 'c-platform', gradeId: 'g-senior-consultant', personId: 'p-moreau', startWeek: 12, endWeek: 14, allocation: 0.6 },
    { id: 'a16', workstreamId: 'ws-deploy', roleId: 'c-adi', gradeId: 'g-consultant', personId: 'p-bello', startWeek: 12, endWeek: 14, allocation: 0.5 },
    { id: 'a17', workstreamId: 'ws-deploy', roleId: 'c-partners', gradeId: 'g-manager', personId: 'p-nakamura', startWeek: 12, endWeek: 14, allocation: 0.6 },
  ],
  rateCards: [
    {
      id: 'rc-meridian',
      name: 'Meridian framework rates',
      // INVENTED. A plausible negotiated discount off the real standard rates — no such
      // agreement exists. Roughly 7% at the grades a framework deal usually touches.
      rates: {
        'g-consultant': pounds(740),
        'g-senior-consultant': pounds(840),
        'g-manager': pounds(1030),
        'g-senior-manager': pounds(1260),
        'g-associate-director': pounds(1850),
      },
    },
  ],
  paymentTermsWeeks: 4,
  nonBillableCost: pounds(9800),
  expenses: { rechargeable: pounds(6400), absorbed: pounds(2200) },
  scenarios: [
    {
      id: 'sc-tm',
      name: 'T&M — framework rates',
      structure: { type: 'tm', rateCardId: 'rc-meridian' },
      notes: 'Our opening position. Client has signalled the board will resist open-ended T&M.',
    },
    {
      id: 'sc-fixed',
      name: 'Fixed price',
      structure: { type: 'fixedPrice', contractValue: pounds(247000), contingencyPct: 0.15 },
      notes: 'Single price for the agreed scope, 15% contingency held against overrun.',
    },
    {
      id: 'sc-outcome',
      name: 'Fixed + outcome share',
      structure: {
        type: 'outcomeShare',
        baseFee: pounds(200000),
        shape: 'benefitPct',
        sharePercent: 0.1,
        expectedBenefit: pounds(580000),
        cap: pounds(295000),
        contingencyPct: 0.15,
      },
      notes: 'Lower base, 10% of measured forecasting benefit in year one, capped at £295k.',
    },
    {
      id: 'sc-hybrid',
      name: 'Hybrid — fixed discovery, T&M build',
      structure: { type: 'tm', rateCardId: 'rc-meridian' },
      structureByPhase: {
        'ph-discovery': { type: 'fixedPrice', contractValue: pounds(38500), contingencyPct: 0.1 },
        'ph-deploy': { type: 'fixedPrice', contractValue: pounds(28000), contingencyPct: 0.1 },
      },
      notes: 'Fixed price either end, T&M through the build where the scope is least certain.',
    },
  ],
  /**
   * INVENTED. The real thresholds and the real approval chain are unknown (REVIEW Q5).
   *
   * These were previously set against a placeholder cost base that implied a 50%-margin
   * business. Against the real rate card the practice runs at 20–30%, so the old
   * thresholds breached on every scenario at once and told the reader nothing. They are
   * re-set here to sit inside the range the real card actually produces, which makes
   * them discriminating again — but they remain guesses, and a guardrail that is wrong
   * is worse than no guardrail, because it launders a bad deal through an approval.
   */
  guardrails: [
    {
      id: 'gr-margin',
      label: 'Gross margin',
      metric: 'grossMarginPct',
      operator: 'gte',
      threshold: 0.2,
      approver: 'Head of Consulting',
    },
    {
      id: 'gr-downside',
      label: 'Downside margin',
      metric: 'downsideMarginPct',
      operator: 'gte',
      threshold: 0.1,
      approver: 'SLT',
    },
    {
      id: 'gr-discount',
      label: 'Discount against standard rates',
      metric: 'discountPct',
      operator: 'lte',
      threshold: 0.1,
      approver: 'Head of Commercial',
    },
    {
      id: 'gr-cash',
      label: 'Maximum cash exposure',
      metric: 'maxCashExposure',
      operator: 'lte',
      threshold: pounds(75000),
      approver: 'Finance Director',
    },
  ],
};
