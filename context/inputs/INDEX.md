# Inputs index

Every artefact in `context/inputs/` gets a row here before it is read. Registration is step 1 of `routines/model-intake.md`.

| File | What it is | Source / period | Redacted | Received | Ingested | Extracted into |
|---|---|---|---|---|---|---|
| _(verbal)_ | Grade ladder — 8 levels, Associate to Director | Given by Harry, 2026-08-19 | n/a | 2026-08-19 | Yes | `domain-model.md` §3, `seed.ts` |
| _(verbal)_ | Capability list — 6 capabilities | Given by Harry, 2026-08-19 | n/a | 2026-08-19 | Yes | `domain-model.md` §3, `seed.ts` |
| _(image)_ | Solutions standard day rate card — charge rates, 8 grades | Given by Harry, 2026-08-19 | n/a | 2026-08-19 | Yes | `domain-model.md` §3, `seed.ts`, asserted by test |

## Awaited

Confirmed as available (2026-08-18) but not yet uploaded:

- [ ] Existing Excel delivery & commercial models — **highest value input in the workspace**; blocks M0 and gates M1
- [x] Role/seniority taxonomy — **received 2026-08-19**, names only
- [x] Charge rates — **received 2026-08-19** (Solutions standard day rates)
- [ ] **Cost rates** — nothing supplied. Every margin the app shows is provisional until these arrive. Highest-value outstanding input.
- [ ] Whether other service lines have their own rate cards (the card supplied is headed *Solutions*)
- [ ] Brand guidelines and proposal templates — constrains output design in M3

Until these land, the domain model and commercial structures in `/context` are reasoned defaults. See `REVIEW.md` §2 for the standing quality note.
