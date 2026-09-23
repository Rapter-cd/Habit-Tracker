# 05 — Key Features Audit

This is an honest, code-backed assessment of what works, what's partial, and what was scaffolded but not wired up. Interviewers respect honesty about gaps — "I know this has a limitation and here's why" is a stronger signal than pretending everything is production-ready.

---

## ✅ Fully Functional

### Authentication (Register / Login / Logout / Session Persistence)

**Files:** `backend/src/routes/auth.js`, `frontend/src/store/authStore.js`, `frontend/src/api/axios.js`, `frontend/src/router/ProtectedRoute.jsx`

- Registration with email uniqueness check (409 if duplicate)
- Login with bcrypt password comparison; generic error message prevents user enumeration
- JWT signed with 7-day expiry; stored in `localStorage` under `streakup_token`
- `bootstrap()` called on every page load — calls `GET /api/auth/me` to rehydrate user state without re-login
- `ProtectedRoute` shows a loading spinner while bootstrap resolves, then redirects to `/login` if no user
- Axios response interceptor auto-redirects to `/login` on any 401
- Logout clears `localStorage` and Zustand state

**Proof:** Every page in the app is accessible only after login. A hard-refresh on `/dashboard` re-authenticates via bootstrap before rendering.

---

### Habit CRUD (Create / Read / Update / Archive / Delete)

**Files:** `backend/src/routes/habits.js`, `frontend/src/pages/Dashboard.jsx`

- Create: POST `/api/habits` with name, category, frequency, targetDaysPerWeek
- List: GET `/api/habits` (default: active only; `?includeArchived=true` for all)
- Get single: GET `/api/habits/:id`
- Edit: PATCH `/api/habits/:id` — name, category, targetDaysPerWeek, archived flag
- Delete: DELETE `/api/habits/:id` — hard-delete that cascades to all CheckIns
- `frequency` is intentionally not patchable after creation (changing it makes existing check-in history ambiguous)
- Soft-delete via `archived: true` preserves history; habit disappears from dashboard but check-ins remain in analytics

**Proof:** `Dashboard.jsx` renders the create modal, posts to the API, and updates local state on success without a full page reload.

---

### Streak Calculation (Daily + Weekly)

**Files:** `backend/src/utils/calculateStreak.js`, `backend/src/routes/checkins.js`

- Daily streak: consecutive days with `status === 'done'`, walking backwards from today
- Weekly streak: consecutive ISO calendar weeks (Mon–Sun) where `done >= targetDaysPerWeek`
- `longestStreak` never decreases — stored denormalized and updated with `Math.max(prevLongest, currentStreak)`
- Habit creation date is a hard floor — no false break for days before the habit existed
- Pure function: no DB calls, no HTTP, fully deterministic — 14 Jest unit tests pass
- Called from `checkins.js` on every check-in, and from `refreshHabitStreaks()` on every habit GET

**Proof:** Run `npm test` in `backend/` — all 14 tests pass in under 1 second.

---

### Check-In (Upsert + History)

**Files:** `backend/src/routes/checkins.js`, `frontend/src/components/HabitCard.jsx`

- POST `/:id/checkin` accepts `status` (`done` | `skipped`), optional `date`, optional `note`
- Date normalized to midnight UTC before upsert — timezone-stable
- `findOneAndUpdate` with `upsert: true` — idempotent; safe to retry
- Compound unique index `(habitId, date)` enforces one check-in per habit per day at DB level
- Response includes updated `currentStreak` and `longestStreak`; frontend updates state without refetching
- GET `/:id/history` with optional `?from=&to=` date range filter

**Proof:** Clicking "Done" twice on the same habit in the same day does not create two check-ins — the upsert updates the existing one.

---

### Contribution Heatmap (365-Day GitHub-Style Grid)

**Files:** `backend/src/routes/analytics.js` (`/heatmap/:habitId`), `frontend/src/components/Heatmap.jsx`

- Backend pre-fills all 365 days: days with no check-in get `status: null` — frontend doesn't need to calculate gaps
- Frontend renders with CSS Grid: 53 columns × 7 rows; month labels positioned absolutely above columns
- Cells are padded to align with the correct day of week (ISO Mon = first column)
- Hover reveals date + status via `title` attribute
- Colors: emerald green = done, muted amber = skipped, near-transparent = no data

**Proof:** Navigate to any habit's detail page (`/habits/:id`) — the heatmap loads and renders 365 cells.

---

### Analytics Dashboard

**Files:** `backend/src/routes/analytics.js`, `frontend/src/pages/Analytics.jsx`

Three endpoints, all loaded in parallel with `Promise.all`:

1. **Summary** (`/api/analytics/summary`): overall 30-day completion rate, best/worst habit by rate, count of active streaks
2. **Completion over time** (`/api/analytics/completion-over-time`): daily completion % for last 30 days → LineChart
3. **Per-habit breakdown** (`/api/analytics/heatmap/:habitId`): called per-habit from `HabitDetail.jsx`

The frontend renders a Recharts `LineChart` (daily rate over 30 days) and `BarChart` (per-habit completion), both using `ResponsiveContainer` for responsive sizing.

**Proof:** Navigate to `/analytics` — stat cards, line chart, and bar chart all populate from real data.

---

### Social Groups (Create / Join / Leave / Leaderboard)

