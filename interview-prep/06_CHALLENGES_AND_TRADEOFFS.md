# 06 — Challenges & Trade-offs

Every non-trivial decision made in this codebase is documented here. This is the section that separates "built it" from "understands it."

---

## Hard Problems Solved

---

### 1. Timezone-Safe Date Storage and Streak Calculation

**The problem:**
Dates are deceptively hard. A user in India (UTC+5:30) checking in at 11pm is checking in on "today" for them, but it's already "tomorrow" in UTC. If you store the raw `Date.now()` timestamp, two users in different timezones checking in on the same subjective "day" will have different UTC dates, and the streak calculation will either double-count or miss days.

**The decision:**
Normalize all dates to midnight UTC (`T00:00:00.000Z`) at the point of entry — both in the API route and in the streak calculation function. `toMidnightUTC` calls `d.setUTCHours(0, 0, 0, 0)` to strip the time component.

```js
// backend/src/utils/calculateStreak.js
const toMidnightUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
```

The CheckIn compound unique index is on `(habitId, date)`. Because `date` is always midnight UTC, two check-ins from the same user on the same calendar day will have the same `date` value — the index enforces uniqueness correctly across timezones.

**The trade-off:**
This means "today" is always defined in UTC, not the user's local timezone. A user in UTC-8 (Pacific) checking in at 11pm PST on December 31 is actually checking in on January 1 UTC — this would register as the next calendar day in StreakUp. This is a known limitation. The proper fix is to accept the user's timezone in the request and convert to the correct UTC midnight for *their* day. That complexity was deferred — the current behavior is documented and consistent.

---

### 2. Streak Calculation as a Pure Function

**The problem:**
Streak logic is complex: daily vs. weekly modes, arbitrary back-dated check-ins, the "longest streak never decreases" invariant, ignoring days before the habit was created. If this logic lives inside the database query or the route handler, it becomes impossible to test without a real database and HTTP server.

**The decision:**
Extract all streak logic into `calculateStreak.js` as a pure function — no I/O, no side effects, no imports from models. The function receives all the data it needs as arguments and returns a value:

```js
const { currentStreak, longestStreak } = calculateStreak({
  checkinDate, frequency, targetDaysPerWeek,
  habitCreatedAt, longestStreak, allCheckIns,
});
```

This makes it unit-testable with plain objects — 14 tests run in under 1 second.

**The trade-off:**
To call `calculateStreak`, the route must first fetch **all** check-ins for the habit from the database, not just recent ones. This is `O(n)` in the number of check-ins. For a habit with 3 years of history (1000+ check-ins), this is one MongoDB query returning ~1000 documents. That's still fast (milliseconds), but it's inefficient compared to incremental calculation. Incremental calculation was rejected because it would be wrong for back-dated check-ins — recomputing from scratch is always correct.

---

### 3. Idempotent Check-In Endpoint

**The problem:**
If a user clicks "Done" and the network is slow, they might click again before the first response arrives, or the frontend might retry on timeout. Without idempotency, they'd get duplicate check-ins and inflated streaks.

**The decision:**
Use `findOneAndUpdate` with `upsert: true` keyed on `(habitId, date)`:

```js
await CheckIn.findOneAndUpdate(
  { habitId: habit._id, date: checkinDate },
  { $set: { ... } },
  { upsert: true, new: true }
);
```

The compound unique index at the database level is the backstop — even if two identical requests race, MongoDB's atomicity guarantees only one document exists per `(habitId, date)`.

**The trade-off:**
The endpoint always returns `201 Created` even on update (existing check-in overwritten). Strictly speaking, an update should return `200 OK`. This is a minor REST semantics deviation accepted for simplicity.

---

### 4. Denormalized Streak Values on the Habit Document

**The problem:**
The dashboard shows `currentStreak` for every habit. If streak were computed on-demand from CheckIn records, every dashboard load would require N+1 queries (one aggregation per habit) to compute N streaks.

**The decision:**
Store `currentStreak` and `longestStreak` directly on the Habit document. They're updated after every check-in by the streak calculation function. Dashboard reads are `O(1)` — just return the Habit documents.

```js
// Habit model
currentStreak: { type: Number, default: 0 }
longestStreak: { type: Number, default: 0 }
```

**The trade-off:**
Denormalized data can drift. If `calculateStreak` has a bug, the stored values could be wrong. The mitigation is: (a) 14 unit tests on the calculation function, (b) the `refreshHabitStreaks()` function in `habits.js` recalculates and corrects stored values on every `GET /api/habits` call. The second mitigation is costly (see the weakness noted in `05_KEY_FEATURES.md`) but prevents stale values from persisting indefinitely.

---

### 5. Weekly Streak Window: ISO Calendar Week vs. Rolling 7 Days

**The problem:**
For weekly habits, what counts as "a week"? Two options: (a) ISO calendar week (Mon–Sun fixed boundaries), or (b) rolling 7-day window (the 7 days before "today").

