# /context/inputs

Raw source material. **Read-only.** Never edit a file here — extract findings into `/context` and cite the source filename.

## What belongs here

| Type | Why it matters | Extract into |
|---|---|---|
| Existing Excel delivery & commercial models | The real logic, the real edge cases, the real errors. The single most valuable input in the workspace. | `domain-model.md`, `commercial-models.md`, golden tests |
| Rate cards | Grade structure, cost vs charge rates, client-specific cards | `domain-model.md` §3 |
| Role / seniority taxonomy | The canonical ladder | `domain-model.md` §3, `glossary.md` |
| Brand guidelines | Constrains output design in M3 | `specs/0004-shareable-outputs.md` |
| Proposal templates & past proposals | The shape of the client-facing output we must produce | `specs/0004-shareable-outputs.md` |
| SLT sign-off packs / deal approval templates | Guardrails, thresholds, approval chain | `commercial-models.md` §9 |
| Signed contracts (redacted) | How commercial structures are actually worded and measured | `commercial-models.md` §6 |

## Handling

- **Redact before committing.** Client names, individual salaries and named personal cost rates should be removed or pseudonymised. Structure matters; identity does not.
- **Keep the original filename** and add a short note in `INDEX.md` saying what it is and which engagement or year it relates to.
- **Do not delete superseded versions** — a rate card from two years ago is evidence of how the model evolved.

## Intake

Run `routines/model-intake.md` on each new artefact. It produces a structured extraction rather than a vague read-through, and it is what turns a spreadsheet into domain knowledge.

## Index

The running register of source material lives in `INDEX.md`. Every artefact gets a row before it is read.
