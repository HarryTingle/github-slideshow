# Scope

A delivery planner and commercial modelling tool for consulting practices.

Build the delivery plan, resource it across a team with mixed skills, seniorities and
availabilities, then flex the commercials on top — T&M, fixed price, outcome share —
and compare them side by side without touching the plan.

**This repository is both the workspace and the application.** Start with
[`CLAUDE.md`](CLAUDE.md) for how the work is organised, and [`ROADMAP.md`](ROADMAP.md)
for where it is going.

## Getting started

```bash
npm install
npm test          # engine unit tests
npm run dev       # app on http://localhost:3000
```

### A single-file build

`apps/web/standalone/` bundles the same pages and the same engine into one
self-contained HTML file — useful for sharing a working copy with someone who is not
going to run a dev server.

```bash
npm run standalone      # writes apps/web/standalone/scope-sandbox.html
```

## Layout

| Path | What |
|---|---|
| `packages/engine` | Pure TypeScript calculation engine. Zero runtime dependencies. Owns every number. |
| `apps/web` | Next.js app. Presentation only — it never does arithmetic the engine could do. |
| `context/`, `specs/`, `customers/`, `demos/`, `routines/` | The workspace. See `CLAUDE.md`. |

## A note on the data

The engagement loaded by default — *Meridian Retail Group* — is **fictional**, as is the
rate card behind it. It exists so the app can be seen working before real models are
ingested. Every figure it produces is arithmetically correct and commercially meaningless.
See `context/inputs/INDEX.md`.
