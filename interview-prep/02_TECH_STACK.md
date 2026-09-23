# 02 — Tech Stack

Every technology listed here is in use in the actual codebase. For each one: what it is, why it was specifically chosen here, where it lives, what was rejected, and the likely interview question.

---

## Backend

---

### Node.js + Express

**What it is:**
Node.js is a JavaScript runtime that executes JS outside the browser, using a non-blocking event loop. Express is a minimal web framework on top of Node that gives you route registration, middleware chaining, and request/response handling.

**Why I used it here:**
The team chose JavaScript end-to-end so the same language runs on both sides. Express's unopinionated nature meant I could structure the project exactly how I wanted — separate route files per resource, a custom middleware layer, and a centralized error handler. For a REST API serving JSON, Express has zero boilerplate.

**Where it lives:**
- `backend/src/index.js` — app creation, middleware stack, route mounting, DB connect, server start
- `backend/src/routes/` — all route handlers (auth, habits, checkins, groups, analytics)

**Alternatives I could have used:**
1. **NestJS** — too heavy and opinionated for a project this size; decorator-heavy syntax adds ceremony without benefit.
2. **Fastify** — a legitimate alternative (faster than Express for raw throughput), but Express has wider ecosystem familiarity and the performance difference is irrelevant at this scale.

**Likely interview question:**
> "Why Express over a more structured framework like NestJS?"

*"NestJS is excellent for large teams that need enforced architecture, but for a solo project this size, its decorators and DI container add overhead that doesn't pay off. Express lets me demonstrate that I understand the structure myself — I implemented the same separation of concerns (routes, models, middleware, utils) manually, which shows architectural thinking rather than relying on a framework to enforce it."*

---

### MongoDB + Mongoose

**What it is:**
MongoDB is a document database that stores JSON-like BSON records. Mongoose is an ODM (Object Document Mapper) for MongoDB in Node — it adds schemas, validation, hooks, and query building on top of the native driver.

**Why I used it here:**
Habit data is naturally hierarchical and schema-flexible — a daily habit has different meaningful fields than a weekly one (`targetDaysPerWeek` only matters for weekly). A document model fits this better than forcing everything into relational tables. Additionally, MongoDB Atlas's free M0 tier is sufficient for this project's scale, making deployment cost zero.

**Where it lives:**
- `backend/src/models/` — all four Mongoose schemas (User, Habit, CheckIn, Group)
- Connection: `backend/src/index.js` lines 54-63 (`mongoose.connect(process.env.MONGODB_URI)`)

**Key schema design decisions:**
- `password: { select: false }` on User — the field is never returned by a query unless explicitly `.select('+password')`, preventing accidental password exposure
- `{ habitId: 1, date: 1 }, { unique: true }` on CheckIn — compound index enforces one check-in per habit per day at the database level
- `currentStreak` + `longestStreak` denormalized on Habit — avoids aggregation queries on every dashboard load

**Alternatives I could have used:**
1. **PostgreSQL** — better for relational queries and transactions, but adds more setup complexity. The CheckIn compound unique index is something both support, but Mongoose's schema-level validation was faster to build with.
2. **Prisma + PostgreSQL** — a popular modern choice, but ORMs hide the query layer, which makes it harder to explain decisions in an interview. Using Mongoose I can speak to every query precisely.

**Likely interview question:**
> "Why MongoDB over a relational database?"

*"The data model fit naturally — habits are user-owned documents with variable fields depending on frequency, and check-ins are append-only records with a compound index for idempotency. I didn't need multi-table JOINs or transactions, which are PostgreSQL's strengths. MongoDB's flexible schema also let me iterate quickly on the Group model without migrations. That said, I'm aware the tradeoff is no foreign key constraints, so I handle referential integrity manually — for example, deleting all CheckIns when a Habit is hard-deleted in the route handler."*

---

### JSON Web Tokens (jsonwebtoken)

**What it is:**
JWT is a stateless authentication standard. The server signs a token with a secret key; the client sends it back on every request. The server can verify the signature without any database lookup or session store.

**Why I used it here:**
The frontend (Vercel) and backend (Render) are on different domains. Cookie-based sessions would require `SameSite=None; Secure` and `Access-Control-Allow-Credentials`, which is tricky to configure correctly across providers. Sending the token in the `Authorization: Bearer` header is simpler and works cross-domain without cookie gymnastics.

**Where it lives:**
- `backend/src/routes/auth.js` — `signToken()` signs on login/register; 7-day expiry
- `backend/src/middleware/auth.js` — `protect()` verifies and decodes on every protected request
- `frontend/src/api/axios.js` — request interceptor reads from `localStorage` and injects header
- `frontend/src/store/authStore.js` — stores token in `localStorage` under key `streakup_token`

