# Agentic Workflow — Parallel Implementation Guide

How to fan out the phase plans across many simultaneous Claude Code (or other agentic) sessions using `git worktree`. Maximises parallel PR throughput and keeps each agent's context focused on one bounded PR rather than a whole phase.

## TL;DR

- **Each PR runs in its own git worktree**, on its own branch, in its own agent session.
- **Wave structure is per-phase** (see each [docs/phases/](phases/) doc's "Parallel PR strategy" section). PRs in the same wave touch disjoint files and can land in any order.
- **Cross-phase parallelism**: any phase whose `Depends on` is satisfied can start now. Multiple phases run in parallel until they collide on the dependency graph.
- **No agent should touch `main` directly.** Open one PR per agent; merge on green.

## Dependency graph (what blocks what)

```text
done ──→ Phase 1, 2, 3, 4

ready to start now (in parallel):
  ├── Phase 4.1          (Meet UX polish; small items)
  ├── Phase 5            (Slides add-on)
  ├── Phase 6            (Question types foundation)
  ├── Phase 11           (Learning paths)
  ├── improvements-host-controls       (pause/skip/advance)
  ├── improvements-slide-rail-editor   (Kahoot-style editor)
  └── improvements-ai-hardening        (rate limits, redaction)

blocked, waiting on others:
  ├── Phase 7            ← Phase 6
  ├── Phase 8            ← Phase 6 + Phase 7
  ├── Phase 6.5          ← Phase 6 + Phase 7
  ├── Phase 9            ← everything functional
  └── Phase 10           ← Phase 9
```

The seven "ready now" tracks each have their own PR waves (1–8 PRs per phase). At peak, the project can sustain **15–20 concurrent agent sessions** across all tracks. Practical ceiling is reviewer bandwidth, not coordination.

## How to launch parallel work

### One-time setup

```bash
# From the main repo
cd ~/Projects/js/kahoot-clone

# Make sure main is current
git fetch origin
git checkout main
git pull --ff-only
```

### Per PR: create a worktree

Naming convention: `../kahoot-<phase>-<pr>` for the directory, `<phase>/<pr>-<short-desc>` for the branch.

```bash
# Example: Phase 5, PR-A (backend qrcode + CORS)
git worktree add -b phase-5/pr-a-backend ../kahoot-phase-5-pr-a main

# Example: Phase 6, PR-A (shared schema)
git worktree add -b phase-6/pr-a-shared ../kahoot-phase-6-pr-a main

# Example: improvements-host-controls
git worktree add -b improvements/host-controls ../kahoot-host-controls main
```

### In each worktree

```bash
cd ../kahoot-phase-5-pr-a

# Install deps if first time (pnpm uses content-addressed store, fast)
pnpm install

# Launch the agent and point it at the right plan
claude          # Claude Code
# or any other agentic CLI: cursor agent, aider, codex, cline, continue, …
```

Any agentic tool works — the plans are tool-agnostic. The agent just needs to read files, run shell commands, and either open PRs via `gh` or push a branch you turn into a PR yourself.

### Launching prompt (paste this into the agent)

Replace `<PHASE-DOC>` and `<X>` with the doc and PR you assigned this worktree. The template is deliberately strict — it keeps the agent inside one bounded PR rather than letting scope creep into a 50-commit feature branch.

```text
Read docs/AGENTIC-WORKFLOW.md and CLAUDE.md for project rules.

Then read docs/phases/<PHASE-DOC>.md. Your job is to implement ONLY
PR-<X> from that doc's "Parallel PR strategy" section. Do not touch
any file outside that PR's "Files to touch" list — if you think you
need to, stop and tell me before expanding scope.

Run the verification commands listed in that doc's Verification
section. All must pass before you open the PR.

When verification passes:
1. Append a CHANGELOG entry under [Unreleased] in the same commit as
   your last code change.
2. Push the branch.
3. Open a PR against main whose description quotes which doc + which
   PR you implemented (e.g. "Implements PR-A from
   docs/phases/05-slides.md"). Use `gh pr create` if available.

Don't push to main. Don't force-push. Don't skip the verification
gate. If a hook or test fails, fix the root cause — don't bypass.
```

For agents that don't have a built-in `gh` integration, drop step 3 and have them push the branch with `git push -u origin <branch>`; you open the PR yourself afterwards. The rest of the prompt is identical regardless of tool.

### When the PR merges

```bash
# Back in the main repo
git worktree remove ../kahoot-phase-5-pr-a
git branch -d phase-5/pr-a-backend
```

## Wave map — what to launch first

Recommended starting set (10 worktrees, all unblocked):

| Worktree dir | Branch | Plan + PR |
|---|---|---|
| `../kahoot-host-controls` | `improvements/host-controls` | [improvements-host-controls.md](phases/improvements-host-controls.md) — single PR |
| `../kahoot-slide-rail` | `improvements/slide-rail-editor` | [improvements-slide-rail-editor.md](phases/improvements-slide-rail-editor.md) — single PR |
| `../kahoot-ai-hardening` | `improvements/ai-hardening` | [improvements-ai-hardening.md](phases/improvements-ai-hardening.md) — single PR |
| `../kahoot-4.1-cleanup` | `phase-4.1/cleanup` | [04-meet-followups.md](phases/04-meet-followups.md) — pick the open items |
| `../kahoot-phase-5-pr-a` | `phase-5/pr-a-backend` | [05-slides.md](phases/05-slides.md) PR-A (backend qrcode + CORS) |
| `../kahoot-phase-5-pr-b` | `phase-5/pr-b-appsscript` | [05-slides.md](phases/05-slides.md) PR-B (Apps Script skeleton) |
| `../kahoot-phase-6-pr-a` | `phase-6/pr-a-shared` | [06-question-types-foundation.md](phases/06-question-types-foundation.md) PR-A (shared schema + seededShuffle) |
| `../kahoot-phase-6-pr-b` | `phase-6/pr-b-migration` | [06-question-types-foundation.md](phases/06-question-types-foundation.md) PR-B (DB backfill) |
| `../kahoot-phase-11-pr-a` | `phase-11/pr-a-shared` | [11-learning-paths.md](phases/11-learning-paths.md) PR-A (shared types) |
| `../kahoot-phase-11-pr-b` | `phase-11/pr-b-schema` | [11-learning-paths.md](phases/11-learning-paths.md) PR-B (DB schema + repo + seed) |

That's the full Wave 1 of every unblocked phase, in parallel.

As Wave 1 PRs merge, the Wave 2 PRs of the same phase become ready — fan those out the same way.

## Rules for agents working in parallel

These belong in any agent's launching prompt, not just in this doc:

1. **Touch only the files listed in your assigned PR's "Files to touch".** If your work needs a file outside that set, stop and raise it — don't silently expand scope.
2. **Rebase on `main` before each commit if your PR is part of a wave where multiple PRs touch the same file with section-level ownership.** Phase 7 PR-F and Phase 9 PR-B/C/D/F are the common culprits — see the per-section ownership notes in those plans.
3. **Open the PR with the plan section it implements quoted in the description** (e.g. "Implements PR-A from [docs/phases/05-slides.md](docs/phases/05-slides.md)"). Reviewers should never have to ask which doc to read.
4. **Verification gate is what the plan says, not what you feel like running.** Each plan's `Verification` section is the contract — every command listed must pass before the PR is opened.
5. **CHANGELOG entry under `[Unreleased]`** in the same commit, per the project rule. On a long-lived feature branch, accumulate on the branch.
6. **Never push to `main`. Never force-push to a shared branch.** PRs only.

## Coordination gotchas

- **`shared/src/index.ts` is high-traffic.** Phase 6 PR-A, Phase 7 PR-A, Phase 8 PR-A + PR-B, Phase 11 PR-A all touch it. If two run concurrently, the second-to-land has to rebase. Prefer to land the shared-types PR of each phase first within that phase's wave (the wave maps already put them in Wave 1 for exactly this reason).
- **`backend/src/services/game/lifecycle.ts`** is touched by improvements-host-controls, Phase 6 PR-C, Phase 7 PR-B, Phase 8 PR-C. Stagger these or expect rebases.
- **`frontend/src/lib/components/QuizEditor.svelte` vs `SlideEditor.svelte`**: most plans say "edit `QuizEditor.svelte` or `SlideEditor.svelte` if [improvements-slide-rail-editor.md](phases/improvements-slide-rail-editor.md) has shipped." If that improvement is in flight, land it first or pin everything to the old `QuizEditor.svelte` consistently — don't half-migrate.
- **Database migrations are non-reorderable.** Two PRs each adding their own migration is fine (they get distinct numbers); two PRs editing the same migration file is not. Phase 10 PR-A + Phase 11 PR-B both add migrations — they can both land, they just need distinct numbered SQL files.
- **The Phase 5 Marketplace registration and Phase 9 prod deploy are human-only.** Don't spawn an agent for those; they need credentials the agent shouldn't see.

## Per-phase PR count quick reference

| Phase / doc | PR count | Critical path |
|---|---|---|
| [04-meet-followups.md](phases/04-meet-followups.md) | ~8 small items | none — pick any |
| [05-slides.md](phases/05-slides.md) | 4 PRs + 1 human task | A → C → D |
| [06-question-types-foundation.md](phases/06-question-types-foundation.md) | 5 PRs | A → C → E |
| [06.5-rich-slides.md](phases/06.5-rich-slides.md) | 8 PRs (3 waves) | A+B → D → H |
| [07-poll-openended-wordcloud.md](phases/07-poll-openended-wordcloud.md) | 6 PRs | A+B → F |
| [08-ordering-ranking.md](phases/08-ordering-ranking.md) | 5 PRs | A → C → E |
| [09-polish-deploy.md](phases/09-polish-deploy.md) | 9 PRs (huge wave 1) | wave 1 → G+H+I |
| [10-admin-panel.md](phases/10-admin-panel.md) | 13 PRs (3 waves) | A → wave 2 → wave 3 |
| [11-learning-paths.md](phases/11-learning-paths.md) | 8 PRs | A → D → G |
| [improvements-host-controls.md](phases/improvements-host-controls.md) | 1 PR | — |
| [improvements-slide-rail-editor.md](phases/improvements-slide-rail-editor.md) | 1 PR | — |
| [improvements-ai-hardening.md](phases/improvements-ai-hardening.md) | 1 PR | — |

**Total downstream work**: ~60 PR-sized units. If wave-by-wave, with reviewer bandwidth of ~10 PRs/week, the whole roadmap lands in ~6–8 weeks of agentic implementation. If serial, multiples of that.

## Cleaning up

When a phase fully ships:

```bash
# Mark the phase doc ✅ Done (see how Phase 4 was done after PR #6 merged)
# Move [Unreleased] CHANGELOG entries under a dated release header
# Remove worktrees for that phase
git worktree list
git worktree remove ../kahoot-phase-X-pr-Y
git branch -d phase-X/pr-Y-description
```

## See also

- [CLAUDE.md](../CLAUDE.md) — project rules every agent must follow
- [phases/](phases/) — every phase doc
- `git worktree --help` — the underlying primitive
