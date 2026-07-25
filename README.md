# StreakUp — Social Habit Tracker

A full-stack social habit-tracking web app built with the MERN stack.  
Build daily habits, track streaks, view contribution heatmaps, and stay accountable by joining friend groups with leaderboards.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router v6, Zustand, Tailwind CSS v3, Recharts |
| Backend | Node.js + Express |
| Database | MongoDB (Atlas) via Mongoose |
| Auth | JWT (Bearer token in Authorization header) |
| Key libs | bcryptjs, date-fns, express-validator, nanoid |

---

## Project Structure

```
HabitTracker/
├── backend/          Express API
│   ├── src/
│   │   ├── models/   (User, Habit, CheckIn, Group)
│   │   ├── routes/   (auth, habits, checkins, groups, analytics)
│   │   ├── middleware/ (auth, errorHandler)
│   │   └── utils/calculateStreak.js  ← pure streak logic
│   └── tests/        Jest unit tests
└── frontend/         React app
    └── src/
        ├── pages/    (Login, Register, Dashboard, HabitDetail, Analytics, Groups, GroupDetail, Settings)
        ├── components/ (Sidebar, HabitCard, StatCard, Heatmap, Toast)
        ├── store/    authStore (Zustand)
        ├── api/      axios instance
        └── router/   ProtectedRoute
```

---

## Prerequisites

- **Node.js** v20+ (v20.16+ is fine)
- **MongoDB Atlas** free tier cluster — [Create one here →](https://www.mongodb.com/atlas/database)

> **Atlas setup:** Sign in → Create project → Build a Database → M0 Free → Add your IP to the allow-list → Get your connection string (`mongodb+srv://…`)

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url>
cd HabitTracker
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env — fill in MONGODB_URI and JWT_SECRET
npm install
npm run dev   # starts on port 5000
```

### 3. Frontend setup

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:5000  (default, no change needed for local dev)
npm install
npm run dev   # starts on port 5173
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (format below) |
| `JWT_SECRET` | Long random string — used to sign JWT tokens |
| `PORT` | Server port (default `5000`) |
| `CLIENT_ORIGIN` | Frontend origin for CORS (default `http://localhost:5173`) |

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/streakup?appName=<AppName>
JWT_SECRET=replace_with_long_random_secret
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
```

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (no trailing slash) |

```
VITE_API_URL=http://localhost:5000
```

---

## Running Tests

```bash
cd backend
npm test
```

Jest runs `tests/calculateStreak.test.js` — **14 tests** covering all streak edge cases (first check-in, streak continuation, breaks, idempotency, weekly habits).

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register + return JWT |
| POST | `/api/auth/login` | — | Login + return JWT |
| GET | `/api/auth/me` | ✓ | Get current user |
| PATCH | `/api/auth/profile` | ✓ | Update name/avatar |

### Habits
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/habits` | Create habit |
| GET | `/api/habits` | List active habits |
| GET | `/api/habits/:id` | Single habit |
| PATCH | `/api/habits/:id` | Edit / archive |
| DELETE | `/api/habits/:id` | Delete (cascades check-ins) |

### Check-ins
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/habits/:id/checkin` | Check in (done/skipped) — recalculates streak |
| GET | `/api/habits/:id/history` | History `?from=&to=` |

### Groups
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/groups` | Create group |
| POST | `/api/groups/join` | Join via invite code |
| GET | `/api/groups/:id` | Group + member stats |
| GET | `/api/groups/:id/leaderboard` | Ranked by 30-day completion % |
| POST | `/api/groups/:id/leave` | Leave group |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/summary` | 30-day overview |
| GET | `/api/analytics/heatmap/:habitId` | 365-day heatmap data |
| GET | `/api/analytics/completion-over-time` | Daily completion % (30 days) |

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| JWT storage | Authorization header (localStorage) | Avoids cross-domain cookie issues on Vercel + Render |
| Date normalisation | Midnight UTC | Reliable compound unique index; no DST drift |
| Weekly streak window | ISO calendar week (Mon–Sun) | Predictable UX; matches user mental model |
| Leaderboard scoring | 30-day completion % | Fair to new members; rewards consistency |
| Heatmap | Custom CSS Grid | No heavy library; full color control |
| State management | Zustand | Lightweight, simple API vs Context/Redux |

---

## Deployment

### Backend → Render
1. Push `/backend` to a GitHub repo
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set env vars: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (your Vercel URL)
4. Build command: `npm install` — Start command: `npm start`

### Frontend → Vercel
1. Push `/frontend` to GitHub
2. Import on [vercel.com](https://vercel.com)
3. Set `VITE_API_URL` to your Render backend URL
4. Deploy — Vercel auto-detects Vite

---

## License

MIT