**Alternatives I could have used:**
1. **HttpOnly cookies + sessions** — more secure against XSS (token not accessible to JS), but requires same-origin or complex CORS cookie configuration not worth the complexity for a cross-domain deploy.
2. **Passport.js** — a middleware library that handles many auth strategies, but adds abstraction over JWT that obscures how auth works; I can explain every line of my current implementation.

**Likely interview question:**
> "JWT in localStorage is vulnerable to XSS — why did you choose it over HttpOnly cookies?"

*"That's a valid concern. The practical tradeoff here was cross-domain deployment: the frontend is on Vercel and the backend on Render. HttpOnly cookies require SameSite=None and Secure, plus Access-Control-Allow-Credentials on every preflight — error-prone to configure across two free-tier providers. In a production system with a same-domain architecture or a BFF proxy, I'd use HttpOnly cookies. Here, I mitigated XSS risk by not storing sensitive data in the token — the JWT payload only contains `{ userId }`, so if leaked, the worst case is impersonation until the 7-day expiry."*

---

### bcryptjs

**What it is:**
bcrypt is a password hashing algorithm designed to be deliberately slow — it has a configurable "cost factor" (salt rounds) that makes brute-force attacks computationally expensive.

**Why I used it here:**
You never store plaintext passwords. bcryptjs is the standard Node.js library for this. I chose 12 salt rounds — 10 is the common default, 12 is one step slower (~250ms vs ~100ms on modern hardware), which is imperceptible to users but significantly harder to brute-force at scale.

**Where it lives:**
- `backend/src/models/User.js` — pre-save hook (`bcrypt.genSalt(12)` + `bcrypt.hash()`)
- `backend/src/models/User.js` — `comparePassword()` instance method used at login

**Alternatives I could have used:**
1. **Argon2** — the OWASP-recommended algorithm as of 2023; stronger than bcrypt. `bcryptjs` was chosen because it's pure JavaScript (no native bindings), which simplifies deployment in Render's Node environment.

---

### express-validator

**What it is:**
A validation middleware library for Express that lets you declare input rules declaratively using a chainable API, then call `validationResult(req)` to collect errors.

**Why I used it here:**
Input validation must happen before any database operation. `express-validator` keeps the validation rules co-located with the route declaration (easy to read), and the custom `validate()` helper in each route file extracts errors uniformly and returns early with a 400.

**Where it lives:**
- Every route file uses it: `backend/src/routes/auth.js`, `habits.js`, `checkins.js`, `groups.js`
- Pattern: `[body('field').isX().withMessage('...')]` array passed as middleware array before the async handler

**Alternatives I could have used:**
1. **Joi / Zod** — schema-first validation libraries. Zod in particular has excellent TypeScript integration, but this backend is CommonJS and the express-validator pattern integrates directly into Express's middleware array without extra wrapping.

---

### nanoid

**What it is:**
A tiny library for generating short, URL-safe unique IDs. Much smaller collision space than UUID, but sized appropriately for the use case.

**Why I used it here:**
Group invite codes need to be short enough to type manually and share via text — `nanoid(8)` gives 8 alphanumeric characters (~40 bits of entropy, ~1.7 trillion combinations). For invite codes, this is sufficient; brute-forcing would require millions of requests which would be rate-limited.

**Where it lives:**
- `backend/src/models/Group.js` — pre-validate hook generates the code if none set: `this.inviteCode = nanoid(8)`

**⚠️ Needs clarification:**
The nanoid version is pinned to `^3.3.7` (CommonJS). nanoid v4+ is ESM-only, which would break this CommonJS backend. This was a deliberate choice, not an oversight.

---

### Morgan

**What it is:**
HTTP request logger middleware for Express. Logs method, URL, status code, and response time to stdout.

**Why I used it here:**
Development convenience — every request is logged in the terminal in `dev` format, making it trivial to trace what the frontend is calling. On Render, stdout logs are captured and visible in the dashboard.

**Where it lives:**
- `backend/src/index.js` line 26: `app.use(morgan('dev'))`

---

### date-fns (backend)

**What it is:**
A utility library for date manipulation. Modular (import only what you use), immutable, and timezone-aware.

**Why I used it here:**
The backend uses `date-fns` for date arithmetic in the `toMidnightUTC` and `daysAgo` helpers inside `calculateStreak.js`. However, looking at the actual code, `toMidnightUTC` is implemented with vanilla `Date` methods (`setUTCHours(0,0,0,0)`), and `daysAgo` uses raw milliseconds (`n * 86_400_000`). The `date-fns` package is listed in `package.json` but the streak utility doesn't import it.

