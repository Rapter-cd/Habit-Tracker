# 07 — Interview Q&A Bank

Questions derived specifically from this codebase — not generic MERN questions. Cover the answer with your hand and try to answer from memory first.

---

## Architecture & Design

---

**Q1: Walk me through your system architecture from a user clicking "Done" to the streak number updating on screen.**

> This is the whiteboard question. Trace: HabitCard click → Axios adds Bearer token → Express CORS + morgan → `protect` middleware JWT-verifies + attaches `req.user` → `checkins.js` validates input → normalizes date to midnight UTC → verifies habit ownership with `Habit.findOne({ _id, userId })` → upserts CheckIn → fetches all check-ins → calls pure `calculateStreak()` → updates denormalized streak fields on Habit → responds with `{ checkIn, habit: { currentStreak, longestStreak } }` → `HabitCard.onCheckin(data.habit)` surgically updates state → React re-renders only that card.
>
> The key insight: the response carries back the new streak values, so the UI updates without a second API call. No full habits refetch needed.

---

**Q2: Why did you separate `calculateStreak` into its own utility file instead of writing the logic inline in the route handler?**

> Three reasons. First, it's independently unit-testable — no database, no HTTP server, just plain function calls. My 14 Jest tests run in under a second. Second, the function is called from two different places: `checkins.js` (after every check-in) and `refreshHabitStreaks()` in `habits.js` (on every GET /api/habits to correct stale values). Co-locating the logic in one file prevents divergence. Third, it's explainable in isolation — I can walk through the algorithm (build a Set of done-days, walk backwards from today, stop at creation date) without the noise of database code around it.

---

**Q3: Your `Habit` document stores `currentStreak` and `longestStreak` directly. What's the risk of denormalization and how do you mitigate it?**

> The risk is drift — if the calculation function has a bug or a check-in is deleted, the stored values become wrong. I mitigate this in two ways: (a) `calculateStreak.js` has 14 unit tests covering all edge cases including `longestStreak` never decreasing; (b) `refreshHabitStreaks()` runs on every `GET /api/habits` and recomputes from scratch, correcting any drift. The trade-off I accepted is that `refreshHabitStreaks()` is expensive — it's an N+1 query pattern. In production I'd replace it with a nightly cron job that reconciles all habit streaks in one pass.

---

**Q4: Why is `frequency` not editable after a habit is created?**

> Changing `frequency` makes all existing check-in history ambiguous. Imagine a user has 30 daily check-ins. If I change `frequency` to `weekly`, the streak algorithm would try to evaluate done-days-per-week against `targetDaysPerWeek` on records that were made without that constraint. The historical count of done-days-per-week would be based on coincidence rather than intent. To preserve correctness, I made `frequency` immutable. The `PATCH /api/habits/:id` route simply doesn't include `frequency` in the allowed update fields. The documentation comment in `habits.js` explains this explicitly. Users who want a different frequency archive and recreate.

---

**Q5: How does `ProtectedRoute` work and what happens during the bootstrap delay?**

> On every app load, `App.jsx` calls `authStore.bootstrap()` in a `useEffect`. Bootstrap reads the token from `localStorage`, calls `GET /api/auth/me`, and either hydrates the user or clears the stale token. While this async call is in flight, `loading` in the Zustand store is `true`. `ProtectedRoute` checks `loading` first — if still loading, it renders a full-page spinner. Only after bootstrap resolves does it check `user`. If no user, it redirects to `/login` with the `from` location preserved (so after login, the user is redirected back to where they were going). This prevents the app from flashing `/login` on every refresh before the rehydration completes.

---

## Technology Choice / Trade-offs

---

**Q6: Why MongoDB instead of PostgreSQL for this project?**

> The data model fit naturally. Habits have variable fields depending on frequency — `targetDaysPerWeek` is only meaningful for weekly habits. In a relational model I'd either have nullable columns or a separate table for weekly habit config. MongoDB's document model lets me express this cleanly in one schema. More practically: Atlas's free M0 tier made deployment zero-cost. I'm aware of the tradeoffs — no foreign key constraints, no multi-document transactions. I handle referential integrity manually: when a Habit is hard-deleted, I also `deleteMany` on its CheckIns in the route handler. For the leaderboard computations, I don't need JOINs — I use `Promise.all` with separate queries, which is explicit and easy to reason about.

---

