import { pounds } from './money';
import type { Engagement } from './types';

/**
 * ⚠️ HALF REAL. Read this before quoting anything.
 *
 * **Real, and safe to rely on:**
 *  - the grade ladder and the capability list (`context/domain-model.md` §3)
 *  - the **charge rates** — the Solutions standard day rate card, given 2026-08-19
 *
 * **Invented, and not safe to rely on:**
 *  - every **cost rate**, and therefore *every margin figure the app produces*
 *  - Meridian Retail Group, the plan, the client rate card, the contract values
 *
 * This is the most dangerous state the seed has been in. Revenue is now correct for a
 * given plan, which makes the margins beside it look equally sourced. They are not.
 * Margin is revenue minus cost, and cost is a placeholder.
 *
 * ASSUMPTION: fully-loaded cost is 50% of the standard day rate from Associate to
 * Senior Manager, and 42% at Associate Director and Director, where the rate step
 * reflects scarcity and seniority premium rather than a proportional cost step.
 * Owner: Harry. Raised: 2026-08-19.
 *
 * A single stated ratio is used deliberately in place of eight individually plausible
 * numbers: it is obviously a placeholder, it is auditable in one line, and it does not
 * pretend to encode knowledge of the cost base that we do not have. The cost of that
 * choice is that grade mix barely moves margin below Associate Director — which will
 * come alive the moment real cost rates arrive, and is a reason to get them.
 *
 * Shape chosen to be representative rather than convenient: three phases, five
 * workstreams, part-time and ramped people, three deliberate resourcing gaps, and a
 * public holiday in the middle of the build.
 */

/**
 * The practice's grade ladder.
 *
 * `chargeRate` is the **real** Solutions standard day rate card.
 * `costRate` is **invented** — derived from the charge rate by the stated ratio above,
 * so that it is obviously a placeholder rather than a number anyone might mistake for
 * sourced data.
 */
const COST_RATIO_STANDARD = 0.5;
const COST_RATIO_SENIOR = 0.42;

function grade(
  id: string,
  name: string,
  order: number,
  standardDayRate: number,
  costRatio: number,
) {
  return {
    id,
    name,
    order,
    costRate: pounds(standardDayRate * costRatio),
    chargeRate: pounds(standardDayRate),
  };
}

const GRADES = [
  grade('g-associate', 'Associate', 1, 525, COST_RATIO_STANDARD),
  grade('g-senior-associate', 'Senior Associate', 2, 650, COST_RATIO_STANDARD),
  grade('g-consultant', 'Consultant', 3, 800, COST_RATIO_STANDARD),
  grade('g-senior-consultant', 'Senior Consultant', 4, 900, COST_RATIO_STANDARD),
  grade('g-manager', 'Manager', 5, 1100, COST_RATIO_STANDARD),
  grade('g-senior-manager', 'Senior Manager', 6, 1350, COST_RATIO_STANDARD),
  grade('g-associate-director', 'Associate Director', 7, 2000, COST_RATIO_SENIOR),
  grade('g-director', 'Director', 8, 2500, COST_RATIO_SENIOR),
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
    { id: 'p-moreau', name: 'J. Moreau', gradeId: 'g-senior-consultant', roleId: 'c-platform', costRate: pounds(470) },
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
      structure: { type: 'fixedPrice', contractValue: pounds(262000), contingencyPct: 0.15 },
      notes: 'Single price for the agreed scope, 15% contingency held against overrun.',
    },
    {
      id: 'sc-outcome',
      name: 'Fixed + outcome share',
      structure: {
        type: 'outcomeShare',
        baseFee: pounds(215000),
        shape: 'benefitPct',
        sharePercent: 0.1,
        expectedBenefit: pounds(580000),
        cap: pounds(305000),
        contingencyPct: 0.15,
      },
      notes: 'Lower base, 10% of measured forecasting benefit in year one, capped at £305k.',
    },
    {
      id: 'sc-hybrid',
      name: 'Hybrid — fixed discovery, T&M build',
      structure: { type: 'tm', rateCardId: 'rc-meridian' },
      structureByPhase: {
        'ph-discovery': { type: 'fixedPrice', contractValue: pounds(37000), contingencyPct: 0.1 },
        'ph-deploy': { type: 'fixedPrice', contractValue: pounds(31000), contingencyPct: 0.1 },
      },
      notes: 'Fixed price either end, T&M through the build where the scope is least certain.',
    },
  ],
  guardrails: [
    {
      id: 'gr-margin',
      label: 'Gross margin',
      metric: 'grossMarginPct',
      operator: 'gte',
      threshold: 0.4,
      approver: 'Head of Consulting',
    },
    {
      id: 'gr-downside',
      label: 'Downside margin',
      metric: 'downsideMarginPct',
      operator: 'gte',
      threshold: 0.35,
      approver: 'SLT',
    },
    {
      id: 'gr-discount',
      label: 'Discount against standard rates',
      metric: 'discountPct',
      operator: 'lte',
      threshold: 0.12,
      approver: 'Head of Commercial',
    },
    {
      id: 'gr-cash',
      label: 'Maximum cash exposure',
      metric: 'maxCashExposure',
      operator: 'lte',
      threshold: pounds(60000),
      approver: 'Finance Director',
    },
  ],
};