**⚠️ Needs clarification:** `date-fns` appears in `backend/package.json` as a dependency but the core utility (`calculateStreak.js`) does not import it. It may be a leftover dependency from an earlier iteration, or it may be used in a route file via an indirect import. Before the interview, verify with `grep -r "date-fns" backend/src/` to confirm or remove it.

---

### Jest + supertest

**What it is:**
Jest is a JavaScript testing framework with built-in assertion, mocking, and test runner. Supertest is an HTTP assertion library for testing Express apps without spinning up a real server.

**Why I used it here:**
The streak calculation logic (`calculateStreak.js`) is the most complex and most important function in the codebase — a bug there corrupts every user's streak display. Isolating it as a pure function and testing it with Jest means I can run `npm test` in under a second and be confident the core logic is correct.

**Where it lives:**
- `backend/tests/calculateStreak.test.js` — 14 tests in two `describe` blocks (daily and weekly)
- `backend/package.json` — Jest config: `testEnvironment: "node"`, `testMatch: ["**/tests/**/*.test.js"]`

**⚠️ Needs clarification:** `supertest` is in `devDependencies` but no integration tests using it are present. The comment in `index.js` (`// exported for supertest in Phase 3`) suggests integration tests were planned but not implemented. Be prepared to discuss this gap.

---

## Frontend

---

### React 18 + Vite

**What it is:**
React is a component-based UI library that uses a virtual DOM to efficiently update the browser. Vite is a build tool that uses native ES modules for development (no bundling step) and Rollup for production builds — dramatically faster than webpack-based Create React App.

**Why I used it here:**
React is the industry standard for component-based SPAs. Vite was chosen over Create React App because CRA is officially deprecated and Vite's HMR (hot module replacement) is nearly instant — critical for tight development iteration on UI components.

**Where it lives:**
- `frontend/index.html` — Vite entry point, mounts `<div id="root">`
- `frontend/src/main.jsx` — `ReactDOM.createRoot()`
- `frontend/vite.config.js` — Vite configuration

**Alternatives I could have used:**
1. **Create React App** — deprecated; Vite is the modern replacement.
2. **Next.js** — would add SSR complexity unnecessarily; this app doesn't need SEO on authenticated pages. A pure SPA is the right choice here.

---

### React Router v7

**What it is:**
The standard routing library for React SPAs. Maps URL paths to components, handles navigation, and provides hooks like `useParams`, `useNavigate`, and `useLocation`.

**Why I used it here:**
The app has 9 pages (landing, login, register, dashboard, habit detail, analytics, groups, group detail, settings). React Router v7 handles client-side navigation between them without full page reloads.

**Where it lives:**
- `frontend/src/App.jsx` — `<BrowserRouter>`, `<Routes>`, `<Route>` declarations; `AppShell` layout for authenticated routes; `<ProtectedRoute>` wrapper
- `frontend/vercel.json` — rewrites all routes to `index.html` (necessary for React Router on Vercel — without this, refreshing `/dashboard` would 404)

**Key pattern:**
Nested routes with a layout component (`AppShell` with sidebar) — all authenticated routes are children of a layout route that wraps them in `<Sidebar>` + `<main>`. This avoids duplicating the sidebar in every page component.

---

### Zustand

**What it is:**
A minimal state management library for React. You define a store as a plain object with state + actions; components subscribe to specific slices using selector functions. No providers, no reducers, no action creators.

**Why I used it here:**
Auth state (user, token, loading) needs to be accessible in the Axios interceptor, in `ProtectedRoute`, in the `Sidebar`, and on every page. React Context would work but causes unnecessary re-renders when any part of the context changes. Zustand's selector-based subscriptions mean each component only re-renders when exactly the slice it uses changes.

**Where it lives:**
- `frontend/src/store/authStore.js` — the entire auth store: `{ user, token, loading, bootstrap, login, register, logout, setUser }`

**Alternatives I could have used:**
1. **Redux Toolkit** — massive overkill for a single-store app with 5 actions. Redux adds 3 files per feature (slice, selector, action) vs. Zustand's single file.
2. **React Context + useReducer** — zero dependencies, but suffers from the "prop drilling to context" problem and causes top-level re-renders.

**Likely interview question:**
> "Why Zustand instead of Redux?"

*"Redux Toolkit is excellent when you need time-travel debugging, complex reducers, or middleware like redux-saga. In this app, auth is the only global state — a single object with 5 actions. Zustand handles this in under 60 lines with zero boilerplate, and selector-based subscriptions give me fine-grained re-render control that Context doesn't. It's the right tool for this scope."*

---

### Tailwind CSS v3

**What it is:**
A utility-first CSS framework that generates single-purpose classes (`flex`, `text-zinc-100`, `rounded-xl`). Instead of writing CSS files, you compose styles directly in markup.

