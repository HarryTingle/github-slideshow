# CLAUDE.md — Operating Manual

This repository is an **AI employee workspace** for building **Scope** (working name): a delivery planning and commercial modelling tool for consulting practices.

It is both the *brain* (context, customer evidence, specs, roadmap) and the *hands* (application source code). Read this file before doing anything else in this repo.

---

## 1. The business in one page

| | |
|---|---|
| **Product** | A delivery planner and commercial modelling tool. Users build a resource plan for a data & AI consulting engagement — across a large team with mixed skills, seniorities and availabilities — and then model the commercials on top of it. |
| **Primary user** | Heads of Consulting / Heads of Commercial and the delivery leads and bid teams who work alongside them. |
| **Buyer** | Heads of Consulting practice at top-tier firms and at SME/specialist data & AI consultancies. |
| **Pain** | Every engagement is modelled in a bespoke Excel file. No shared best practice, no brand consistency, mathematically fragile, and nothing repeatable: resourcing teams, clients and the SLT sign-off chain each need a different view and none of them exists as an output. The sharpest pain is commercial — once the delivery plan and resource model are built, flexing the commercial structure (T&M rates, fixed price, ROI/risk share) is slow and error-prone, and that flexing is exactly what wins bids. |
| **Promise** | One place where consulting and commercial teams work *together* to build the full picture of an engagement — delivery plan, resource model and commercials — and produce outputs that are immediately shareable internally, with the SLT, and with the client. |
| **Current goal** | Build the app. Milestone one is a correct, tested modelling engine. See `ROADMAP.md`. |

### Positioning decisions already made

- **Internal first, then productise.** V1 is built to win our own bids. We are customer zero. Every feature must survive contact with a real engagement before it is considered done. Externalisation is a deliberate later milestone, not an accident.
- Because of that: build for *one* practice's workflow, but never hard-code *our* rate card, brand or grade names into the engine. Configuration, not assumption.

---

## 2. How to work here

### The loop
1. **Read context.** `/context` is the source of truth for the domain. If something contradicts it, the context file wins or the context file gets updated — not silently ignored.
2. **Write a spec.** No non-trivial feature gets built without a spec in `/specs`. Specs are short, testable and reference the context they depend on.
3. **Build against the spec.** Engine logic first, UI second.
4. **Prove it.** Every calculation has unit tests. Every user-facing flow gets a demo entry in `/demos`.
5. **Review.** Log the outcome in `REVIEW.md`. Update `ROADMAP.md` if the plan moved.

### Non-negotiables

- **Never invent a number and present it as fact.** Rates, utilisation targets, grade structures and margins come from `/context/inputs` or from an explicitly labelled assumption. Every assumption carries an `ASSUMPTION:` tag and a named owner to confirm it.
- **The maths must be testable in isolation.** All modelling logic lives in a pure, dependency-free engine layer with unit tests. If a number can only be produced by clicking through the UI, it is not finished.
- **No silent rounding, no floating-point money.** Money is handled in integer minor units. Rounding happens once per line, half-up, and totals are the sum of rounded lines — so a total always equals the detail behind it. Specified in `packages/engine/src/money.ts`.
- **Every output must be traceable.** Any figure shown to a client or the SLT must be explainable back to its inputs. "Where did this number come from?" is a question the app answers, not the user.
- **Excel is the incumbent, not the enemy.** Users will want to export, and some will want to import. Interop is a feature, not a fallback.
- **Client-facing tone.** Anything that could reach a client or an SLT sign-off pack is written in plain, confident, commercially literate English. No filler, no hedging, no jargon that a CFO would not use.

### When you are unsure

Ask, but do not block. Do everything that does not depend on the answer, record the open question in `REVIEW.md` under *Open questions*, and state the assumption you proceeded under.

---

## 3. Repository map

| Path | What lives here | Rule |
|---|---|---|
| `CLAUDE.md` | This operating manual. | Update when the way we work changes. |
| `ROADMAP.md` | Milestones, sequencing, what is in and out of scope now. | Reviewed weekly. |
| `REVIEW.md` | Standing quality bar, review log, open questions, decisions pending. | Appended to, not rewritten. |
| `/context` | Durable knowledge: business context, domain model, commercial structures, glossary, decision records. | Slow-changing. Cited by specs. |
| `/context/inputs` | Raw source material — Excel models, rate cards, brand guidelines. | Drop zone. Never edited in place; findings are extracted into `/context`. |
| `/context/decisions` | Numbered decision records (ADR-style) covering product, commercial and technical calls. | Append-only. Supersede, never delete. |
| `/customers` | Who we sell to and what they told us. ICP, accounts, interview notes. | Evidence, not opinion. Quote people. |
| `/specs` | One file per feature or capability. What it does, the maths, the acceptance criteria. | Nothing gets built without one. |
| `/demos` | Scripted walkthroughs used to show the product and to prove a milestone is real. | Each demo names the specs it exercises. |
| `/routines` | Repeatable operating procedures — the things an AI employee runs on a cadence or on a trigger. | If it has been done twice, it belongs here. |

Each directory has a `README.md` explaining its conventions and a `_template-*.md` where a template applies. Use the templates.

---

## 4. Technical conventions

> **Status: built.** See `context/decisions/0002-stack-and-architecture.md`.

- **Engine** — `packages/engine`: pure TypeScript, zero runtime dependencies, exhaustively unit tested. Owns every calculation: allocation, cost, revenue, margin, rate derivation, scenario comparison.
- **App** — `apps/web`: Next.js (App Router) + TypeScript + React. Presentation and interaction only. The app never does arithmetic the engine could do.
- **Persistence** — start with local, file-backed project documents (JSON) so early work has no infrastructure. Move to Postgres when multi-user editing lands (M4).
- **Testing** — Vitest. Engine coverage is a gate, not an aspiration. Golden-file tests reproduce real engagement models from `/context/inputs` end to end.
- **Money & time** — integer minor units for money; days as the base unit of effort; ISO weeks as the base unit of the calendar.

### Seeded data — real taxonomy, invented numbers
The **grade ladder and capability list are the practice's real ones** (`context/domain-model.md` §3). Everything else in the seeded engagement is invented: *Meridian Retail Group* does not exist, and **not one rate in it came from a real rate card**.

That split matters. The shape of the model is now right, which makes the numbers more convincing and therefore more dangerous. Nothing in the seed may be quoted, and the rate card must be replaced wholesale when the real one arrives — never adjusted towards it.

---

## 5. Git and delivery

- Work on the designated feature branch; never push to `main` without being asked.
- Commit messages: imperative mood, one line of what and one of why when the why is not obvious.
- Pull requests only when explicitly requested.
- Anything worth keeping is committed and pushed — this workspace runs in ephemeral containers.

---

## 6. Definition of done

A piece of work is done when all of the following are true:

- [ ] It satisfies the acceptance criteria of its spec in `/specs`.
- [ ] Its calculations are unit tested, including boundaries and at least one real-world case.
- [ ] Every assumption it relies on is either sourced from `/context` or tagged `ASSUMPTION:` with an owner.
- [ ] Outputs it produces are traceable back to inputs.
- [ ] `REVIEW.md` records the review, and `ROADMAP.md` reflects reality.
