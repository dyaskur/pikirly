# Pikirly — Real-Time Multiplayer Quiz

A Kahoot-style quiz platform. Hosts create and manage quizzes, start real-time games with a 6-digit PIN, and players participate via their mobile devices or browser.

## Features

- **Real-time Gameplay**: Questions broadcast instantly to all players using Socket.IO.
- **Scoring**: Kahoot-style time-decay scoring (faster correct answers earn more points).
- **Host Dashboard**: Create, edit, and delete custom quizzes.
- **AI Question Generation**: Generate quizzes from a topic, length, and difficulty via a multi-provider AI layer (Straico, OpenAI, OpenRouter) with automatic fallback.
- **Authentication**: Secure login via Google OAuth 2.0.
- **Persistence**: Quizzes and game history saved to PostgreSQL.
- **Live Leaderboard**: Real-time rank updates after every question.
- **Podium**: Final winners revealed at the end of the game.
- **Session-bound socket events**: `submit_answer` and `start_game` authorize via the socket session; `join_game` reconnect requires a secret per-player token.

## Tech Stack

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) (SPA mode) + [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- **Backend**: [Fastify](https://fastify.dev/) + [Socket.IO](https://socket.io/) + [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: Google OAuth 2.0 via `@fastify/oauth2`
- **Testing**: [Vitest](https://vitest.dev/) + [Testcontainers](https://testcontainers.com/) (Integration)

## Project Structure

```
kahoot-clone/
├── shared/              # Shared types, constants, and logic (scoring, events)
├── backend/             # Fastify server
│   ├── src/
│   │   ├── auth/        # OAuth & JWT middleware
│   │   ├── db/          # Drizzle schema, client, and repositories
│   │   ├── routes/      # REST API endpoints (Auth, Quizzes)
│   │   ├── services/    # Core game engine and lifecycle logic
│   │   ├── ws/          # WebSocket event handlers
│   │   └── server.ts    # Main entry point
│   ├── scripts/         # DB seeding and E2E smoke tests
│   └── tests/           # Unit and integration tests
└── frontend/            # SvelteKit SPA
    ├── src/
    │   ├── lib/         # Shared components, stores, and API wrappers
    │   ├── routes/      # App pages (Host dashboard, Join, Play, Login)
    │   └── app.css      # Global styles and design tokens
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (or Docker for Testcontainers)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` in `backend/` to `.env` and fill in your values (Database URL, Google OAuth credentials, etc.).

3. **Database Migration**:
   ```bash
   cd backend
   npm run db:generate
   npm run db:migrate
   ```

4. **Run Development Servers**:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev
   
   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

Visit `http://localhost:5173` to start playing.

## Development

### Testing

- **Backend**: `cd backend && npm test`
- **Smoke Test**: `cd backend && node scripts/smoke.mjs` (Requires backend running)

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Master Plan & Roadmap](docs/PLAN.md)
- [Architecture & Layer Separation](docs/architecture.md)
- [Data Model & Schema](docs/data-model.md)
- [WebSocket Event Contract](docs/EVENTS.md)
- [Testing Strategy](docs/testing.md)

---

### Roadmap

1. ✅ **Phase 1**: Minimal playable loop (In-memory)
2. ✅ **Phase 2**: Persistence (Postgres) + Auth (Google) + Quiz Editor
3. 🚧 **Phase 3**: Templates + AI Quiz Generation — *AI generation shipped; quiz templates pending*
4. 🔜 **Phase 4**: Google Meet Add-on
5. 🔜 **Phase 5**: Google Slides Add-on
6. 🔜 **Phase 6**: Advanced Question Types (True/False, Poll, etc.)
7. 🔜 **Phase 9**: UX Polish & Deployment

### TODO (next up)

- [ ] Quiz template library (`backend/src/data/templates.ts`) + `GET /templates` endpoints
- [ ] "Start from template" flow in the quiz editor
- [ ] Host-side reconnect using the existing `hostToken` (so a host refresh during lobby resumes the game)
- [ ] Production build path for the backend (replace `tsx` runtime with a `tsc` build)
