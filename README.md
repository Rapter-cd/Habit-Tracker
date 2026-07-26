# StreakUp — Social Habit Tracker

> A full-stack social habit-tracking web app built with the **MERN stack**.  
> Build daily or weekly habits, track streaks, visualize progress on a contribution heatmap, and stay accountable with friends through group leaderboards.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [How the Project Flows](#how-the-project-flows)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Key Features](#key-features)
7. [Design Decisions](#design-decisions)
8. [Quick Start](#quick-start)
9. [Environment Variables](#environment-variables)
10. [Running Tests](#running-tests)
11. [Deployment](#deployment)

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React (Vite) | Component-based SPA |
| Routing | React Router v6 | Client-side page navigation |
| State | Zustand | Lightweight global auth state |
| Styling | Tailwind CSS v3 | Utility-first responsive design |
| Charts | Recharts | Line chart for completion over time |
| HTTP Client | Axios | API calls + JWT interceptor |
| Backend | Node.js + Express | RESTful API server |
| Database | MongoDB Atlas (Mongoose) | Document storage |
| Auth | JWT (Bearer token) | Stateless authentication |
| Password | bcryptjs (12 salt rounds) | Secure password hashing |
| Validation | express-validator | Input validation middleware |
| Invite Codes | nanoid | Short unique group invite codes |
| Testing | Jest | Unit tests for streak logic |
| Deployment | Render (BE) + Vercel (FE) | Free-tier cloud hosting |

---

## Project Structure

```
HabitTracker/
│
├── backend/
│   ├── src/
│   │   ├── index.js              ← Express app entry point, middleware setup, DB connect
│   │   ├── models/
│   │   │   ├── User.js           ← User schema (auth, profile, group refs)
│   │   │   ├── Habit.js          ← Habit schema (streak values, frequency, soft-delete)
│   │   │   ├── CheckIn.js        ← CheckIn schema (compound unique index on habitId+date)
│   │   │   └── Group.js          ← Group schema (invite code, members array)
│   │   ├── routes/
│   │   │   ├── auth.js           ← Register, Login, /me, Profile update
│   │   │   ├── habits.js         ← CRUD for habits
│   │   │   ├── checkins.js       ← Check-in (upsert) + history retrieval
│   │   │   ├── groups.js         ← Create, join, leave groups; leaderboard
│   │   │   └── analytics.js      ← Summary stats, heatmap data, completion chart
│   │   ├── middleware/
│   │   │   ├── auth.js           ← JWT protect middleware (attaches req.user)
│   │   │   └── errorHandler.js   ← Global Express error handler
│   │   └── utils/
│   │       └── calculateStreak.js ← Pure streak calculation function (daily + weekly)
│   ├── tests/
│   │   └── calculateStreak.test.js ← 14 Jest unit tests for streak logic
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── main.jsx              ← React entry point
    │   ├── App.jsx               ← Router setup, ProtectedRoute wrapper, AppShell layout
    │   ├── api/
    │   │   └── axios.js          ← Axios instance with baseURL + Bearer token interceptor
    │   ├── store/
    │   │   └── authStore.js      ← Zustand store (user, token, login, logout, bootstrap)
    │   ├── router/
    │   │   └── ProtectedRoute.jsx ← Redirects unauthenticated users to /login
    │   ├── pages/
    │   │   ├── Landing.jsx       ← Public landing page
    │   │   ├── Login.jsx         ← Login form
    │   │   ├── Register.jsx      ← Registration form
    │   │   ├── Dashboard.jsx     ← Habit list + today's check-in buttons
    │   │   ├── HabitDetail.jsx   ← Single habit view with heatmap + history
    │   │   ├── Analytics.jsx     ← Summary stats + completion line chart
    │   │   ├── Groups.jsx        ← Group list, create group, join by invite code
    │   │   ├── GroupDetail.jsx   ← Group info + leaderboard
    │   │   └── Settings.jsx      ← Profile update (name, avatar URL)
    │   └── components/
    │       ├── Sidebar.jsx       ← Navigation sidebar
    │       ├── HabitCard.jsx     ← Habit card with streak + check-in button
    │       ├── StatCard.jsx      ← Reusable metric card
    │       ├── Heatmap.jsx       ← 365-day contribution heatmap (CSS Grid)
    │       └── Toast.js          ← Global notification system
    ├── package.json
    └── .env.example
```

---

## How the Project Flows

### 1. App Boot
```
Browser loads React SPA
  → App.jsx mounts → calls authStore.bootstrap()
  → Reads token from localStorage
  → Calls GET /api/auth/me with stored token
  → If valid: hydrates user state → show Dashboard
  → If invalid/expired: clears token → redirect to /login
```

### 2. Registration / Login
```
User fills form → POST /api/auth/register or /api/auth/login
  → express-validator checks inputs
  → (Register) Check if email already taken → 409 if yes
  → (Login)    Find user, run bcrypt.compare()
  → Server signs JWT: jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
  → Response: { token, user }
  → Frontend stores token in localStorage
  → Zustand authStore updates: { user, token }
  → React Router redirects to /dashboard
```

### 3. Authenticated Requests
```
Any API call (e.g., GET /api/habits)
  → Axios interceptor reads localStorage token
  → Adds header: Authorization: Bearer <token>
  → Express protect middleware:
      jwt.verify(token, JWT_SECRET)
      User.findById(decoded.userId)
      Attaches user to req.user
  → Route handler runs with verified user context
```

### 4. Creating & Checking In a Habit
```
User creates habit → POST /api/habits { name, frequency }
  → Habit document created with userId, streak = 0, archived = false

User clicks "Done" → POST /api/habits/:id/checkin { status: "done" }
  → Date normalized to midnight UTC (toMidnightUTC)
  → Ownership verified: Habit.findOne({ _id, userId: req.user._id })
  → CheckIn upserted (findOneAndUpdate + upsert:true)
      Compound index (habitId, date) enforces one check-in per day
  → ALL check-ins for this habit fetched
  → calculateStreak() called (pure function, no DB calls)
  → habit.currentStreak and habit.longestStreak updated + saved
  → Response: { checkIn, habit: { currentStreak, longestStreak } }
  → UI updates streak display on HabitCard
```

### 5. Streak Calculation Logic
```
Daily habits:
  Build Set<date> of all "done" days
  If today not in set → streak = 0
  Else → count = 1, walk backwards day-by-day while consecutive "done" days exist
  Stop at first gap OR at habit creation date (no false breaks before habit existed)
  longestStreak = max(prevLongest, currentStreak)   ← never decreases

Weekly habits:
  Group "done" check-ins by ISO calendar week (Mon–Sun)
  A week is "completed" if done count >= targetDaysPerWeek
  If current week not completed → streak = 0
  Else → count = 1, walk backwards week-by-week
  Stop at first non-completed week
  longestStreak = max(prevLongest, currentStreak)
```

### 6. Analytics
```
GET /api/analytics/summary
  → Fetch all active habits
  → Fetch all "done" check-ins in last 30 days
  → Per-habit: completionRate = done / expected * 100
  → Return: overallRate, bestHabit, worstHabit, totalActiveStreaks

GET /api/analytics/heatmap/:habitId
  → Fetch last 365 days of check-ins
  → Emit one record per calendar day: { date, status: "done"|"skipped"|null }
  → Frontend renders as CSS Grid (colored cells)

GET /api/analytics/completion-over-time
  → Fetch last 30 days of "done" check-ins
  → Group by date: { date → Set<habitId> }
  → For each day: rate = habits done that day / total active habits * 100
  → Returns array for Recharts line chart
```

### 7. Groups & Leaderboard
```
Create Group → POST /api/groups
  → Group created; nanoid(8) invite code auto-generated in pre('validate') hook
  → Creator added to group.members[] and user.groups[]

Join Group → POST /api/groups/join { inviteCode }
  → Find group by inviteCode
  → Idempotent: already a member → 200 OK (no error)
  → Add user to group.members and user.groups ($addToSet)

Leaderboard → GET /api/groups/:id/leaderboard
  → Verify requesting user is a member
  → For each member: computeScore()
      done check-ins (last 30d) / expected check-ins * 100
  → All scores computed in parallel (Promise.all)
  → Sort descending by score; alphabetical name as tiebreaker
  → Return ranked array with rank: 1, 2, 3...

Leave Group → POST /api/groups/:id/leave
  → Remove from group.members and user.groups
  → If creator leaves → ownership transfers to members[0]
  → If last member → group deleted entirely
```

---

## Database Schema

### User
```
{
  _id:       ObjectId
  name:      String   (required, max 60)
  email:     String   (required, unique, lowercase)
  password:  String   (bcrypt hash — excluded from queries by default via select:false)
  avatar:    String   (optional URL, no file uploads)
  groups:    [ObjectId → Group]
  createdAt, updatedAt
}

Hooks:
  pre('save')  → hash password with bcrypt(12) if modified
  method: comparePassword(plain) → bcrypt.compare()
```

### Habit
```
{
  _id:               ObjectId
  userId:            ObjectId → User  (indexed)
  name:              String   (required, max 100)
  category:          String   (default: 'General', max 40)
  frequency:         'daily' | 'weekly'  (not editable after creation)
  targetDaysPerWeek: Number   (1–7, only used when frequency === 'weekly')
  currentStreak:     Number   (denormalized — updated on every check-in)
  longestStreak:     Number   (denormalized — never decreases)
  archived:          Boolean  (soft-delete, default: false)
  createdAt, updatedAt
}
```

### CheckIn
```
{
  _id:      ObjectId
  habitId:  ObjectId → Habit  (indexed)
  userId:   ObjectId → User   (indexed)
  date:     Date  (stored as midnight UTC — never with time component)
  status:   'done' | 'skipped'
  note:     String  (optional, max 280 chars)
  createdAt, updatedAt
}

Indexes:
  { habitId: 1, date: 1 }  →  unique: true
  (Enforces one check-in per habit per calendar day)
```

### Group
```
{
  _id:         ObjectId
  name:        String   (required, max 80)
  description: String   (max 300)
  inviteCode:  String   (unique, 8-char nanoid — auto-generated in pre('validate'))
  createdBy:   ObjectId → User
  members:     [ObjectId → User]
  createdAt, updatedAt
}
```

---

## API Reference

### Auth

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | — | `{ name, email, password }` | Register new user, returns JWT |
| POST | `/api/auth/login` | — | `{ email, password }` | Login, returns JWT |
| GET | `/api/auth/me` | ✓ | — | Get current user profile |
| PATCH | `/api/auth/profile` | ✓ | `{ name?, avatar? }` | Update name or avatar URL |

---

### Habits

| Method | Endpoint | Auth | Body / Query | Description |
|---|---|---|---|---|
| POST | `/api/habits` | ✓ | `{ name, category?, frequency?, targetDaysPerWeek? }` | Create a new habit |
| GET | `/api/habits` | ✓ | `?includeArchived=true` | List habits (active by default) |
| GET | `/api/habits/:id` | ✓ | — | Get single habit |
| PATCH | `/api/habits/:id` | ✓ | `{ name?, category?, targetDaysPerWeek?, archived? }` | Edit or archive habit |
| DELETE | `/api/habits/:id` | ✓ | — | Hard-delete habit + all its check-ins |

---

### Check-ins

| Method | Endpoint | Auth | Body / Query | Description |
|---|---|---|---|---|
| POST | `/api/habits/:id/checkin` | ✓ | `{ status: "done"\|"skipped", date?: ISO, note?: string }` | Check in; recalculates streak (idempotent — upserts) |
| GET | `/api/habits/:id/history` | ✓ | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | Get check-in history for a date range |

---

### Groups

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/groups` | ✓ | `{ name, description? }` | Create group; auto-generates invite code |
| POST | `/api/groups/join` | ✓ | `{ inviteCode }` | Join group by invite code (idempotent) |
| GET | `/api/groups/:id` | ✓ | — | Group info + each member's streak stats |
| GET | `/api/groups/:id/leaderboard` | ✓ | — | Members ranked by 30-day completion % |
| POST | `/api/groups/:id/leave` | ✓ | — | Leave group; transfers ownership if creator |

---

### Analytics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/analytics/summary` | ✓ | 30-day stats: overall rate, best/worst habit, active streaks |
| GET | `/api/analytics/heatmap/:habitId` | ✓ | 365 daily records `{ date, status }` for heatmap component |
| GET | `/api/analytics/completion-over-time` | ✓ | Daily completion % over last 30 days (for line chart) |

---

### Health Check

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Returns `{ status: "ok", timestamp }` — used by Render |

---

## Key Features

### ✅ Habit Management
- Create habits with **daily** or **weekly** frequency.
- Set a `targetDaysPerWeek` (1–7) for weekly habits.
- **Soft-delete** (archive) hides a habit from the dashboard without losing history.
- **Hard-delete** cascades and removes all associated check-ins.

### 🔥 Streak Tracking
- **Daily streak**: consecutive days with a "done" check-in.
- **Weekly streak**: consecutive ISO calendar weeks (Mon–Sun) where `done ≥ targetDaysPerWeek`.
- `longestStreak` is denormalized on the Habit document — never decreases.
- Streak logic is a **pure function** (`calculateStreak.js`) — fully unit-tested with 14 Jest tests.

### 📅 Contribution Heatmap
- GitHub-style grid showing 365 days of check-in history.
- Color-coded cells: green = done, yellow = skipped, grey = no check-in.
- Built with CSS Grid — no heavy chart library.

### 📊 Analytics
- **Summary**: overall completion rate, best habit, worst habit, active streak count.
- **Line chart**: daily completion % over the last 30 days (Recharts).
- **Per-habit breakdown**: completion rate for each habit in the last 30 days.

### 👥 Social Groups
- Create accountability groups with auto-generated 8-character invite codes.
- Join any group by pasting an invite code.
- **Leaderboard** ranks members by 30-day completion % — fairer than raw streak counts.
- Ownership transfers automatically when the creator leaves.

### 🔒 Authentication
- JWT-based (7-day expiry) stored in localStorage.
- bcrypt password hashing (12 salt rounds).
- `protect` middleware verifies token on every protected route.
- Generic error message for wrong email/password → prevents user enumeration.

---

## Design Decisions

| Decision | Choice | Why |
|---|---|---|
| **JWT storage** | Authorization header (localStorage) | Avoids cross-domain cookie issues between Vercel frontend + Render backend |
| **Date storage** | Midnight UTC (`toMidnightUTC`) | Reliable compound unique index; no timezone/DST drift |
| **Streak values** | Denormalized on Habit document | Dashboard and leaderboard reads are O(1); no aggregation needed |
| **Weekly streak window** | ISO calendar week (Mon–Sun) | Predictable UX; matches user mental model of "this week" |
| **Leaderboard metric** | 30-day completion % | Fair to new members; rewards consistency over recency |
| **Heatmap rendering** | Custom CSS Grid | No heavy library; full color control; backend pre-formats all 365 records |
| **State management** | Zustand | Zero boilerplate vs Redux; selector-based subscriptions vs Context |
| **Streak function** | Pure function in `calculateStreak.js` | Testable in isolation; no DB/HTTP concerns mixed in |
| **Soft vs hard delete** | Both options exposed | Soft-delete preserves analytics history; hard-delete for real removal |
| **`frequency` immutable** | Not patchable after creation | Changing frequency makes existing streak history ambiguous |

---

## Quick Start

### Prerequisites
- **Node.js** v20+
- A **MongoDB Atlas** free tier cluster ([create one here](https://www.mongodb.com/atlas/database))

### 1. Clone & enter project

```bash
git clone <repo-url>
cd HabitTracker
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in MONGODB_URI and JWT_SECRET in .env
npm install
npm run dev          # starts on http://localhost:5000
```

### 3. Frontend setup

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:5000  (no change needed for local dev)
npm install
npm run dev          # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

### Backend (`backend/.env`)

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/streakup
JWT_SECRET=replace_with_a_long_random_string
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
```

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string used to sign JWT tokens |
| `PORT` | Server port (default `5000`) |
| `CLIENT_ORIGIN` | Frontend URL for CORS (default `http://localhost:5173`) |

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
```

---

## Running Tests

```bash
cd backend
npm test
```

Jest runs `tests/calculateStreak.test.js` — **14 unit tests** covering all streak edge cases:

| # | Test Case |
|---|---|
| 1 | First check-in ever → streak = 1 |
| 2 | Yesterday was done → streak increments |
| 3 | 7-day consecutive streak → streak = 7 |
| 4 | One-day gap breaks streak → resets to 1 |
| 5 | `longestStreak` not decreased after a break |
| 6 | Same-day check-in twice → same result (idempotent) |
| 7 | No false break before habit creation date |
| 8 | "skipped" day breaks daily streak |
| 9 | Today's status is "skipped" → streak = 0 |
| 10 | Current week hits weekly target → streak = 1 |
| 11 | Two consecutive completed weeks → streak = 2 |
| 12 | Previous week missed target → streak = 1, not 2 |
| 13 | Current week below target → streak = 0 |
| 14 | Weekly `longestStreak` preserved after break |

---

## Deployment

### Backend → Render

1. Push `backend/` to a GitHub repository.
2. Create a **Web Service** on [render.com](https://render.com).
3. Set environment variables: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (your Vercel URL).
4. Build command: `npm install` | Start command: `node src/index.js`

### Frontend → Vercel

1. Push `frontend/` to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. Set `VITE_API_URL` to your Render backend URL.
4. Deploy — Vercel auto-detects Vite.

> The `vercel.json` in the frontend rewrites all routes to `index.html` so React Router handles client-side navigation correctly.

---

## License

MIT
