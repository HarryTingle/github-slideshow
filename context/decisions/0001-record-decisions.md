# 0001 — Record decisions

Status: Accepted
Date: 2026-08-18
Deciders: Harry

## Context

This workspace is worked on by both people and an AI employee, across sessions that do not share memory. Decisions made in conversation evaporate. Without a record, the same questions — per-grade or per-person costing, fixed price contingency approach, whether to build for external buyers yet — get reopened repeatedly, and each reopening risks a different answer landing in a different part of the codebase.

## Decision

Material decisions are recorded as numbered, append-only records in `context/decisions/`. A decision is material if reversing it would require rework, or if someone joining the work would be surprised by it.

## Consequences

- Any session can recover the reasoning behind the current state without archaeology.
- Small overhead per decision; large saving on relitigation.
- Superseded records stay visible, which shows how thinking evolved.

## Alternatives considered

- **Comments in code** — invisible to commercial decisions, and lost on refactor.
- **A single decisions log file** — merges badly and gets rewritten rather than appended.
