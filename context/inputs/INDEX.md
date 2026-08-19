# Inputs index

Every artefact in `context/inputs/` gets a row here before it is read. Registration is step 1 of `routines/model-intake.md`.

| File | What it is | Source / period | Redacted | Received | Ingested | Extracted into |
|---|---|---|---|---|---|---|
| _(verbal)_ | Grade ladder — 8 levels, Associate to Director | Given by Harry, 2026-08-19 | n/a | 2026-08-19 | Yes | `domain-model.md` §3, `seed.ts` |
| _(verbal)_ | Capability list — 6 capabilities | Given by Harry, 2026-08-19 | n/a | 2026-08-19 | Yes | `domain-model.md` §3, `seed.ts` |
| _(image)_ | Solutions standard day rate card — charge rates, 8 grades | Given by Harry, 2026-08-19 | n/a | 2026-08-19 | Yes | `domain-model.md` §3, `seed.ts`, asserted by test |
| _(image)_ | Resourcing model extract — charge **and cost** rates, billable days, annual leave | Given by Harry, 2026-08-19 | n/a | 2026-08-19 | Yes | `domain-model.md` §3, `seed.ts`, asserted by test |

## Awaited

Confirmed as available (2026-08-18) but not yet uploaded:

- [ ] Existing Excel delivery & commercial models — **highest value input in the workspace**; blocks M0 and gates M1
- [x] Role/seniority taxonomy — **received 2026-08-19**, names only
- [x] Charge rates — **received 2026-08-19**
- [x] Cost rates — **received 2026-08-19**
- [x] Annual leave allowance — **received 2026-08-19** (23 days)
- [ ] Confirmation of whether leave is deducted from billable days (REVIEW Q19) — blocks trusting any capacity figure
- [ ] Target utilisation (REVIEW Q3) — the last big unknown in the capacity model
- [ ] Whether other service lines have their own rate cards (the card supplied is headed *Solutions*)
- [ ] Whether rates, holidays and leave vary by resource location (the extract carries a location column, set to UK)
- [ ] Real guardrail thresholds and the approval chain (REVIEW Q5) — the thresholds in the app are invented
- [ ] Brand guidelines and proposal templates — constrains output design in M3

Until these land, the domain model and commercial structures in `/context` are reasoned defaults. See `REVIEW.md` §2 for the standing quality note.
