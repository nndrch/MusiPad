# CLAUDE.md — working instructions for MusiPad

Operating rules for any agent working in this repo. These complement — they don't replace — the **Core Invariants** and build order in `[CONTRIBUTING.md](./CONTRIBUTING.md)` and the full scope in `[docs/musicxml-editor-prd.md](./docs/musicxml-editor-prd.md)`.

## Orientation (read first)

- **Scope, milestones, acceptance criteria:** `[docs/musicxml-editor-prd.md](./docs/musicxml-editor-prd.md)` (§9 = build order).
- **Live status / what's shipped:** `[docs/roadmap.md](./docs/roadmap.md)` — start here to catch up.
- **MusicXML read/edit cheat-sheet:** `[docs/musicxml-guidelines.md](./docs/musicxml-guidelines.md)` — consult before touching the DOM.
- **Deferred work:** `[docs/post-mvp-improvements.md](./docs/post-mvp-improvements.md)`.
- **Invariants + one-PR-per-milestone:** `[CONTRIBUTING.md](./CONTRIBUTING.md)`.

## Working rules

1. **Keep the README current with the latest release.** Whenever a milestone ships (merges to `main`), update `[README.md](./README.md)` — especially the **Status** section — so it always names the latest shipped milestone/feature.
2. **Run the local dev environment before starting a coding task.** Start `npm run dev` before implementing, and verify changes live in the running app as you go (not just via build/tests). Confirm the app boots clean before declaring work done.
3. **Stay within one milestone.** Work only the current milestone's scope (PRD §9, tracked in `[docs/roadmap.md](./docs/roadmap.md)`). When a request reaches beyond it, **don't silently absorb the extra scope** — suggest postponing it, record it in `[docs/post-mvp-improvements.md](./docs/post-mvp-improvements.md)` (or the right future milestone), and proceed only with the in-scope part. Do not start the next milestone until the current one's acceptance criteria pass and the human gives the go-ahead.
4. **After finishing a milestone, review and update all docs.** Once a milestone's acceptance criteria pass, sweep the documentation and fix/append anything the work changed or revealed: `[README.md](./README.md)`, `[docs/roadmap.md](./docs/roadmap.md)`, `[docs/musicxml-guidelines.md](./docs/musicxml-guidelines.md)`, `[docs/post-mvp-improvements.md](./docs/post-mvp-improvements.md)`, `[CONTRIBUTING.md](./CONTRIBUTING.md)`, and the PRD.
5. **Before committing, hand the human a QA test plan.** Generate a manual test checklist for the human to run in the live app before the commit — think like a QA engineer, not just the author. Bias toward **user experience and feature behavior** over code. For each step give: what to do, the **expected result**, and (where relevant) the why. Cover the happy path, realistic edge cases, error/empty states, and quick regression checks of nearby features the change could affect. Use the project's sample files (`public/samples/`). Keep it concrete and ordered (numbered, checkbox-style); flag anything the automated checks can't catch (audio, timing, visual/layout, interaction feel). Wait for the human's go-ahead before committing.

## Verify before done

`npm run lint` · `npm run build` (typecheck + build) · run the app (rule 2). Keep `docs/roadmap.md` accurate in that PR.