**Why I used it here:**
Tailwind enables extremely fast UI iteration — no context-switching between JSX and CSS files, no naming classes. The design system is built on Tailwind's design tokens (color scales, spacing, etc.) with a few custom CSS classes for repeated patterns (`.card`, `.btn`, `.badge`, `.input`, `.skeleton`) defined in `frontend/src/index.css`.

**Where it lives:**
- `frontend/tailwind.config.js` — theme config (custom colors, fonts, animations)
- `frontend/src/index.css` — global base styles + custom component classes
- All `.jsx` files — utility classes in `className` props

**Alternatives I could have used:**
1. **CSS Modules** — better scoping, but more files and slower iteration for a solo project.
2. **styled-components** — runtime CSS-in-JS; adds JS bundle weight and loses Tailwind's purging efficiency.

---

### Axios

**What it is:**
An HTTP client for JavaScript with a Promise-based API. Supports interceptors (middleware for requests and responses), automatic JSON serialization, and better error handling than native `fetch`.

**Why I used it here:**
The key feature I needed was **request interceptors** — every API call needs the `Authorization: Bearer <token>` header. With Axios, I set this once in the interceptor (`frontend/src/api/axios.js`), and all 9 pages that call the API get it automatically. I also use the **response interceptor** to redirect to `/login` on any 401 response — keeping session expiry handling in one place.

**Where it lives:**
- `frontend/src/api/axios.js` — Axios instance with baseURL, request interceptor (inject token), response interceptor (401 redirect)
- Every page imports `api` from this file

**Alternatives I could have used:**
1. **Native fetch** — no interceptors without wrapping in a custom function. Doable, but more verbose.
2. **React Query / TanStack Query** — would add server-state caching and stale-while-revalidate, which would be a genuine upgrade for this project (avoid redundant refetches). This is a known gap — see `06_CHALLENGES_AND_TRADEOFFS.md`.

---

### Recharts

**What it is:**
A React charting library built on SVG + D3. Components like `<LineChart>`, `<BarChart>`, `<XAxis>`, etc. wrap D3 calculations into React-friendly components.

**Why I used it here:**
The analytics page needs two charts: a line chart (daily completion % over 30 days) and a bar chart (per-habit completion rates). Recharts integrates directly into JSX with `<ResponsiveContainer>` for responsive sizing — no separate chart initialization code or refs required.

**Where it lives:**
- `frontend/src/pages/Analytics.jsx` — LineChart for timeline, BarChart for per-habit breakdown

**Alternatives I could have used:**
1. **Chart.js + react-chartjs-2** — larger bundle, imperative API via `ref` and `update()`. Recharts is more React-idiomatic.
2. **Victory** — similar to Recharts; either would work. Recharts has slightly more GitHub stars and better TypeScript support.

---

### Lucide React

**What it is:**
A library of open-source SVG icons as React components. Each icon is a named export like `<Flame />`, `<CheckCircle2 />`, `<Plus />`.

**Why I used it here:**
UI icons are used throughout (streak flame, check circle, sidebar navigation icons). Lucide is tree-shakeable — only imported icons end up in the bundle. It's also the modern replacement for `react-feather` (Lucide is a community-maintained fork).

**Where it lives:**
- Used in: `Dashboard.jsx`, `HabitCard.jsx`, `StatCard.jsx`, `Sidebar.jsx`, and most other page components

---

## Infrastructure / Deployment

---

### Render (backend hosting)

**What it is:**
A cloud platform with a free tier for Node.js web services. Automatically deploys from GitHub on push.

**Why I used it here:**
Free tier, GitHub integration, automatic TLS, and environment variable management via dashboard. The `render.yaml` in the repo root defines the service declaratively (IaC-lite) and auto-generates `JWT_SECRET` using `generateValue: true`.

**Note:** Render free tier services spin down after 15 minutes of inactivity. The `/api/health` endpoint is used by Render's own health checks to keep the service alive (or for uptime monitoring if added).

---

### Vercel (frontend hosting)

**What it is:**
A cloud platform optimized for frontend frameworks. Detects Vite automatically, runs `npm run build`, serves `dist/` from a global CDN.

**Why I used it here:**
Zero-config Vite deployment. The `vercel.json` rewrite rule is the only custom config needed — it ensures all routes (e.g., `/dashboard`) serve `index.html` so React Router can handle client-side navigation after a hard refresh.

---

### MongoDB Atlas

**What it is:**
MongoDB's managed cloud database service. The M0 (free) tier provides 512MB storage, shared cluster.

**Why I used it here:**
No infrastructure to manage — connection string in env var, indexes created automatically by Mongoose on first run. For a production upgrade, Atlas's M10 dedicated cluster provides dedicated RAM and up to 10GB storage.
