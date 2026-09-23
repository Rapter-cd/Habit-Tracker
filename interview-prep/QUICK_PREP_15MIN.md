# StreakUp — 15-Minute Interview Crash Sheet

> Read this top to bottom. Every answer is written exactly how you should say it out loud.

---

## The One-Line Pitch

> "StreakUp is a full-stack social habit tracker built on the MERN stack. Users create daily or weekly habits, check in each day to build streaks, visualize progress on a heatmap, and compete with friends on a group leaderboard. The hardest technical problem I solved was designing a timezone-safe streak calculation algorithm — isolated as a pure function with 14 unit tests."

---

## The Stack (say this without hesitating)

| Layer | Tech | Why |
|---|---|---|
| Frontend | React + Vite | Component SPA, Vite is faster than CRA |
| Styling | Tailwind CSS | Utility-first, no CSS files to context-switch into |
| State | Zustand | Zero boilerplate vs Redux, selector-based re-renders |
| HTTP | Axios | Interceptors — inject JWT once, handle 401s globally |
| Routing | React Router v7 | Client-side navigation, protected route wrapper |
| Charts | Recharts | React-native charts, no imperative D3 setup |
| Backend | Node.js + Express | JS end-to-end, minimal and explicit |
| Database | MongoDB + Mongoose | Document model fits variable habit fields |
| Auth | JWT (7-day expiry) | Stateless, works cross-domain (Vercel + Render) |
| Passwords | bcryptjs (12 rounds) | One-way hash, salt rounds = brute-force resistance |
| Validation | express-validator | Declarative rules co-located with routes |
| Invite codes | nanoid(8) | Short, URL-safe, ~1.7 trillion combinations |
| Tests | Jest (14 tests) | Unit tests on pure streak function |
| Deploy | Render (BE) + Vercel (FE) | Free tier, GitHub auto-deploy |

---

## Architecture in 30 Seconds

```
Browser (Vercel CDN)
  └─ React SPA
       └─ Axios (Bearer token on every request)
            └─ Express API (Render)
                 ├─ protect middleware (JWT verify → req.user)
                 ├─ Route handlers (auth / habits / checkins / groups / analytics)
                 └─ MongoDB Atlas (4 collections: users, habits, checkins, groups)
```

**Key design choices:**
- Frontend and backend on **different domains** → JWT in header (not cookies) to avoid CORS cookie issues
- `vercel.json` rewrites all routes to `index.html` → React Router handles navigation on refresh
- `/api/health` endpoint → Render's zero-downtime health check

---

## The 4 Database Models

```
User      → name, email, password(hash), avatar(URL), groups[]
Habit     → userId, name, category, frequency, targetDaysPerWeek,
            currentStreak, longestStreak, archived
CheckIn   → habitId, userId, date(midnight UTC), status(done|skipped), note
Group     → name, description, inviteCode(nanoid 8), createdBy, members[]
```

**Critical index:** `CheckIn` has a **compound unique index on `(habitId, date)`**
→ Enforces one check-in per habit per day at the DB level
→ Makes the upsert idempotent — safe to retry on network failure

---

## Auth Flow (know this cold)

```
SIGNUP/LOGIN
  POST /api/auth/register or /login
  → validate input (express-validator)
  → bcrypt.compare() for login / bcrypt.hash() for register (pre-save hook)
  → jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
  → return { token, user }
  → frontend: localStorage.setItem('streakup_token', token)
  → Zustand: set({ user, token })

EVERY PROTECTED REQUEST
  Axios interceptor reads token from localStorage
  Adds: Authorization: Bearer <token>
  → protect middleware: jwt.verify() → User.findById() → req.user = user → next()

PAGE REFRESH
  App.jsx calls bootstrap() on mount
  bootstrap() → GET /api/auth/me → set({ user, loading: false })
  ProtectedRoute waits (loading spinner) → then renders or redirects

LOGOUT
  localStorage.removeItem('streakup_token')
  Zustand: set({ user: null, token: null })
  → React re-renders, ProtectedRoute redirects to /login
```

---

## The Streak Algorithm (the hardest part — know it)

**File:** `backend/src/utils/calculateStreak.js` — pure function, no DB calls