**Q7: Why Zustand instead of Redux for state management?**

> Redux Toolkit is excellent when you need enforced patterns across a large team, time-travel debugging, or complex middleware like redux-saga. In this app, the only global state is auth: `{ user, token, loading }` and four actions. Zustand handles this in under 60 lines with zero boilerplate. The selector-based subscriptions (`useAuthStore((s) => s.user)`) mean components only re-render when exactly the slice they use changes — I get the same optimization as Redux without the ceremony. If this app grew to 10 developers and multiple global slices, Redux would become the right call.

---

**Q8: Why store the JWT in localStorage instead of an HttpOnly cookie?**

> The cross-domain deployment forced this decision. The frontend is on Vercel (`app.vercel.app`) and the backend is on Render (`api.onrender.com`). For HttpOnly cookies to work cross-domain, the backend needs `Access-Control-Allow-Credentials: true` and `SameSite=None; Secure`, and the frontend's Axios requests need `withCredentials: true`. This configuration is error-prone across two different cloud providers. The `Authorization: Bearer` header pattern works cross-domain without any of that. The JWT payload contains only `{ userId }` — if stolen via XSS, the worst case is session impersonation for 7 days. In a production system with same-domain deployment or a BFF, I'd switch to HttpOnly cookies immediately.

---

**Q9: The check-in endpoint fetches all check-ins for a habit to recalculate the streak. Isn't that expensive?**

> It's a deliberate correctness-over-performance tradeoff. Incremental calculation would be: take the stored `currentStreak`, see if today was done, add 1. That works for normal today-only check-ins. But the API accepts an optional `date` parameter, allowing back-dated check-ins. If a user back-fills three missed days, incremental calculation would produce the wrong streak. Recomputing from all check-ins always produces the correct answer. The cost is one `CheckIn.find({ habitId })` query returning all of a habit's history — typically a few hundred documents, which MongoDB returns in milliseconds. If a habit had millions of check-ins (thousands of years of data), I'd add a date window cutoff to the query.

---

**Q10: Why ISO calendar week for weekly habits instead of a rolling 7-day window?**

> Predictability. A fixed Mon–Sun week matches how users mentally model "this week." A rolling window creates confusing edge cases: check in on Monday and Wednesday, skip Thursday through Saturday, check in on Sunday — did you "complete the week"? Under a rolling window, the answer depends on which 7-day slice you ask about. Under ISO weeks, the answer is always deterministic: did you hit `targetDaysPerWeek` done days in this Mon–Sun block? Users find this easier to plan around. The downside is harder edge cases at week boundaries, which the unit tests for `isoWeekKey` cover explicitly.

---

## Scaling & Failure Modes

---

**Q11: What happens if MongoDB Atlas goes down?**

> The backend fails at the `mongoose.connect()` call in `index.js` — `process.exit(1)` is called, Render detects the process crash, and restarts it. During the outage, every API call that hits the database will throw an unhandled promise rejection caught by the global `errorHandler`, which returns `500 Internal Server Error`. The frontend Axios response interceptor doesn't handle 500s specially — the user sees toast error notifications. There's no circuit breaker, no fallback cache, no queue for write retries. In production, I'd add connection retry logic (Mongoose has `reconnectTries`) and instrument with an alerting service like Datadog.

---

**Q12: What happens if the leaderboard endpoint receives a group with 50 members?**

> Currently: `computeScore()` is called for each of the 50 members inside `Promise.all`. Each `computeScore()` makes 2 DB queries (one `Habit.find()`, one `CheckIn.countDocuments()`). That's 100 DB round-trips per leaderboard request, all running in parallel. On the free-tier Atlas M0 with a 100-connection pool shared with other users, this could cause contention or timeouts. The fix is to cache the leaderboard result in Redis with a 5-minute TTL — leaderboard rankings don't need to be real-time. Alternatively, precompute scores in a nightly job and store them on the User document. Neither is implemented yet.

---

**Q13: If 10x traffic hit the backend overnight, what would break first?**

> Three things, in order of likely failure:
> 1. **MongoDB Atlas M0 connection limit.** The free tier limits concurrent connections. Express maintains a Mongoose connection pool; under load, new requests would queue waiting for a connection and eventually time out.
> 2. **`refreshHabitStreaks()` amplification.** Every `GET /api/habits` call triggers N+1 DB queries. At 10x load, that function becomes the bottleneck. It should be replaced with a background job.
> 3. **Render's free-tier single instance.** Node.js is single-threaded; CPU-intensive work (bcrypt during login, streak calculation across large datasets) blocks the event loop. Horizontal scaling (multiple Render dynos behind a load balancer) fixes this, but requires the JWT secret to be centralized — which it already is via env var.

