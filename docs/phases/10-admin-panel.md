# Phase 10 — Admin Panel

**Status**: Todo
**Depends on**: Phase 3 (Templates), Phase 9 (Polish/Deploy)
**Goal**: Internal tools for system administrators to manage content, moderate users, and curate the template library.

## Why this phase

As the platform grows, managing system templates via database seeds becomes inefficient. We need a UI to curate content, monitor system health, and handle moderation.

## Deliverables

### 1. Admin Authentication & Authorization
- [ ] Define `role` column in `users` table (`admin` | `host`).
- [ ] Create `isAdmin` middleware/guard for backend routes.
- [ ] Logic to manually promote a user to admin via CLI/DB.

### 2. Template & Category Management (CRUD)
- [ ] **Category Editor**: Create/Edit/Delete template categories and subcategories.
- [ ] **Template Editor**: Full UI to create and edit system templates (similar to Quiz Editor but for global templates).
- [ ] **Featured Templates**: Ability to "pin" or "feature" specific templates to the top of the selection modal.
- [ ] **Import/Export**: Export a user-created quiz into a system template.

### 3. Moderation & User Management
- [ ] **User List**: Search and filter users by email/name.
- [ ] **Quiz Moderation**: List all user-created quizzes; ability to flag or delete inappropriate content.
- [ ] **Account Actions**: Basic ability to suspend or delete user accounts.

### 4. Dashboard & Analytics
- [ ] **Key Metrics**: Real-time counters for:
  - Active Games
  - Total Quizzes Created
  - Total Users
- [ ] **Recent Activity**: Log of recently created quizzes and joined players.
- [ ] **AI Usage Tracking**: Monitor AI generation volume to track costs.

### 5. System Configuration
- [ ] **Maintenance Mode**: Toggle to prevent new games from starting during updates.
- [ ] **AI Provider Override**: UI to switch primary AI provider without server restart.

## User Interface

- Accessible at `/admin` (protected by admin role).
- Sidebar navigation for Dashboard, Templates, Quizzes, Users, Settings.
- Professional, data-dense tables with sorting and filtering.

## Technical Considerations

- **Security**: Strict server-side validation that only admins can hit `/api/admin/*` endpoints.
- **Audit Logs**: (Optional) Track which admin performed which action.
- **Shared Components**: Reuse `QuizEditor.svelte` logic for Template creation.

## Acceptance Criteria

- Admin can create a new category and add a template to it via UI.
- Non-admin users redirected away from `/admin`.
- Admin can see the total number of quizzes in the system.
- Template changes reflect instantly in the Host "Start from template" modal.