**Daily habits:**
1. Build a `Set` of all dates with `status === 'done'` → O(1) lookup
2. If today not in set → `currentStreak = 0`
3. Start at 1 (today), walk backwards day by day
4. Stop when you hit a gap OR the habit's creation date
5. `longestStreak = Math.max(prevLongest, currentStreak)` → never decreases

**Weekly habits:**
1. Group done check-ins by ISO week key (`"2024-W03"`)
2. A week is "complete" if `doneCount >= targetDaysPerWeek`
3. Walk backwards week by week from the current week
4. Stop at first incomplete week

**Why ISO week (Mon–Sun) not rolling 7 days?**
> "Fixed boundaries are predictable. A rolling window creates ambiguous edge cases — 'did I complete the week?' depends on which slice you ask about. ISO weeks match how users mentally think about 'this week'."

**Why recompute from ALL check-ins on every check-in?**
> "Incremental calculation would be wrong for back-dated check-ins. If a user fills in 3 missed days, you can't just +1 to the stored streak. Recomputing from scratch is always correct. The cost is one `CheckIn.find({ habitId })` query — fast enough at this scale."

---

## The Check-In Flow (trace this on a whiteboard)

```
1. User clicks "Done" on HabitCard
2. api.post('/api/habits/:id/checkin', { status: 'done' })
3. Axios interceptor injects Bearer token
4. protect middleware: verify JWT → attach req.user
5. toMidnightUTC(today) → normalize date to 2024-03-15T00:00:00.000Z
6. Habit.findOne({ _id, userId: req.user._id }) → ownership check
7. CheckIn.findOneAndUpdate({ habitId, date }, $set{...}, { upsert: true })
   → compound unique index prevents duplicates
8. CheckIn.find({ habitId }) → all check-ins for this habit
9. calculateStreak({ allCheckIns, ... }) → { currentStreak, longestStreak }
10. habit.save() → persist denormalized streak values
11. res.json({ checkIn, habit: { currentStreak, longestStreak } })
12. Frontend: surgically updates only that HabitCard in state (no full refetch)
```

---

## Key Design Decisions (with "why" ready)

| Decision | Answer |
|---|---|
| **Denormalized streak on Habit doc** | Dashboard/leaderboard reads are O(1). No aggregation on every load. Risk: drift — mitigated by 14 unit tests + `refreshHabitStreaks()` on GET. |
| **Midnight UTC for all dates** | The compound unique index is timezone-stable. Two users in different timezones checking in on "the same day" produce the same UTC midnight value. |
| **`frequency` not editable after creation** | Changing it makes all existing check-in history ambiguous for streak calculation. Users archive + recreate. |
| **Leaderboard uses 30-day completion %** | Fairer than raw streak count — new members aren't penalized. Formula: done check-ins / expected check-ins × 100. |
| **`Promise.all` for leaderboard scores** | Parallel DB calls, not sequential. N members = N parallel `computeScore()` calls. Weakness: one failure rejects all (should be `allSettled` in production). |
| **Soft-delete (archive) + hard-delete** | Archive preserves analytics history. Hard-delete cascades: also `deleteMany` on CheckIns (manual referential integrity — MongoDB has no FK constraints). |
| **nanoid over UUID for invite codes** | 8 chars is short enough to type/share manually, ~1.7T combinations — brute force is impractical. UUID is 36 chars — too long. |

---

## What's NOT Production-Ready (be honest — it's impressive)

| Gap | What you'd do in production |
|---|---|
| No rate limiting on `/api/auth/login` | Add `express-rate-limit` — 10 attempts / IP / 15 min |
| JWT in localStorage (XSS risk) | On same-domain deploy, use HttpOnly cookies instead |
| No refresh token | Short-lived access token + long-lived refresh token in HttpOnly cookie |
| `refreshHabitStreaks()` is N+1 queries | Replace with a nightly cron job that reconciles all streaks in one pass |
| `Promise.all` in leaderboard | Switch to `Promise.allSettled()` — partial failure shouldn't kill the whole leaderboard |
| No integration tests | `supertest` is installed, routes export the app — just not written yet |
| Dead files in frontend | `counter.ts`, `main.ts`, `style.css` are Vite scaffold leftovers — not wired up |

---

## The 8 Questions You WILL Get Asked

**Q: "Walk me through your architecture."**
> "Two-tier app. React SPA on Vercel, Express REST API on Render, MongoDB Atlas as the database. The frontend talks to the backend over HTTPS with JWTs in the Authorization header. The backend has a layered structure: CORS + body parser → protect middleware → route handler → Mongoose model → MongoDB."

