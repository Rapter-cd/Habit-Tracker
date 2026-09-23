# 03 — Data Flow

## The Scenario: User Checks In a Habit as "Done"

This is the most complex request in the system — it involves auth, ownership verification, an idempotent database write, a pure-function streak calculation, a denormalized field update, and a UI state mutation. Tracing it end-to-end demonstrates every major system component.

---

## Step-by-Step Narrative

### Step 1: User Action — Click "Done" on a HabitCard

**File:** `frontend/src/components/HabitCard.jsx`

The user clicks the "Done" button on a `HabitCard`. The click handler calls `handleCheckin('done')`:

```js
const handleCheckin = async (status) => {
  setLoading(status); // disables the button + shows spinner
  const { data } = await api.post(`/api/habits/${habit._id}/checkin`, { status });
  onCheckin(data.habit); // bubble updated streak values up to Dashboard
  toast.success('🔥 Checked in!');
};
```

---

### Step 2: Axios Interceptor Injects the JWT

**File:** `frontend/src/api/axios.js`

Before the request leaves the browser, the Axios request interceptor runs:

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('streakup_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

The HTTP request that hits the server looks like:
```
POST /api/habits/6789abcd.../checkin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{ "status": "done" }
```

---

### Step 3: Express CORS + Middleware Stack

**File:** `backend/src/index.js`

The request hits the Express server. Middleware runs in declared order:

1. `cors()` — verifies `Origin` header matches `CLIENT_ORIGIN` env var (cross-domain check)
2. `express.json()` — parses the JSON body and attaches to `req.body`
3. `morgan('dev')` — logs `POST /api/habits/678.../checkin 201 45ms`

Express then matches the route pattern:
```js
app.use('/api/habits/:id/checkin', checkinRoutes);
```
The `:id` param is captured and passed to the checkin router via `mergeParams: true`.

---

### Step 4: `protect` Middleware — JWT Verification

**File:** `backend/src/middleware/auth.js`

The checkin router mounts `router.use(protect)`, so `protect()` runs before the handler:

```js
const protect = async (req, res, next) => {
  // 1. Extract token from "Authorization: Bearer <token>"
  const token = authHeader.split(' ')[1];

  // 2. Cryptographically verify the signature + check expiry
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // decoded = { userId: "6789abcd...", iat: ..., exp: ... }

  // 3. Fetch the actual user from DB (ensures user wasn't deleted after token was issued)
  const user = await User.findById(decoded.userId);
  // password field excluded because schema sets select: false

  req.user = user; // attach to request
  next();
};
```

If the token is expired: `401 { message: "Token expired. Please log in again." }`
If the token is invalid: `401 { message: "Invalid token." }`

---

### Step 5: Input Validation

**File:** `backend/src/routes/checkins.js`

`express-validator` rules run as middleware before the async handler:

```js
body('status').isIn(['done', 'skipped']).withMessage('...')
body('date').optional().isISO8601()
body('note').optional().isLength({ max: 280 })
```

`validate(req, res)` collects any errors. If validation fails: `400 { errors: [...] }` and return early.

---

### Step 6: Date Normalization

**File:** `backend/src/routes/checkins.js` + `backend/src/utils/calculateStreak.js`

```js
const rawDate = req.body.date ? new Date(req.body.date) : new Date();
const checkinDate = toMidnightUTC(rawDate);
// e.g. 2024-07-15T13:42:00+05:30 → 2024-07-15T00:00:00.000Z
```

`toMidnightUTC` calls `d.setUTCHours(0, 0, 0, 0)`. This strips the time component, making the date timezone-stable. Two users in different timezones checking in on "today" both produce `2024-07-15T00:00:00.000Z`.

---

### Step 7: Ownership Verification

**File:** `backend/src/routes/checkins.js`

```js
const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
if (!habit) return res.status(404).json({ message: 'Habit not found.' });
```

The query includes **both** `_id` AND `userId`. This means a user cannot check in on another user's habit — even if they know its `_id` — because the query simply returns null and we 404.

---

### Step 8: Upsert the CheckIn

**File:** `backend/src/routes/checkins.js`

```js
const checkIn = await CheckIn.findOneAndUpdate(
  { habitId: habit._id, date: checkinDate },  // find by compound key
  { $set: { habitId, userId, date, status, note } },
  { upsert: true, new: true, runValidators: true }
);
```

- **Find by:** `(habitId, date)` — the compound unique index key
- **Upsert:** if no document matches, insert it; if one matches, update it
- This means the endpoint is **idempotent**: calling it twice with `status: "done"` on the same date just overwrites with the same data. The DB's unique index would prevent a second INSERT anyway.

---

### Step 9: Streak Recalculation (Pure Function)

**File:** `backend/src/routes/checkins.js` → `backend/src/utils/calculateStreak.js`

```js
// Fetch ALL check-ins for this habit (not just recent ones)
const allCheckIns = await CheckIn.find({ habitId: habit._id }).lean();

const { currentStreak, longestStreak } = calculateStreak({
  checkinDate,              // the date being checked in
  frequency: habit.frequency,
  targetDaysPerWeek: habit.targetDaysPerWeek,
  habitCreatedAt: habit.createdAt,
  longestStreak: habit.longestStreak,  // previous value (used as floor)
  allCheckIns,
});
```

Inside `calculateStreak` (for a daily habit):

1. Build a `Set<string>` of all dates with `status === 'done'` — O(n) build, O(1) lookup
2. If `checkinDate` is not in the set → `currentStreak = 0` (guard for "skipped" check-ins)
3. Start `streak = 1` (today counts), walk `cursor` backwards one day at a time
4. Stop when cursor falls before `habitCreatedAt` OR hits a day not in the set
5. `longestStreak = Math.max(prevLongest, currentStreak)` — never decreases

**Why re-fetch all check-ins instead of incrementing?** Because the caller can check in for any arbitrary past date (the API accepts an optional `date` param). Incrementing from the stored value would be wrong for back-dated check-ins. Recomputing from scratch is always correct and the function is fast enough for a single habit's history.

---

### Step 10: Persist Updated Streaks

**File:** `backend/src/routes/checkins.js`

```js
habit.currentStreak = currentStreak;
habit.longestStreak = longestStreak;
await habit.save();
```

The denormalized streak values on the `Habit` document are updated. This is what makes dashboard loads O(1) — the streak is already computed and stored; no aggregation needed.

---

### Step 11: Response

```js
res.status(201).json({
  checkIn,  // the CheckIn document
  habit: {
    _id: habit._id,
    currentStreak: habit.currentStreak,
    longestStreak: habit.longestStreak,
  },
});
```

---

### Step 12: Frontend State Update (No Refetch)

**File:** `frontend/src/components/HabitCard.jsx` → `frontend/src/pages/Dashboard.jsx`

The `onCheckin(data.habit)` callback in `HabitCard` calls up to `Dashboard.handleCheckin`:

```js
const handleCheckin = (updatedHabit) => {
  setHabits((prev) =>
    prev.map((h) =>
      h._id === updatedHabit._id
        ? { ...h, currentStreak: updatedHabit.currentStreak, longestStreak: updatedHabit.longestStreak }
        : h
    )
  );
};
```

This surgically updates only the changed fields — no full habits refetch. React re-renders only the `HabitCard` whose `habit._id` matches.

---

## Mermaid Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant HCard as HabitCard.jsx
    participant AX as Axios Interceptor
    participant CORS as CORS / Morgan
    participant PM as protect middleware
    participant DB1 as MongoDB (User)
    participant CH as checkins.js handler
    participant DB2 as MongoDB (Habit + CheckIn)
    participant SF as calculateStreak()

    U->>HCard: Click "Done"
    HCard->>AX: api.post('/api/habits/:id/checkin', {status:'done'})
    AX->>AX: Read token from localStorage
    AX->>CORS: POST /api/habits/:id/checkin\nAuthorization: Bearer <token>
    CORS->>PM: pass (origin OK, body parsed)
    PM->>PM: jwt.verify(token, JWT_SECRET)
    PM->>DB1: User.findById(decoded.userId)
    DB1-->>PM: user doc (no password)
    PM->>CH: next() with req.user
    CH->>CH: toMidnightUTC(today)
    CH->>DB2: Habit.findOne({_id, userId}) — ownership check
    DB2-->>CH: habit doc
    CH->>DB2: CheckIn.findOneAndUpdate (upsert)
    DB2-->>CH: checkIn doc (new or updated)
    CH->>DB2: CheckIn.find({habitId}) — ALL check-ins
    DB2-->>CH: allCheckIns[]
    CH->>SF: calculateStreak({allCheckIns, ...})
    SF-->>CH: {currentStreak, longestStreak}
    CH->>DB2: habit.save() — persist denormalized streaks
    CH-->>AX: 201 { checkIn, habit: { currentStreak, longestStreak } }
    AX-->>HCard: resolved Promise
    HCard->>HCard: onCheckin(data.habit)
    HCard-->>U: Streak count updates in UI
```

---

## Edge Cases Handled

| Scenario | Handling |
|---|---|
| Checking in twice on the same day | Upsert overwrites; compound unique index prevents duplicate insert |
| Checking in with `status: "skipped"` | `calculateStreak` guards: if today not in `doneDays` set → `currentStreak = 0` |
| Back-dated check-in (optional `date` param) | Streak recomputed from scratch against all check-ins — always correct |
| Habit belongs to a different user | `Habit.findOne({ _id, userId })` returns null → 404 |
| JWT expired | `protect` catches `TokenExpiredError` → 401, Axios interceptor redirects to `/login` |
| Network failure | `HabitCard.handleCheckin` catch → `toast.error(...)`, button re-enabled |
| First check-in ever | `calculateStreak` returns `{ currentStreak: 1, longestStreak: 1 }` |
| Habit creation date guards | While loop stops at `cursor >= creationDay` — no false streak break before habit existed |