**The decision:**
ISO calendar week. `isoWeekKey()` in `calculateStreak.js` returns a string like `"2024-W03"` (year + ISO week number). A week is "completed" if `donePerWeek.get(weekKey) >= targetDaysPerWeek`.

```js
const isoWeekKey = (date) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));  // move to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};
```

**Why ISO week:**
- Predictable UX — "this week" means Mon–Sun, matching how users think about "the week"
- Rolling windows create ambiguity: if the user did 3 out of 3 required days Mon/Tue/Wed, their "rolling window" could be incomplete on a Saturday if checked naively

**The trade-off:**
On Sunday night, a user who completed their weekly target Mon–Sat but forgot to check in on Sunday might have their streak reset when the ISO week turns over at midnight. A rolling window would be more forgiving. This is a product decision, not a bug.

---

### 6. JWT in localStorage vs. HttpOnly Cookie

**The problem:**
Storing JWTs in `localStorage` is accessible to JavaScript, making it vulnerable to XSS (cross-site scripting) attacks. HttpOnly cookies cannot be read by JavaScript and are the recommended approach.

**The decision:**
Use `localStorage` with the `Authorization: Bearer` header pattern.

**Why:**
The frontend (Vercel, `app.vercel.app`) and backend (Render, `api.onrender.com`) are on different domains. HttpOnly cookies require `SameSite=None; Secure` and the server must respond with `Access-Control-Allow-Credentials: true` and `Access-Control-Allow-Origin` set to the exact frontend origin (not `*`). This is doable but adds configuration complexity on both ends.

**The trade-off:**
This is a legitimate security compromise. In a production system with same-domain deployment (e.g., frontend and backend on `streakup.com` and `api.streakup.com`), HttpOnly cookies would be the correct choice. The JWT payload only contains `{ userId }` — if stolen, the impact is session impersonation for up to 7 days (the expiry). There's no sensitive PII in the token itself.

---

### 7. Frequency is Immutable After Creation

**The problem:**
What happens if a user creates a daily habit, accumulates 30 days of check-in history, then wants to change it to weekly? The existing check-ins were valid for daily (one per day). If the frequency switches to weekly, the streak algorithm would try to count done-days-per-week against a `targetDaysPerWeek` that didn't exist for any of the old check-ins.

**The decision:**
`frequency` is not included in the PATCH endpoint's allowed fields. The code comment in `habits.js` explains:

```js
// Note: `frequency` is intentionally not patchable after creation — changing
// it would make existing check-in history ambiguous for streak calculation.
```

**The trade-off:**
Users who want a different frequency must archive the habit and create a new one. This loses streak continuity, which is frustrating UX. The alternative (allowing frequency changes) would require migrating or invalidating historical data — a more complex solution deferred in favor of correctness.

---

## Decisions Rejected and Why

| Rejected Approach | What I Did Instead | Why Rejected |
|---|---|---|
| Server-side sessions (Redis) | Stateless JWT | Cross-domain deployment makes cookies complex; JWT is simpler here |
| React Query for server state | Manual `useState` + `useEffect` + `api.get()` | Adds a dependency for a feature (stale-while-revalidate, caching) that wasn't prioritized |
| Incremental streak calculation | Recompute from all check-ins each time | Incremental is wrong for back-dated check-ins; correctness > performance at this scale |
| Rolling 7-day window for weekly | ISO calendar week (Mon–Sun) | Rolling window is harder to reason about; ISO weeks match user mental model |
| Separate GroupMembership collection | `members[]` array on Group document | Simple array is fine for small social groups; separate collection needed only at scale |
| Mongoose `populate()` everywhere | Selective populate only where needed | Over-populating adds document size and unnecessary joins; checked against each query's actual use |
| Real-time updates (WebSockets) | Polling via page reload / manual refresh | WebSockets require stateful server; out of scope for free-tier Render (stateless processes) |
| Rate limiting (express-rate-limit) | Nothing | Known gap — flagged in `05_KEY_FEATURES.md`; should be added before any production use |

---

## Honest Architectural Limitations

1. **No horizontal scaling.** The `JWT_SECRET` must be the same on all instances. On Render's free tier this is fine (single instance). For multiple instances, the secret must be centralized (already done via env var — scaling just needs multiple dynos).

2. **No caching layer.** The analytics and leaderboard endpoints recompute on every request. For a group leaderboard with 50 members, that's 50 `computeScore()` calls each making 2 DB queries — 100 queries per leaderboard request. At scale, this needs a Redis cache with TTL.

3. **Streak drift risk.** If a bug is introduced in `calculateStreak.js`, all denormalized streak values on Habit documents become wrong. The unit tests and `refreshHabitStreaks()` mitigate this, but there's no async reconciliation job.

4. **Single-region database.** MongoDB Atlas M0 is in one region. Users far from the Atlas region will see higher latency. Upgrading to M10+ with geo-distributed reads would fix this.