**Files:** `backend/src/routes/groups.js`, `frontend/src/pages/Groups.jsx`, `frontend/src/pages/GroupDetail.jsx`

- Create group: POST `/api/groups` — inviteCode auto-generated by `nanoid(8)` in Mongoose pre-validate hook
- Join by invite code: POST `/api/groups/join { inviteCode }` — idempotent (returns 200 if already a member)
- Group detail page shows member list with per-member streak totals
- Leaderboard: 30-day completion % computed per member via `computeScore()` — all scores computed in parallel with `Promise.all`
- Sorting: descending score, alphabetical name as tiebreaker; rank number attached (1-indexed)
- Leave: removes user from `group.members` and `user.groups`; transfers ownership if creator leaves; deletes group if last member leaves

**Proof:** Create two test accounts, create a group, join via the invite code on the second account — both appear on the leaderboard.

---

### Settings (Profile Update)

**Files:** `backend/src/routes/auth.js` (`PATCH /profile`), `frontend/src/pages/Settings.jsx`

- Update `name` and `avatar` (URL-only — no file uploads)
- Validated: name cannot be blank, avatar must be a valid URL
- On success, calls `authStore.setUser(updatedUser)` to update the Zustand store + Sidebar display without a page reload

---

### Global Toast Notification System

**File:** `frontend/src/components/Toast.js`

Vanilla JS implementation — no third-party toast library. Creates a DOM container, appends toast elements with CSS animations. Exports `toast.success()` and `toast.error()`. Used across all pages for API success/failure feedback.

---

## ⚠️ Partial / Fragile

### Streak Display on Dashboard Load (`refreshHabitStreaks`)

**File:** `backend/src/routes/habits.js` — `refreshHabitStreaks()` function

**What it does:** When `GET /api/habits` is called, it runs `calculateStreak` for each habit against today's date and re-saves if the stored value differs. This is meant to handle the case where a day passes and the stored `currentStreak` is stale (e.g., you had a streak of 5 yesterday, didn't check in today — stored value is still 5 but should be 0 or preserved for the "not yet checked in today" case).

**Why it's fragile:**
- It issues N+1 DB calls: one `CheckIn.find()` per habit. For a user with 20 habits, that's 20 separate DB round-trips on every dashboard load.
- The "fallback" logic (checking yesterday's date if today returns 0) is complex and somewhat heuristic — it tries to distinguish "hasn't checked in yet today but streak is still alive" from "actually missed a day."
- This logic is not covered by unit tests — only the pure `calculateStreak` function is tested, not `refreshHabitStreaks`.

**Better approach:** Use a scheduled job (e.g., a daily cron) to recalculate and reset stale streaks at midnight UTC, rather than doing it on every GET request. Or expose a separate `POST /api/habits/refresh-streaks` endpoint the frontend can call once on login.

---

### No Rate Limiting

The API has no rate limiting on auth endpoints. A brute-force attack on `POST /api/auth/login` could attempt thousands of passwords per minute against a known email address. For a production deployment, `express-rate-limit` should be added to the auth routes (e.g., 10 attempts per IP per 15 minutes).

---

### Avatar as URL-Only

**File:** `backend/src/routes/auth.js` (`PATCH /profile`), `frontend/src/pages/Settings.jsx`

Users can only set their avatar by pasting a URL. If the URL is a Gravatar or external image, it works. If it breaks or the external host blocks hotlinking, the avatar silently disappears. There is no file upload, no image hosting. The comment in `User.js` acknowledges this: `// no file uploads; users paste a URL`.

---

### No Refresh Token Strategy

The JWT has a 7-day expiry. When it expires, the user is silently redirected to `/login` (Axios response interceptor). There is no refresh token mechanism to silently re-authenticate. For a production app, a short-lived access token + long-lived refresh token stored in an HttpOnly cookie is the standard pattern.

---

## ❌ Scaffolded but Not Wired Up

### Integration Tests (supertest)

**File:** `backend/package.json` (`supertest` in devDependencies), `backend/src/index.js` (`module.exports = app`)

The comment `// exported for supertest in Phase 3` and the presence of `supertest` in devDependencies indicate integration tests were planned but never written. Only unit tests for `calculateStreak` exist. If asked about test coverage, be honest: the core algorithm is fully unit-tested, but API route integration is not.

### TypeScript Files in Frontend

**Files:** `frontend/src/counter.ts`, `frontend/src/main.ts`, `frontend/src/style.css`

These files (`counter.ts`, `main.ts`, `style.css`) look like leftover scaffolding from a Vite project initialization (they're from the Vite vanilla TypeScript template). The actual entry point is `main.jsx`, not `main.ts`. `style.css` is a separate file from `index.css` (which is the actual global stylesheet). These files are dead code and should be deleted.

**⚠️ Needs clarification — before the interview:** Delete `counter.ts`, `main.ts`, and `style.css` from `frontend/src/`. They are not imported anywhere and will confuse an interviewer who browses the codebase.

### Note Field on Check-Ins

**File:** `backend/src/models/CheckIn.js` (`note` field, max 280 chars)

The CheckIn schema has a `note` field and the API accepts it. However, the frontend (`HabitCard.jsx`, `HabitDetail.jsx`) does not expose a UI for writing or displaying notes. The field is wired in the backend but invisible to the user.
