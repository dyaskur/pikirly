# Pikirly — Master Plan

Real-time multiplayer quiz (Kahoot-style). MVP-first; scale only when needed.

This file is the entry point. For detail, follow links.

## Roadmap

| # | Phase | Status | Doc |
|---|---|---|---|
| 1 | Minimal playable loop, in-memory state | ✅ Done | [01-mvp.md](phases/01-mvp.md) |
| 2 | Postgres + Google OAuth + Quiz editor | 🔜 Next | [02-persistence-auth-editor.md](phases/02-persistence-auth-editor.md) |
| 3 | Templates + AI Generation | 🔜 | [03-templates-ai.md](phases/03-templates-ai.md) |
| 4 | Google Meet add-on | 🔜 | [04-meet.md](phases/04-meet.md) |
| 5 | Google Slides add-on | 🔜 | [05-slides.md](phases/05-slides.md) |
| 6 | Question Type System (Foundation) | 🔜 | [06-question-types-foundation.md](phases/06-question-types-foundation.md) |
| 7 | Poll / Vote + Open Ended + Word Cloud | 🔜 | [07-poll-openended-wordcloud.md](phases/07-poll-openended-wordcloud.md) |
| 8 | Ordering / Ranking | 🔜 | [08-ordering-ranking.md](phases/08-ordering-ranking.md) |
| 9 | UX polish + deploy | 🔜 | [09-polish-deploy.md](phases/09-polish-deploy.md) |
| — | Redis multi-instance scaling | ⏸ Deferred | [deferred-redis.md](phases/deferred-redis.md) |

## Reference docs

| Topic | File |
|---|---|
| Architecture & layer separation | [architecture.md](architecture.md) |
| Data model (game state, DB, future Redis) | [data-model.md](data-model.md) |
| WebSocket event contract | [EVENTS.md](EVENTS.md) |
| Testing strategy | [testing.md](testing.md) |
| Decisions log (why we picked X over Y) | [decisions.md](decisions.md) |

## Locked product decisions

- **Host auth**: Google OAuth (Phase 2)
- **Quiz authoring**: JSON seed in Phase 1; **simple editor** (title + N questions) in Phase 2; rich media editor deferred
- **Players**: anonymous (nickname only, no accounts)
- **Scoring**: Kahoot time-decay — `1000 × (1 − timeUsed / (limit × 2))` for correct answers, else `0`; bounded `[0, 1000]`
- **Transport**: Socket.IO (rationale in [decisions.md](decisions.md))
- **State**: in-memory `Map` for MVP; Redis only if scale demands ([deferred-redis.md](phases/deferred-redis.md))
- **Persistence**: Postgres for users + quizzes + game history (Phase 2)

## Guiding principles

1. Real-time correctness > clever design
2. Server is authoritative for time, scoring, question advancement
3. No abstraction until third use
4. No backwards-compat shims (greenfield)
5. Cheap to run > infinitely scalable