---

**Q: "Why MongoDB over PostgreSQL?"**
> "The document model fit naturally. Habits have variable fields — `targetDaysPerWeek` only matters for weekly habits. In a relational model that's either a nullable column or a separate table. MongoDB expresses it cleanly in one schema. I'm aware the tradeoff is no FK constraints — I handle referential integrity manually, like `deleteMany` on CheckIns when a Habit is hard-deleted."

---

**Q: "Why Zustand and not Redux?"**
> "Redux is excellent for large teams that need enforced patterns and time-travel debugging. In this app, auth is the only global state — one object, five actions. Zustand handles it in under 60 lines, zero boilerplate, with selector-based subscriptions so components only re-render when exactly the slice they use changes. Redux would add three files per feature for no benefit at this scale."

---

**Q: "If the interceptor handles the token, why do you need Zustand?"**
> "They solve completely different problems. The Axios interceptor lives in the HTTP layer — it attaches the token to requests and handles 401s. It's invisible to React. Zustand lives in the UI layer — it tells React who is logged in right now, drives the loading spinner during bootstrap, shows the user's name in the Sidebar, and triggers re-renders when auth state changes. Without Zustand, React would have no idea whether to show a dashboard or a login screen."

---

**Q: "Why is the streak calculation a pure function?"**
> "Two reasons. First, it's independently unit-testable — no database, no HTTP server, 14 tests run in under a second. Second, the same function is called from two places: the check-in route and the `refreshHabitStreaks()` helper that corrects stale values on every GET /api/habits. A pure function guarantees both callers get the same correct result."

---

**Q: "What happens if MongoDB goes down?"**
> "The backend fails at `mongoose.connect()` on startup — `process.exit(1)` is called, Render restarts the process. Mid-request failures hit the global `errorHandler` and return 500. The frontend shows toast error notifications. There's no circuit breaker or retry queue — in production I'd add connection retry logic and alert on repeated 5xx responses via a monitoring tool like Datadog."

---

**Q: "What's the biggest weakness in your codebase?"**
> "`refreshHabitStreaks()` in `habits.js`. It runs on every `GET /api/habits` and fires one `CheckIn.find()` per habit — N+1 queries on every dashboard load. I added it to handle streak display when the day rolls over, but it doesn't scale. In production I'd replace it with a scheduled job that reconciles all streaks at midnight UTC in a single batch operation."

---

**Q: "How does the check-in endpoint handle double-clicks or retries?"**
> "It's fully idempotent. I use `findOneAndUpdate` with `upsert: true` keyed on the compound `(habitId, date)` — if a check-in for that date already exists it overwrites it, if not it creates one. The MongoDB compound unique index is the final backstop — even if two identical requests race, only one document can exist per `(habitId, date)`. The client gets a consistent response either way."

---

## 60-Second "Tell Me About This Project" Script

> "StreakUp is a social habit tracker I built with the MERN stack. The core features are daily and weekly habit tracking with streak calculation, a GitHub-style contribution heatmap, and group leaderboards for accountability.
>
> The most interesting technical challenge was the streak algorithm. I isolated it as a pure function with no database calls so it could be unit tested in isolation — 14 tests covering edge cases like back-dated check-ins, the day-before-habit-creation edge case, and the weekly ISO calendar window. The function is called both when a user checks in and on dashboard load to correct any stale values.
>
> The second interesting decision was the date storage strategy. All dates are normalized to midnight UTC before storage. This makes the compound unique index on `(habitId, date)` timezone-stable — two users checking in on the same subjective day always produce the same UTC timestamp, so the idempotency guarantee holds globally.
>
> I deployed it on Render for the backend and Vercel for the frontend. Since they're on different domains, I used JWT in the Authorization header rather than cookies to avoid cross-domain cookie complexity."

---

## Numbers to Remember

- `14` Jest unit tests
- `7` day JWT expiry
- `12` bcrypt salt rounds
- `8` character nanoid invite codes (~1.7T combinations)
- `365` days of heatmap data
- `30` days for analytics and leaderboard scoring
- `4` Mongoose models: User, Habit, CheckIn, Group
- `5` route files: auth, habits, checkins, groups, analytics
