# /context

Durable knowledge about the business, the domain and the decisions we have made. Slow-changing by design. Specs cite these files; they do not restate them.

| File | Contents |
|---|---|
| `business-context.md` | Product, buyer, pain, promise, market. The canonical statement. |
| `domain-model.md` | The entities and maths of delivery planning and resourcing. |
| `commercial-models.md` | Every commercial structure we must be able to model, with formulas. |
| `glossary.md` | Shared vocabulary. Consulting terms are used inconsistently across firms; this pins ours down. |
| `decisions/` | Numbered, append-only decision records. |
| `inputs/` | Raw source material. Read-only drop zone. |

## Rules

- **Evidence over assertion.** If a statement came from a real artefact or a real person, say which one.
- **Tag every assumption.** Format: `ASSUMPTION: <statement> — owner: <name>, raised: <date>`. Unowned assumptions rot.
- **Supersede, do not overwrite.** When something changes materially, note what it replaced and why.
- **`inputs/` is never edited.** Extract findings into the files above and cite the source file.
