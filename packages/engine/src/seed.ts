import { pounds } from './money';
import type { Engagement } from './types';

/**
 * ⚠️ MIXED: real taxonomy, invented numbers.
 *
 * The **grade ladder and the capability list are the practice's real ones** — they were
 * given to us and are the structure the product must fit.
 *
 * **Every rate below is invented**, as is Meridian Retail Group and everything about
 * this engagement. No cost rate, charge rate or contract value here came from a real
 * rate card, and none of them may be quoted. They exist so the app can be seen working
 * before real material is ingested (M0 in ROADMAP.md).
 *
 * Getting the taxonomy right and the rates wrong is the safer half to have: the shape
 * of the model is now correct, and the numbers are visibly placeholder.
 *
 * ASSUMPTION: rates rise monotonically with grade and the spread between cost and
 * charge widens with seniority — owner: Harry, raised: 2026-08-19. Replace wholesale
 * with the real rate card; do not adjust these towards it.
 *
 * Shape chosen to be representative rather than convenient: three phases, five
 * workstreams, part-time and ramped people, three deliberate resourcing gaps, and a
 * public holiday in the middle of the build.
 */

/** The practice's grade ladder. Names are real; every rate is a placeholder. */
const GRADES = [
  { id: 'g-associate', name: 'Associate', order: 1, costRate: pounds(195), chargeRate: pounds(495) },
  { id: 'g-senior-associate', name: 'Senior Associate', order: 2, costRate: pounds(260), chargeRate: pounds(620) },
  { id: 'g-consultant', name: 'Consultant', order: 3, costRate: pounds(330), chargeRate: pounds(780) },
  { id: 'g-senior-consultant', name: 'Senior Consultant', order: 4, costRate: pounds(430), chargeRate: pounds(950) },
  { id: 'g-manager', name: 'Manager', order: 5, costRate: pounds(530), chargeRate: pounds(1120) },
  { id: 'g-senior-manager', name: 'Senior Manager', order: 6, costRate: pounds(640), chargeRate: pounds(1330) },
  { id: 'g-associate-director', name: 'Associate Director', order: 7, costRate: pounds(780), chargeRate: pounds(1560) },
  { id: 'g-director', name: 'Director', order: 8, costRate: pounds(950), chargeRate: pounds(1900) },
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
      // Negotiated framework rates — roughly 6% off standard at the senior end.
      rates: {
        'g-consultant': pounds(740),
        'g-senior-consultant': pounds(890),
        'g-manager': pounds(1050),
        'g-senior-manager': pounds(1250),
        'g-associate-director': pounds(1465),
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
      structure: { type: 'fixedPrice', contractValue: pounds(252000), contingencyPct: 0.15 },
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
        cap: pounds(290000),
        contingencyPct: 0.15,
      },
      notes: 'Lower base, 10% of measured forecasting benefit in year one, capped at £290k.',
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
