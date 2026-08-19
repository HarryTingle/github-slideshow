import { pounds } from './money';
import type { Engagement } from './types';

/**
 * ⚠️ FICTIONAL DATA.
 *
 * Meridian Retail Group does not exist, and neither does the rate card below. This
 * engagement exists so the app can be seen working before real models are ingested
 * (M0 in ROADMAP.md). Every figure it produces is arithmetically correct and
 * commercially meaningless — do not quote any of it.
 *
 * Shape chosen to be representative rather than convenient: three phases, five
 * workstreams, six grades, part-time and ramped people, two deliberate resourcing
 * gaps, and a public holiday in the middle of the build.
 */

const GRADES = [
  { id: 'g-analyst', name: 'Analyst', order: 1, costRate: pounds(215), chargeRate: pounds(540) },
  { id: 'g-consultant', name: 'Consultant', order: 2, costRate: pounds(310), chargeRate: pounds(760) },
  { id: 'g-senior', name: 'Senior Consultant', order: 3, costRate: pounds(450), chargeRate: pounds(950) },
  { id: 'g-managing', name: 'Managing Consultant', order: 4, costRate: pounds(580), chargeRate: pounds(1180) },
  { id: 'g-principal', name: 'Principal', order: 5, costRate: pounds(720), chargeRate: pounds(1450) },
  { id: 'g-partner', name: 'Partner', order: 6, costRate: pounds(980), chargeRate: pounds(1950) },
];

const ROLES = [
  { id: 'r-partner', name: 'Engagement Partner' },
  { id: 'r-lead', name: 'Delivery Lead' },
  { id: 'r-architect', name: 'Solution Architect' },
  { id: 'r-de', name: 'Data Engineer' },
  { id: 'r-ml', name: 'ML Engineer' },
  { id: 'r-ae', name: 'Analytics Engineer' },
  { id: 'r-ba', name: 'Business Analyst' },
  { id: 'r-change', name: 'Change Lead' },
];

