# StreakUp — Interview Prep Index

## 30-Second Elevator Pitch

> "StreakUp is a full-stack social habit tracker built on the MERN stack. Users create daily or weekly habits, check in each day to build streaks, and compete with friends on accountability leaderboards. The backend is a Node.js/Express REST API backed by MongoDB Atlas, deployed on Render. The frontend is a React SPA built with Vite and deployed on Vercel. The core technical challenge I solved was designing a timezone-safe streak calculation algorithm that works correctly for both daily and weekly habits — isolated as a pure function with 14 unit tests."

---

## Files in This Folder

| File | What It Covers |
|---|---|
| [00_INDEX.md](./00_INDEX.md) | This file — overview + table of contents |
| [01_ARCHITECTURE.md](./01_ARCHITECTURE.md) | System design, component map, Mermaid diagrams |
| [02_TECH_STACK.md](./02_TECH_STACK.md) | Every technology, why it was chosen, alternatives rejected |
| [03_DATA_FLOW.md](./03_DATA_FLOW.md) | End-to-end trace of a check-in request (whiteboard walkthrough) |
| [05_KEY_FEATURES.md](./05_KEY_FEATURES.md) | Feature-by-feature audit: what works, what's partial, what's missing |
| [06_CHALLENGES_AND_TRADEOFFS.md](./06_CHALLENGES_AND_TRADEOFFS.md) | Hard problems solved, decisions rejected, honest gaps |
| [07_INTERVIEW_QA.md](./07_INTERVIEW_QA.md) | 18 interview questions with model answers grounded in the actual code |

---

## Project at a Glance

| Attribute | Value |
|---|---|
| **App name** | StreakUp |
| **Type** | Full-stack MERN web application |
| **Frontend** | React 18 + Vite, Tailwind CSS v3, Zustand, Recharts |
| **Backend** | Node.js 20 + Express 4, Mongoose 8, JWT auth |
| **Database** | MongoDB Atlas (M0 free tier) |
| **Testing** | Jest — 14 unit tests for streak logic |
| **Deployment** | Render (backend) + Vercel (frontend) |
| **Core models** | User, Habit, CheckIn, Group |
| **Routes** | `/api/auth`, `/api/habits`, `/api/habits/:id/checkin`, `/api/groups`, `/api/analytics` |
| **Key differentiator** | Timezone-safe streak calculation isolated as a pure, fully-tested function |

---

## How to Use These Docs Before an Interview

1. **Read `01_ARCHITECTURE.md` first** — internalize the system diagram so you can draw it on a whiteboard.
2. **Drill `03_DATA_FLOW.md`** — practice narrating the check-in flow out loud, step by step.
3. **Memorize the entries in `02_TECH_STACK.md`** — every "why did you choose X over Y?" is answered there.
4. **Review `06_CHALLENGES_AND_TRADEOFFS.md`** — this is what separates candidates who built the project from those who just described it.
5. **Run `07_INTERVIEW_QA.md` flashcard-style** — cover the answer column and try to answer from memory.
