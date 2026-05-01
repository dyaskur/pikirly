# Phase 5 — Google Slides Add-on

**Status**: 🔜
**Depends on**: Phase 4 (Meet add-on, Workspace registration already done)
**Goal**: Host embeds a quiz/poll in a Google Slides presentation; audience responds live on their phone while the slide is shown, results appear in the sidebar in real-time.

## Why this phase

Slido-style integration. Hosts already use Slides for presentations — embedding Pikirly removes the context switch. Phase 4 handles the Workspace Marketplace registration; Phase 5 adds the Slides surface on top of it.

## Out of scope (intentional)

- Full canvas/WYSIWYG slide editor (read-only embed only)
- Automatic result overlay on the slide canvas (images only, not live-updating)
- Offline / export to PDF with results
- Microsoft PowerPoint add-in

## Design constraints

- Slides add-on UI = Google Cards API (not HTML iframe like Meet)
- Slides API can insert/update an image onto the slide (use for QR code + result summary)
- No real-time push from Slides API — poll backend from add-on sidebar via `fetch` (~3s interval)
- Add-on runs as Google Apps Script (TypeScript via `clasp`)

## Deliverables

### 1. Apps Script project setup

- [ ] Install `clasp` globally: `npm i -g @google/clasp`
- [ ] New directory `slides-addon/` at repo root
- [ ] Init with `clasp create --type sheets` (Slides-compatible)
- [ ] TypeScript config for Apps Script environment
- [ ] `appsscript.json` manifest:
  - `oauthScopes`: `presentations.readonly`, `drive.file`, `script.external_request`
  - `addOns.slides` surface declared

### 2. Workspace Marketplace — extend registration

- [ ] Add Slides surface to existing Marketplace listing (from Phase 4)
- [ ] Additional OAuth scopes: `presentations.readonly`, `drive.file`
- [ ] Update privacy policy / terms if required by new scopes

### 3. Sidebar UI (Cards API)

- [ ] `onOpen` trigger → show sidebar card
- [ ] Card states:
  - **Unauthenticated**: "Sign in to Pikirly" button → OAuth via `ScriptApp.getOAuthToken()` forwarded to backend
  - **Authenticated, no active game**: quiz picker list (calls `GET /quizzes`) + "Start game" button
  - **Game active**: live result summary (answer counts per choice), "End game" button
- [ ] "Embed QR code" button → inserts QR code image onto current slide pointing to game join URL

### 4. Backend changes

- [ ] `GET /quizzes` already exists — ensure CORS allows Apps Script origin (`https://script.google.com`)
- [ ] No new endpoints needed — reuse `POST /games`, `GET /games/:gameId`, `GET /quizzes`

### 5. QR code on slide

- [ ] Generate QR code server-side (use `qrcode` npm package) on `POST /games` response
- [ ] New field in game response: `qrCodeDataUrl: string` (base64 PNG)
- [ ] Sidebar inserts image onto slide via `SlidesApp.getActivePresentation().getSelection().getCurrentPage().insertImage(blob)`

### 6. Live result polling

- [ ] Sidebar polls `GET /games/:gameId` every 3 seconds while game active
- [ ] Displays per-question answer distribution as text/emoji bar chart (Cards API only, no canvas)
- [ ] On game end: show final leaderboard top 5 in sidebar; offer "Insert results summary" button → inserts summary image onto slide

## Files to touch

```
slides-addon/                                  # NEW — Google Apps Script project
  src/Code.ts                                  # add-on entry: onOpen, sidebar card builder
  src/Auth.ts                                  # OAuth token forwarding to Pikirly backend
  src/Quiz.ts                                  # quiz list + game start logic
  src/Results.ts                               # polling + result display
  src/appsscript.json                          # manifest
  .clasp.json                                  # clasp project config (gitignored for scriptId)
  tsconfig.json

backend/
  src/routes/game.routes.ts                    # MODIFY: add qrCodeDataUrl to POST /games response
  src/server.ts                                # MODIFY: CORS allow script.google.com
  package.json                                 # MODIFY: add qrcode dep
```

## Verification

1. `clasp push` → script deploys without errors
2. Install add-on in test Slides doc (Workspace Marketplace test mode)
3. Open sidebar → authenticated → quiz list loads
4. Pick quiz → "Start game" → QR code appears on current slide
5. Scan QR on phone → joins game → answers
6. Sidebar polls and shows live answer counts updating ~3s
7. End game → leaderboard shows in sidebar
8. Meet add-on (Phase 4) and standalone web flow unaffected

## Acceptance criteria

- Host can start a quiz from inside Google Slides without leaving the presentation
- QR code inserted on slide is scannable and leads directly to the game
- Live results update in sidebar during game
- Workspace Marketplace listing covers both Meet (Phase 4) and Slides surfaces

## Hard parts

- Google Workspace Add-on review: submit both surfaces together; approval takes 1–4 weeks
- Cards API has no custom CSS — layout is constrained to card/section/widget primitives
- Apps Script `fetch` is synchronous — 3s polling is the practical minimum for "live" feel
- `clasp` TypeScript support requires `@types/google-apps-script`

## Reference

- [Google Slides Add-on overview](https://developers.google.com/workspace/add-ons/editors/slides)
- [Google Workspace Marketplace submission](https://developers.google.com/workspace/marketplace/how-to-publish)
- [clasp — Apps Script CLI](https://github.com/google/clasp)
- [04-meet.md](04-meet.md) — prerequisite phase