export const meridian: Engagement = {
  id: 'eng-meridian',
  name: 'Data Platform & Demand Forecasting',
  client: 'Meridian Retail Group',
  startDate: '2026-09-07',
  weeks: 14,
  calendar: {
    workingDaysPerWeek: 5,
    // August bank holiday equivalent in week 8, and a company day in week 13.
    publicHolidays: { 8: 1, 13: 1 },
  },
  grades: GRADES,
  roles: ROLES,
  people: [
    { id: 'p-lindqvist', name: 'M. Lindqvist', gradeId: 'g-partner', roleId: 'r-partner' },
    { id: 'p-osei', name: 'T. Osei', gradeId: 'g-managing', roleId: 'r-lead' },
    {
      id: 'p-whitfield',
      name: 'A. Whitfield',
      gradeId: 'g-principal',
      roleId: 'r-architect',
      // Two weeks of leave in the middle of the build — visible in the grid.
      leave: { 9: 5, 10: 5 },
    },
    { id: 'p-moreau', name: 'J. Moreau', gradeId: 'g-senior', roleId: 'r-de', costRate: pounds(470) },
    { id: 'p-bello', name: 'S. Bello', gradeId: 'g-consultant', roleId: 'r-ae' },
    { id: 'p-ferreira', name: 'D. Ferreira', gradeId: 'g-senior', roleId: 'r-ml' },
    { id: 'p-nakamura', name: 'P. Nakamura', gradeId: 'g-senior', roleId: 'r-change' },
    { id: 'p-kaur', name: 'R. Kaur', gradeId: 'g-consultant', roleId: 'r-ba', leave: { 12: 2 } },
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
    { id: 'a1', workstreamId: 'ws-discovery', roleId: 'r-architect', gradeId: 'g-principal', personId: 'p-whitfield', startWeek: 1, endWeek: 3, allocation: 0.6 },
    { id: 'a2', workstreamId: 'ws-discovery', roleId: 'r-ba', gradeId: 'g-consultant', personId: 'p-kaur', startWeek: 1, endWeek: 3, allocation: 1 },
    { id: 'a3', workstreamId: 'ws-discovery', roleId: 'r-lead', gradeId: 'g-managing', personId: 'p-osei', startWeek: 1, endWeek: 3, allocation: 0.4 },
    { id: 'a4', workstreamId: 'ws-discovery', roleId: 'r-partner', gradeId: 'g-partner', personId: 'p-lindqvist', startWeek: 1, endWeek: 3, allocation: 0.1 },

    // Build — Data Platform
    { id: 'a5', workstreamId: 'ws-platform', roleId: 'r-de', gradeId: 'g-senior', personId: 'p-moreau', startWeek: 4, endWeek: 11, allocation: 1 },
    { id: 'a6', workstreamId: 'ws-platform', roleId: 'r-de', gradeId: 'g-consultant', startWeek: 4, endWeek: 11, allocation: 1, rampWeeks: 2 },
    { id: 'a7', workstreamId: 'ws-platform', roleId: 'r-ae', gradeId: 'g-consultant', personId: 'p-bello', startWeek: 4, endWeek: 11, allocation: 0.8, rampWeeks: 2 },
    { id: 'a8', workstreamId: 'ws-platform', roleId: 'r-architect', gradeId: 'g-principal', personId: 'p-whitfield', startWeek: 4, endWeek: 11, allocation: 0.3 },

    // Build — Forecasting
    { id: 'a9', workstreamId: 'ws-forecast', roleId: 'r-ml', gradeId: 'g-senior', personId: 'p-ferreira', startWeek: 5, endWeek: 11, allocation: 1, rampWeeks: 2 },
    { id: 'a10', workstreamId: 'ws-forecast', roleId: 'r-ml', gradeId: 'g-consultant', startWeek: 6, endWeek: 11, allocation: 0.8 },
    { id: 'a11', workstreamId: 'ws-forecast', roleId: 'r-ba', gradeId: 'g-analyst', startWeek: 6, endWeek: 11, allocation: 0.5 },

    // Build — Change
    { id: 'a12', workstreamId: 'ws-change', roleId: 'r-change', gradeId: 'g-senior', personId: 'p-nakamura', startWeek: 4, endWeek: 11, allocation: 0.5 },
    { id: 'a13', workstreamId: 'ws-change', roleId: 'r-lead', gradeId: 'g-managing', personId: 'p-osei', startWeek: 4, endWeek: 11, allocation: 0.5 },

    // Deploy
    { id: 'a14', workstreamId: 'ws-deploy', roleId: 'r-lead', gradeId: 'g-managing', personId: 'p-osei', startWeek: 12, endWeek: 14, allocation: 0.5 },
    { id: 'a15', workstreamId: 'ws-deploy', roleId: 'r-de', gradeId: 'g-senior', personId: 'p-moreau', startWeek: 12, endWeek: 14, allocation: 0.6 },
    { id: 'a16', workstreamId: 'ws-deploy', roleId: 'r-ae', gradeId: 'g-consultant', personId: 'p-bello', startWeek: 12, endWeek: 14, allocation: 0.5 },
    { id: 'a17', workstreamId: 'ws-deploy', roleId: 'r-change', gradeId: 'g-senior', personId: 'p-nakamura', startWeek: 12, endWeek: 14, allocation: 0.6 },
  ],
  rateCards: [
    {
      id: 'rc-meridian',
      name: 'Meridian framework rates',
      // Negotiated framework rates — roughly 6% off standard at the senior end.
      rates: {
        'g-consultant': pounds(720),
        'g-senior': pounds(890),
        'g-managing': pounds(1110),
        'g-principal': pounds(1360),
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
      structure: { type: 'fixedPrice', contractValue: pounds(232000), contingencyPct: 0.15 },
      notes: 'Single price for the agreed scope, 15% contingency held against overrun.',
    },
    {
      id: 'sc-outcome',
      name: 'Fixed + outcome share',
      structure: {
        type: 'outcomeShare',
        baseFee: pounds(185000),
        shape: 'benefitPct',
        sharePercent: 0.1,
        expectedBenefit: pounds(620000),
        cap: pounds(280000),
        contingencyPct: 0.15,
      },
      notes: 'Lower base, 10% of measured forecasting benefit in year one, capped at £280k.',
    },
    {
      id: 'sc-hybrid',
      name: 'Hybrid — fixed discovery, T&M build',
      structure: { type: 'tm', rateCardId: 'rc-meridian' },
      structureByPhase: {
        'ph-discovery': { type: 'fixedPrice', contractValue: pounds(34000), contingencyPct: 0.1 },
        'ph-deploy': { type: 'fixedPrice', contractValue: pounds(29000), contingencyPct: 0.1 },
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
