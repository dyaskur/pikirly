# Follow-ups — Meet Add-on UX Polish

**Status**: 🚧 In progress
**Depends on**: Phase 4 (Meet add-on shipped on `main` in PR #6 — see [04-meet.md](04-meet.md))
**Relationship to Phase 5**: Phase 5 (Slides) can begin in parallel, but the Meet flow should not be promoted publicly until the **side-panel-during-game** and **host-in-game-controls** items below are done — otherwise dogfooders still hit the awkward states described in this doc.
**Goal**: Close the UX gaps observed while dogfooding the Meet add-on. Phase 4 shipped functional; this doc tracks the polish needed before we'd recommend the Meet flow to anyone outside the team.

## Why this phase

Phase 4's acceptance criteria were about *function* (host can launch, players auto-join, full game playable in Meet). Dogfooding revealed the in-Meet flow is awkward in ways the acceptance criteria didn't catch: double headings in the narrow side panel, dead-weight participant view during gameplay, host losing all controls mid-game, etc. Bundling these into Phase 9 made that phase too broad — pulling them out into a focused follow-up keeps Phase 9 about deploy/CI/global UX, and lets this work happen in parallel with or before Phase 5.

## Out of scope (intentional)

- Anything that requires new backend endpoints (would extend Phase 4 properly)
- Mobile-app-style native gestures (the side panel is a normal iframe)
- Theming / brand redesign across the whole app — only Meet-specific surfaces
- Internationalization
- Accessibility audit beyond what the rest of the app gets

## Deliverables

### 1. Side panel ([frontend/src/lib/components/MeetBootstrap.svelte](../../frontend/src/lib/components/MeetBootstrap.svelte))

- [x] Remove double heading stutter — "Host Controls" + "Signed in as" both dropped (`b123ce9`)
- [ ] Make the participant side panel useful during gameplay — render the answer pad, current score, and rank instead of the static "Look at the main stage" text. *(Partial: role-surface separation landed in `fba1d19` / `9abd219`, but the participant pad still needs the in-game answer UI.)*
- [ ] Hide the "Are you the host?" sign-in CTA when a game is already active
- [ ] Replace bare spinner with a skeleton of the about-to-render content (quiz picker shell for host, "waiting for host" card for participant)
- [ ] Replace placeholder 🎮 emoji with proper Pikirly mark *(still present in [MeetBootstrap.svelte](../../frontend/src/lib/components/MeetBootstrap.svelte) on `main`)*

### 2. Main stage / quiz picker ([frontend/src/lib/components/MeetStage.svelte](../../frontend/src/lib/components/MeetStage.svelte))

- [x] **Inline quiz creation modal** — hosts can create a new quiz without leaving Meet (replaces the prior open-in-new-tab link). Shipped in commit `13475a1`. Later replaced with a centred popup window in `9f96e7f`; popup auto-closes and refreshes list (`edcc3c5`).
- [x] Sort controls — sort dropdown + manual refresh button (`6d3d561`); default order "Newest first" (`366fdc8`). *(Last-played date and "recently used" still pending.)*
- [ ] Quiz list metadata: show last-played date, surface "recently used" at top
- [ ] Rename "Host in Meeting" button to "Start" (host is already in the meeting)
- [ ] Add a "Ready to start?" confirmation before promoting the activity to the main stage (currently silent — surprises the room). *(Note: `aaa6a2c` already ends prior activity before starting a new one, which addresses the side-effect; the user-facing confirmation is still missing.)*
- [ ] Host side panel during gameplay: show live participant count, current question, advance/skip/pause controls, glance leaderboard — don't reduce it to a single "Manage Active Game" button. *(Partial: `fba1d19` separated Sidebar = Host Controls vs Main Stage = Participation. The pause/skip/advance buttons are scoped in [improvements-host-controls.md](improvements-host-controls.md) and tick when that ships. The remaining glance UI here is independent.)*

### 3. Cross-cutting

- [ ] Extract the duplicated `handleLogin` flow from `MeetBootstrap.svelte` and `MeetStage.svelte` into a single reusable component or composable
- [ ] Strip `console.log` / `[DEBUG]` statements from Meet components before deploy *(still present on `main` — `grep -n "console\.log" frontend/src/lib/components/Meet*.svelte`)*

## Files to touch

```text
frontend/
  src/lib/components/
    MeetBootstrap.svelte       # MODIFY: heading, participant view, sign-in CTA gating, skeleton, brand mark
    MeetStage.svelte           # MODIFY: list metadata, button copy, start confirmation, in-game controls
    MeetSignIn.svelte          # NEW: shared sign-in extracted from the two Meet components
```

## Verification

1. Reload the side panel as a participant before, during, and after a game — confirm the panel is useful at each stage (waiting / playing / finished) instead of redirecting attention elsewhere
2. Reload the side panel as a host before/during a game — confirm controls are reachable from the side panel without a full main-stage round trip
3. End-to-end Meet playthrough with two test accounts — same flow as Phase 4 verification, but rate the experience qualitatively against the boxes above
4. Strings: search `console.log` / `[DEBUG]` in [MeetBootstrap.svelte](../../frontend/src/lib/components/MeetBootstrap.svelte) and [MeetStage.svelte](../../frontend/src/lib/components/MeetStage.svelte) — should be zero hits

## Acceptance criteria

- All checkboxes above ticked
- Side panel never tells the user to "look elsewhere"; it always renders something useful for their current role + game phase
- No duplicated sign-in code paths
- No debug logging in Meet components on the production build

## Reference

- [docs/phases/04-meet.md](04-meet.md) — original Phase 4 plan
- [docs/phases/09-polish-deploy.md](09-polish-deploy.md) — broader polish + deploy work