---

**Q14: If a user's streak is showing the wrong number, how would you debug it?**

> Step 1: Pull all CheckIn documents for that habit from MongoDB (`db.checkins.find({ habitId: "..." }).sort({ date: 1 })`). Step 2: Run `calculateStreak()` in a Node REPL with those documents — the function is pure so I can reproduce the bug exactly without touching the database. Step 3: Check `toMidnightUTC()` output for each check-in — timezone drift is the most common cause of wrong dates. Step 4: Look at `refreshHabitStreaks()` — it has fallback logic (checking yesterday's date if today returns 0) that could be masking the correct streak value. Step 5: Compare the computed value against what's stored on the Habit document — if they differ, the `habit.save()` in `checkins.js` didn't run (e.g., an exception was caught silently).

---

**Q15: What happens when a Render free-tier service spins down and a user hits the app?**

> Render free-tier services spin down after 15 minutes of inactivity. The first request after spin-down triggers a cold start — typically 30-60 seconds. During this time, the Express server is not running. The frontend Axios request will time out, the `catch` block in each page component runs, and the user sees a toast error ("Failed to load habits"). There's no loading state management for this scenario — the spinner just spins until timeout. Better UX would be to poll `/api/health` on page load and show a "Service is warming up..." message. The `render.yaml` doesn't configure a keep-alive ping either. This is a known limitation of free-tier deployment.

---

## Debugging — STAR Format

---

**Q16: Tell me about a bug you encountered and fixed.**

**Situation:** During development, a user's daily streak was showing as 0 on the dashboard even though they had checked in every day for the past week.

**Task:** Determine why `currentStreak` was 0 when it should have been 7.

**Action:** I pulled the habit's check-ins from MongoDB and ran them through `calculateStreak()` in a Node REPL. The dates were all correct. Then I noticed that the check-ins were stored with non-zero time components — `2024-03-10T14:32:07.123Z` instead of `2024-03-10T00:00:00.000Z`. The `doneDays` Set used ISO date strings like `"2024-03-10"`, and `cursor.toISOString().slice(0, 10)` also produced `"2024-03-10"` — so the lookup should have worked. But the bug was in the upsert: the `findOneAndUpdate` filter used `{ date: checkinDate }` where `checkinDate` was already normalized to midnight UTC — but the *existing* documents in the DB had been written *before* I added the normalization step. The unique index was matching on exact date value, so old check-ins (with non-midnight timestamps) were not found and new documents were inserted alongside them.

**Result:** I added a migration script to normalize all existing CheckIn dates to midnight UTC, and confirmed that `toMidnightUTC()` was called before every upsert. After the migration, the streak calculation worked correctly. This reinforced why the normalization must happen at the API boundary — you can't trust that incoming data is already normalized.

---

**Q17: Describe a design decision you would change if you were building this again.**

**The `refreshHabitStreaks()` function in `habits.js`.**

I added it to handle the case where a user's streak should "stay alive" if they haven't checked in yet today but had a streak going yesterday. It checks both today and yesterday dates and picks the higher streak. The problem is it runs on every `GET /api/habits` — N+1 queries on every dashboard load. If I were building this again, I'd use a different approach: don't try to show a "live" streak on the dashboard. Instead, show the stored streak (which reflects the last check-in event) and use a visual indicator ("✓ checked in today" vs. "check in to continue your streak") rather than re-running the algorithm on every load. The streak value is immutable until the user checks in — there's no need to recalculate it proactively.

---

**Q18: Your leaderboard uses `Promise.all` to compute all member scores in parallel. What bug could this introduce?**

> If any single `computeScore()` call throws an unhandled error (e.g., a member's habits collection is corrupted), `Promise.all` rejects immediately and the entire leaderboard request fails with a 500 — even if the other 49 members computed correctly. In production I'd switch to `Promise.allSettled()` and filter for fulfilled results, returning partial leaderboard data with a warning for members whose score couldn't be computed. This is a known gap — the current code prioritizes simplicity over resilience.
