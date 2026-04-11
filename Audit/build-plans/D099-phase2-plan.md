# RSS Platform Phase 2 — SWA + Managed Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working SWA platform that gives Proudfoot salespeople a branded coaching interface connected to the RSS Managed Agent, with persistent coaching history, development tracking, and Situational Matrix visualization.

**Architecture:** React 19 + Vite + TypeScript + Tailwind v4 frontend served by Azure Static Web Apps. Azure Functions v4 backend proxies coaching conversations to the Claude Managed Agent (session create/poll/extract pattern from Imerys), persists coaching data in Azure SQL, and provides CRUD endpoints for development profiles, session history, and matrix positions. Azure AD authentication via SWA built-in auth.

**Tech Stack:** React 19, Vite 6, TypeScript 5.7, Tailwind CSS v4, Azure Functions v4 (Node 20), Azure SQL (mssql driver with pooling), Anthropic SDK (@anthropic-ai/sdk), Zustand for client state, Playwright for E2E tests.

**Directive:** D099 (CTO directive, 2026-04-11)

**Reference architectures:** BVCA Platform (SWA patterns), Imerys Diagnostic Toolkit (managed-agent.ts)

---

## Scope Check

This plan covers a single integrated system (coaching SWA). The frontend, backend, and database are tightly coupled and cannot be meaningfully split into independent sub-project plans. The managed-agent integration is a backend concern consumed by the frontend chat panel — not an independent subsystem.

---

## File Structure

All new files for Phase 2. Phase 1 files (methodology/, skills/, agent/) are untouched.

```
rss-platform/
├── package.json                          # Root workspace config (type: module, scripts)
├── tsconfig.json                         # Root project references (app + api)
├── tsconfig.app.json                     # Frontend TypeScript config
├── tsconfig.node.json                    # Vite/Node TypeScript config (composite: true)
├── vite.config.ts                        # Vite config with proxy for /api
├── tailwind.config.ts                    # Tailwind v4 config
├── postcss.config.js                     # PostCSS with Tailwind
├── index.html                            # Vite entry HTML
│
├── public/
│   └── staticwebapp.config.json          # SWA routes, auth, navigation fallback
│
├── src/                                  # React 19 frontend
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # Root component with router
│   ├── index.css                         # Tailwind imports + global styles
│   ├── vite-env.d.ts                     # Vite type declarations
│   │
│   ├── lib/
│   │   ├── api.ts                        # apiFetch + apiFetchWithTimeout helpers
│   │   ├── auth.ts                       # SWA auth client (/.auth/me)
│   │   └── store.ts                      # Zustand stores (auth, sessions, profile)
│   │
│   ├── components/
│   │   ├── Layout.tsx                    # App shell: sidebar nav + main content area
│   │   ├── ChatMessage.tsx               # Single chat message bubble (user/assistant)
│   │   ├── ChatInput.tsx                 # Message input with send button
│   │   ├── ModeSelector.tsx              # Coaching mode selector (pre-call/post-call/dev-review)
│   │   ├── UnitBadge.tsx                 # RSS unit badge (Unit 1-5 with colour coding)
│   │   ├── ScoreBar.tsx                  # Horizontal competency score bar (1-6 scale)
│   │   ├── TrendIndicator.tsx            # Trend arrow (improving/plateauing/declining)
│   │   ├── QuadrantLabel.tsx             # Situational Matrix quadrant label (Q1-Q4)
│   │   └── LoadingSpinner.tsx            # Shared loading spinner
│   │
│   ├── screens/
│   │   ├── coaching/
│   │   │   └── CoachingScreen.tsx        # Chat panel with mode selection + streaming responses
│   │   ├── matrix/
│   │   │   └── MatrixScreen.tsx          # Situational Matrix 4-quadrant interactive grid
│   │   ├── dashboard/
│   │   │   └── DashboardScreen.tsx       # Development dashboard with trend charts
│   │   └── history/
│   │       └── HistoryScreen.tsx         # Coaching session history browser
│   │
│   └── types/
│       └── index.ts                      # Shared TypeScript types (Session, Profile, MatrixPosition, etc.)
│
├── api/
│   ├── package.json                      # API dependencies (@azure/functions, mssql, @anthropic-ai/sdk)
│   ├── tsconfig.json                     # API TypeScript config (target ES2022, module Node16)
│   ├── host.json                         # Azure Functions host config
│   ├── local.settings.json               # Local dev settings (gitignored)
│   │
│   ├── src/
│   │   ├── functions/
│   │   │   ├── health.ts                 # GET /api/health — liveness check
│   │   │   ├── sessions.ts               # POST /api/sessions, GET /api/sessions, GET /api/sessions/{id}
│   │   │   ├── messages.ts               # POST /api/sessions/{id}/messages — send message to agent
│   │   │   ├── jobs.ts                   # GET /api/jobs/{jobId} — poll async job status
│   │   │   ├── profile.ts               # GET /api/profile, PUT /api/profile/focus-unit
│   │   │   ├── observations.ts           # GET /api/profile/observations
│   │   │   ├── trends.ts                # GET /api/profile/trends — trend data for dashboard
│   │   │   └── matrix.ts                # GET /api/matrix/positions — matrix position history
│   │   │
│   │   └── lib/
│   │       ├── auth.ts                   # SWA ClientPrincipal extraction from x-ms-client-principal
│   │       ├── db.ts                     # Azure SQL connection pooling (mssql), prod/preview routing
│   │       ├── jobs.ts                   # Async job queue: submitJob, getJob, completeJob, failJob
│   │       └── managed-agent.ts          # Managed Agent integration (adapted from Imerys)
│   │
│   └── .funcignore                       # Azure Functions ignore file
│
├── database/
│   └── 001-initial-schema.sql            # All tables: salesperson_profiles, coaching_sessions, etc.
│
└── e2e/
    ├── tsconfig.json                     # Playwright TypeScript config
    ├── playwright.config.ts              # Playwright config
    └── tests/
        ├── coaching.spec.ts              # Coaching chat E2E tests
        ├── dashboard.spec.ts             # Dashboard E2E tests
        └── auth.spec.ts                  # Auth flow E2E tests
```

**Total new files:** ~45
**Phase 1 files untouched:** 21 (methodology/, skills/, agent/, tests/, docs/)

---

## Phase A: Scaffold (Tasks 1-5)

### Task 1: Root Package and TypeScript Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "rss-platform",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "cd api && npm ci && cd .. && tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@playwright/test": "^1.49.0"
  }
}
```

- [ ] **Step 2: Create root tsconfig.json (project references)**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./api/tsconfig.json" }
  ]
}
```

- [ ] **Step 3: Create tsconfig.app.json (frontend)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "composite": true,
    "outDir": "./dist/app-types",
    "declarationDir": "./dist/app-types",
    "tsBuildInfoFile": "./dist/app-types/.tsbuildinfo"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create tsconfig.node.json (Vite config)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "composite": true,
    "outDir": "./dist/node-types",
    "declarationDir": "./dist/node-types",
    "tsBuildInfoFile": "./dist/node-types/.tsbuildinfo",
    "skipLibCheck": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Run `npm install` and verify `tsc -b` compiles cleanly**

Run: `npm install && npx tsc -b --dry`
Expected: No errors (no source files yet, but config validates)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json
git commit -m "scaffold: root package.json and TypeScript project references"
```

---

### Task 2: Vite, Tailwind, and Frontend Entry Files

**Files:**
- Create: `vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 2: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        proudfoot: {
          navy: '#1a2744',
          blue: '#2563eb',
          gold: '#d4a843',
          slate: '#334155',
        },
      },
    },
  },
} satisfies Config
```

- [ ] **Step 3: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Proudfoot RSS Coach</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 6: Create src/index.css**

```css
@import 'tailwindcss';
```

- [ ] **Step 7: Create src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 8: Create src/App.tsx (minimal shell)**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/coaching" replace />} />
      <Route path="/coaching" element={<div>Coaching (placeholder)</div>} />
      <Route path="/matrix" element={<div>Matrix (placeholder)</div>} />
      <Route path="/dashboard" element={<div>Dashboard (placeholder)</div>} />
      <Route path="/history" element={<div>History (placeholder)</div>} />
    </Routes>
  )
}
```

- [ ] **Step 9: Verify dev server starts**

Run: `npx vite --host 127.0.0.1 &` then `curl -s http://127.0.0.1:5173/ | head -5`
Expected: HTML with `<div id="root">` rendered

- [ ] **Step 10: Commit**

```bash
git add vite.config.ts tailwind.config.ts postcss.config.js index.html src/
git commit -m "scaffold: Vite, Tailwind v4, React entry with router"
```

---

### Task 3: API Scaffold (Azure Functions)

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/host.json`
- Create: `api/.funcignore`
- Create: `api/src/functions/health.ts`

- [ ] **Step 1: Create api/package.json**

```json
{
  "name": "rss-platform-api",
  "private": true,
  "main": "dist/src/functions/*.js",
  "scripts": {
    "build": "tsc",
    "start": "func start --typescript"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.87.0",
    "@azure/functions": "^4.6.0",
    "mssql": "^11.0.0",
    "uuid": "^11.0.0"
  },
  "devDependencies": {
    "@types/mssql": "^9.1.0",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true,
    "declarationDir": "dist",
    "tsBuildInfoFile": "dist/.tsbuildinfo",
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create api/host.json**

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

- [ ] **Step 4: Create api/.funcignore**

```
*.ts
tsconfig.json
node_modules
local.settings.json
```

- [ ] **Step 5: Create api/src/functions/health.ts**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'

async function healthHandler(_req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      status: 'healthy',
      version: '2.0.0',
      phase: 2,
      timestamp: new Date().toISOString(),
    },
  }
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler,
})
```

- [ ] **Step 6: Install API dependencies and verify build**

Run: `cd api && npm install && npx tsc && cd ..`
Expected: Compiles to `api/dist/` with no errors

- [ ] **Step 7: Commit**

```bash
git add api/package.json api/package-lock.json api/tsconfig.json api/host.json api/.funcignore api/src/
git commit -m "scaffold: Azure Functions API with health endpoint"
```

---

### Task 4: SWA Configuration

**Files:**
- Create: `public/staticwebapp.config.json`

- [ ] **Step 1: Create public/staticwebapp.config.json**

```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/{TENANT_ID}/v2.0",
          "clientIdSettingName": "AZURE_CLIENT_ID",
          "clientSecretSettingName": "AZURE_CLIENT_SECRET"
        }
      }
    }
  },
  "routes": [
    {
      "route": "/.auth/*",
      "allowedRoles": ["anonymous", "authenticated"]
    },
    {
      "route": "/api/health",
      "allowedRoles": ["anonymous", "authenticated"]
    },
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/",
      "allowedRoles": ["authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "statusCode": 302,
      "redirect": "/.auth/login/aad"
    }
  },
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/.auth/*", "/*.{css,js,svg,png,ico,woff,woff2}"]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/staticwebapp.config.json
git commit -m "scaffold: SWA config with AAD auth and route protection"
```

---

### Task 5: Database Schema

**Files:**
- Create: `database/001-initial-schema.sql`

- [ ] **Step 1: Create database/001-initial-schema.sql**

This schema is derived from the Skill Tracker data model (skills/skill-tracker/SKILL.md lines 29-81) and the D099 directive scope.

```sql
-- RSS Platform Phase 2 — Initial Schema
-- Directive: D099
-- Date: 2026-04-11

-- Salesperson profiles (one per authenticated user)
CREATE TABLE salesperson_profiles (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_oid        NVARCHAR(255)    NOT NULL UNIQUE,  -- AAD Object ID from SWA auth
    display_name    NVARCHAR(255)    NOT NULL,
    email           NVARCHAR(255)    NOT NULL,
    current_focus_unit NVARCHAR(50)  NULL,              -- e.g. 'unit_3_building'
    created_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

-- Coaching sessions (one per conversation with the agent)
CREATE TABLE coaching_sessions (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    salesperson_id  UNIQUEIDENTIFIER NOT NULL REFERENCES salesperson_profiles(id),
    mode            NVARCHAR(50)     NOT NULL,  -- 'pre-call' | 'post-call' | 'dev-review'
    agent_session_id NVARCHAR(255)   NULL,      -- Managed Agent session ID
    customer_name   NVARCHAR(255)    NULL,      -- Customer context (for pre-call/post-call)
    opportunity_name NVARCHAR(255)   NULL,      -- Deal context
    summary         NVARCHAR(MAX)    NULL,      -- AI-generated session summary
    started_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    completed_at    DATETIME2        NULL
);

CREATE INDEX IX_coaching_sessions_salesperson ON coaching_sessions(salesperson_id, started_at DESC);

-- Coaching messages (conversation history within a session)
CREATE TABLE coaching_messages (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    session_id      UNIQUEIDENTIFIER NOT NULL REFERENCES coaching_sessions(id),
    role            NVARCHAR(20)     NOT NULL,  -- 'user' | 'assistant'
    content         NVARCHAR(MAX)    NOT NULL,
    created_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_coaching_messages_session ON coaching_messages(session_id, created_at);

-- Observation log (per-debrief skill observations, from Skill Tracker data model)
CREATE TABLE observation_log (
    id                  UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    salesperson_id      UNIQUEIDENTIFIER NOT NULL REFERENCES salesperson_profiles(id),
    session_id          UNIQUEIDENTIFIER NULL REFERENCES coaching_sessions(id),
    observation_date    DATE             NOT NULL,
    meeting_type        NVARCHAR(100)    NOT NULL,  -- 'first_meeting' | 'follow_up' | 'presentation' | 'discovery'
    unit_assessed       NVARCHAR(50)     NOT NULL,  -- 'unit_1_positioning' .. 'unit_5_resolving_concerns'
    score               INT              NOT NULL CHECK (score BETWEEN 1 AND 6),
    specific_behaviour  NVARCHAR(MAX)    NOT NULL,  -- Customer-response-anchored observation
    created_at          DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_observation_log_salesperson ON observation_log(salesperson_id, observation_date DESC);
CREATE INDEX IX_observation_log_unit ON observation_log(salesperson_id, unit_assessed, observation_date DESC);

-- Situational Matrix position history (per customer/opportunity)
CREATE TABLE matrix_positions (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    salesperson_id  UNIQUEIDENTIFIER NOT NULL REFERENCES salesperson_profiles(id),
    session_id      UNIQUEIDENTIFIER NULL REFERENCES coaching_sessions(id),
    customer_name   NVARCHAR(255)    NOT NULL,
    opportunity_name NVARCHAR(255)   NULL,
    quadrant        NVARCHAR(10)     NOT NULL,  -- 'Q1' | 'Q2' | 'Q3' | 'Q4'
    evidence        NVARCHAR(MAX)    NOT NULL,  -- Why this quadrant was assessed
    assessed_at     DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_matrix_positions_salesperson ON matrix_positions(salesperson_id, assessed_at DESC);
CREATE INDEX IX_matrix_positions_customer ON matrix_positions(salesperson_id, customer_name, assessed_at DESC);

-- Async job tracking (pattern from BVCA/Imerys)
CREATE TABLE ai_jobs (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    session_id      UNIQUEIDENTIFIER NULL REFERENCES coaching_sessions(id),
    salesperson_id  UNIQUEIDENTIFIER NOT NULL REFERENCES salesperson_profiles(id),
    job_type        NVARCHAR(50)     NOT NULL,  -- 'coaching_message' | 'session_summary'
    status          NVARCHAR(20)     NOT NULL DEFAULT 'queued',  -- 'queued' | 'processing' | 'complete' | 'failed'
    request_json    NVARCHAR(MAX)    NULL,
    result_json     NVARCHAR(MAX)    NULL,
    error_message   NVARCHAR(MAX)    NULL,
    created_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    completed_at    DATETIME2        NULL
);

CREATE INDEX IX_ai_jobs_session ON ai_jobs(session_id);
CREATE INDEX IX_ai_jobs_status ON ai_jobs(status, created_at);
```

- [ ] **Step 2: Commit**

```bash
git add database/001-initial-schema.sql
git commit -m "scaffold: database schema — profiles, sessions, observations, matrix, jobs"
```

---

## Phase C: Auth (Task 6)

Auth is placed before frontend/backend feature work because both depend on it.

### Task 6: API Auth and Database Libraries

**Files:**
- Create: `api/src/lib/auth.ts`
- Create: `api/src/lib/db.ts`

- [ ] **Step 1: Create api/src/lib/auth.ts**

```typescript
import type { HttpRequest } from '@azure/functions'

export interface ClientPrincipal {
  identityProvider: string
  userId: string       // AAD Object ID
  userDetails: string  // email
  userRoles: string[]
}

export function getClientPrincipal(req: HttpRequest): ClientPrincipal | null {
  const header = req.headers.get('x-ms-client-principal')
  if (!header) return null
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf-8')) as ClientPrincipal
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Create api/src/lib/db.ts**

Pattern lifted from Imerys (mssql with connection pooling, prod/preview routing).

```typescript
import sql from 'mssql'
import type { HttpRequest } from '@azure/functions'

const PROD_HOST = 'rss-platform.proudfoot.com' // Update after SWA provisioning

let prodPool: sql.ConnectionPool | null = null
let previewPool: sql.ConnectionPool | null = null

function parseConnectionString(connStr: string): sql.config {
  const parts = new Map<string, string>()
  for (const part of connStr.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0) parts.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim())
  }
  const server = (parts.get('server') || '').replace('tcp:', '').split(',')[0]
  const port = parseInt((parts.get('server') || '').split(',')[1] || '1433', 10)
  return {
    server,
    port,
    database: parts.get('initial catalog') || parts.get('database') || '',
    user: parts.get('user id') || parts.get('uid') || '',
    password: parts.get('password') || parts.get('pwd') || '',
    options: { encrypt: true, trustServerCertificate: false },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  }
}

function isProd(req?: HttpRequest): boolean {
  if (!req) return true
  const originalUrl = req.headers.get('x-ms-original-url') || ''
  try {
    return new URL(originalUrl).hostname === PROD_HOST
  } catch {
    return true
  }
}

async function getPool(req?: HttpRequest): Promise<sql.ConnectionPool> {
  if (isProd(req)) {
    if (!prodPool) {
      const connStr = process.env.SQL_CONNECTION_STRING
      if (!connStr) throw new Error('SQL_CONNECTION_STRING is not set')
      prodPool = await new sql.ConnectionPool(parseConnectionString(connStr)).connect()
    }
    return prodPool
  }
  if (!previewPool) {
    const connStr = process.env.SQL_CONNECTION_STRING_PREVIEW || process.env.SQL_CONNECTION_STRING
    if (!connStr) throw new Error('SQL_CONNECTION_STRING is not set')
    previewPool = await new sql.ConnectionPool(parseConnectionString(connStr)).connect()
  }
  return previewPool
}

export async function query<T extends Record<string, unknown>>(
  sqlText: string,
  params?: Record<string, unknown>,
  req?: HttpRequest,
): Promise<sql.IResult<T>> {
  const pool = await getPool(req)
  const request = pool.request()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value)
    }
  }
  return request.query<T>(sqlText)
}
```

- [ ] **Step 3: Verify API builds with new lib files**

Run: `cd api && npx tsc && cd ..`
Expected: Compiles with no errors

- [ ] **Step 4: Commit**

```bash
git add api/src/lib/auth.ts api/src/lib/db.ts
git commit -m "feat: API auth (SWA ClientPrincipal) and database connection library"
```

---

## Phase D: API + Integration (Tasks 7-12)

### Task 7: Async Job System

**Files:**
- Create: `api/src/lib/jobs.ts`

- [ ] **Step 1: Create api/src/lib/jobs.ts**

Pattern from BVCA Platform with user-friendly error messages.

```typescript
import { v4 as uuidv4 } from 'uuid'
import { query } from './db.js'
import type { HttpRequest } from '@azure/functions'

export interface AiJob {
  id: string
  session_id: string | null
  salesperson_id: string
  job_type: string
  status: 'queued' | 'processing' | 'complete' | 'failed'
  request_json: string | null
  result_json: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export async function getJob(jobId: string, req?: HttpRequest): Promise<AiJob | null> {
  const result = await query<AiJob>(
    'SELECT * FROM ai_jobs WHERE id = @jobId',
    { jobId },
    req,
  )
  return result.recordset[0] || null
}

export async function submitJob(
  salespersonId: string,
  sessionId: string | null,
  jobType: string,
  work: (jobId: string) => Promise<string>,
  requestSnapshot?: unknown,
  req?: HttpRequest,
): Promise<string> {
  const jobId = uuidv4()

  await query(
    `INSERT INTO ai_jobs (id, salesperson_id, session_id, job_type, status, request_json, created_at)
     VALUES (@id, @salespersonId, @sessionId, @jobType, 'queued', @requestJson, GETUTCDATE())`,
    {
      id: jobId,
      salespersonId,
      sessionId,
      jobType,
      requestJson: requestSnapshot ? JSON.stringify(requestSnapshot) : null,
    },
    req,
  )

  // Fire-and-forget: run work in background, update job on completion/failure
  void (async () => {
    try {
      await query(
        `UPDATE ai_jobs SET status = 'processing' WHERE id = @id`,
        { id: jobId },
        req,
      )
      const resultJson = await work(jobId)
      await query(
        `UPDATE ai_jobs SET status = 'complete', result_json = @resultJson, completed_at = GETUTCDATE() WHERE id = @id`,
        { id: jobId, resultJson },
        req,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const lower = message.toLowerCase()
      let userMessage: string
      if (lower.includes('401') || lower.includes('authentication') || lower.includes('auth_error')) {
        userMessage = 'AI service not configured. Contact your administrator.'
      } else if (lower.includes('429') || lower.includes('rate_limit') || lower.includes('rate limit')) {
        userMessage = 'AI service is temporarily busy. Please try again in a few minutes.'
      } else if (lower.includes('timeout')) {
        userMessage = 'Coaching response timed out. Please try again.'
      } else {
        userMessage = 'Coaching generation failed. Please try again.'
      }
      await query(
        `UPDATE ai_jobs SET status = 'failed', error_message = @errorMessage, completed_at = GETUTCDATE() WHERE id = @id`,
        { id: jobId, errorMessage: userMessage },
        req,
      ).catch(() => {})
    }
  })()

  return jobId
}
```

- [ ] **Step 2: Verify build**

Run: `cd api && npx tsc && cd ..`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/src/lib/jobs.ts
git commit -m "feat: async job queue with user-friendly error messages"
```

---

### Task 8: Managed Agent Integration

**Files:**
- Create: `api/src/lib/managed-agent.ts`

- [ ] **Step 1: Create api/src/lib/managed-agent.ts**

Adapted from Imerys `managed-agent.ts`. Key changes: (1) reuses existing session for multi-turn conversations, (2) adds `sendMessage` for continuing a session rather than always creating new ones.

```typescript
import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const POLL_INTERVAL_MS = 3000

export interface AgentResponse {
  text: string
  sessionId: string
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('[auth_error] ANTHROPIC_API_KEY is not set')
    client = new Anthropic({ apiKey })
  }
  return client
}

function getAgentId(): string {
  const id = process.env.MANAGED_AGENT_ID
  if (!id) throw new Error('[auth_error] MANAGED_AGENT_ID is not set')
  return id
}

function getEnvironmentId(): string {
  const id = process.env.MANAGED_ENVIRONMENT_ID
  if (!id) throw new Error('[auth_error] MANAGED_ENVIRONMENT_ID is not set')
  return id
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a new Managed Agent session and send the first message.
 * Returns the agent's text response and the session ID for future messages.
 */
export async function createSession(
  userMessage: string,
  options?: { timeoutMs?: number },
): Promise<AgentResponse> {
  const anthropic = getClient()
  const agentId = getAgentId()
  const environmentId = getEnvironmentId()
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const session = await anthropic.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
  })
  const sessionId = session.id

  return sendMessageToSession(sessionId, userMessage, { timeoutMs })
}

/**
 * Send a message to an existing Managed Agent session.
 * Used for multi-turn coaching conversations.
 */
export async function sendMessageToSession(
  sessionId: string,
  userMessage: string,
  options?: { timeoutMs?: number },
): Promise<AgentResponse> {
  const anthropic = getClient()
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  await anthropic.beta.sessions.events.send(sessionId, {
    events: [{
      type: 'user.message' as const,
      content: [{ type: 'text' as const, text: userMessage }],
    }],
  })

  // Poll until session is idle or terminated
  const startTime = Date.now()
  let sessionStatus = 'running'

  while (sessionStatus === 'running' || sessionStatus === 'rescheduling') {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('[timeout] Coaching session exceeded maximum duration')
    }
    await sleep(POLL_INTERVAL_MS)
    const current = await anthropic.beta.sessions.retrieve(sessionId)
    sessionStatus = current.status
  }

  if (sessionStatus === 'terminated') {
    const events = []
    for await (const event of anthropic.beta.sessions.events.list(sessionId)) {
      events.push(event)
    }
    const errorEvent = events.find(e => e.type === 'session.error')
    let errorMsg = 'Session terminated unexpectedly'
    if (errorEvent && errorEvent.type === 'session.error') {
      errorMsg = errorEvent.error.message
    }
    throw new Error(`[session_error] ${errorMsg}`)
  }

  if (sessionStatus !== 'idle') {
    throw new Error(`[parse_error] Unexpected session status: ${sessionStatus}`)
  }

  // Extract text from agent.message events
  const allEvents = []
  for await (const event of anthropic.beta.sessions.events.list(sessionId)) {
    allEvents.push(event)
  }

  const textParts: string[] = []
  for (const event of allEvents) {
    if (event.type === 'agent.message') {
      for (const block of event.content) {
        if (block.type === 'text') {
          textParts.push(block.text)
        }
      }
    }
  }

  return { text: textParts.join('\n'), sessionId }
}
```

- [ ] **Step 2: Verify build**

Run: `cd api && npx tsc && cd ..`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/src/lib/managed-agent.ts
git commit -m "feat: Managed Agent integration — session create + multi-turn messaging"
```

---

### Task 9: Session and Message Endpoints

**Files:**
- Create: `api/src/functions/sessions.ts`
- Create: `api/src/functions/messages.ts`
- Create: `api/src/functions/jobs.ts`

- [ ] **Step 1: Create api/src/functions/sessions.ts**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'
import { v4 as uuidv4 } from 'uuid'

interface SessionRow {
  id: string
  mode: string
  customer_name: string | null
  opportunity_name: string | null
  summary: string | null
  started_at: string
  completed_at: string | null
}

async function createSession(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const body = await req.json() as { mode: string; customerName?: string; opportunityName?: string }
  if (!body.mode || !['pre-call', 'post-call', 'dev-review'].includes(body.mode)) {
    return { status: 400, jsonBody: { error: 'mode must be pre-call, post-call, or dev-review' } }
  }

  // Ensure salesperson profile exists (upsert)
  await query(
    `IF NOT EXISTS (SELECT 1 FROM salesperson_profiles WHERE user_oid = @userOid)
     INSERT INTO salesperson_profiles (id, user_oid, display_name, email)
     VALUES (@id, @userOid, @displayName, @email)`,
    { id: uuidv4(), userOid: principal.userId, displayName: principal.userDetails, email: principal.userDetails },
    req,
  )

  const profileResult = await query<{ id: string }>(
    'SELECT id FROM salesperson_profiles WHERE user_oid = @userOid',
    { userOid: principal.userId },
    req,
  )
  const salespersonId = profileResult.recordset[0].id

  const sessionId = uuidv4()
  await query(
    `INSERT INTO coaching_sessions (id, salesperson_id, mode, customer_name, opportunity_name, started_at)
     VALUES (@id, @salespersonId, @mode, @customerName, @opportunityName, GETUTCDATE())`,
    {
      id: sessionId,
      salespersonId,
      mode: body.mode,
      customerName: body.customerName || null,
      opportunityName: body.opportunityName || null,
    },
    req,
  )

  return { status: 201, jsonBody: { id: sessionId, mode: body.mode } }
}

async function listSessions(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const result = await query<SessionRow>(
    `SELECT cs.id, cs.mode, cs.customer_name, cs.opportunity_name, cs.summary, cs.started_at, cs.completed_at
     FROM coaching_sessions cs
     JOIN salesperson_profiles sp ON cs.salesperson_id = sp.id
     WHERE sp.user_oid = @userOid
     ORDER BY cs.started_at DESC`,
    { userOid: principal.userId },
    req,
  )

  return { status: 200, jsonBody: result.recordset }
}

async function getSession(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const sessionId = req.params.sessionId
  if (!sessionId) return { status: 400 }

  const result = await query<SessionRow & { salesperson_user_oid: string }>(
    `SELECT cs.*, sp.user_oid AS salesperson_user_oid
     FROM coaching_sessions cs
     JOIN salesperson_profiles sp ON cs.salesperson_id = sp.id
     WHERE cs.id = @sessionId`,
    { sessionId },
    req,
  )

  if (result.recordset.length === 0) return { status: 404 }
  if (result.recordset[0].salesperson_user_oid !== principal.userId) return { status: 403 }

  // Get messages for this session
  const messages = await query<{ id: string; role: string; content: string; created_at: string }>(
    'SELECT id, role, content, created_at FROM coaching_messages WHERE session_id = @sessionId ORDER BY created_at',
    { sessionId },
    req,
  )

  const session = result.recordset[0]
  return {
    status: 200,
    jsonBody: {
      id: session.id,
      mode: session.mode,
      customerName: session.customer_name,
      opportunityName: session.opportunity_name,
      summary: session.summary,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      messages: messages.recordset,
    },
  }
}

app.http('createSession', { methods: ['POST'], authLevel: 'anonymous', route: 'sessions', handler: createSession })
app.http('listSessions', { methods: ['GET'], authLevel: 'anonymous', route: 'sessions', handler: listSessions })
app.http('getSession', { methods: ['GET'], authLevel: 'anonymous', route: 'sessions/{sessionId}', handler: getSession })
```

- [ ] **Step 2: Create api/src/functions/messages.ts**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'
import { submitJob, getJob } from '../lib/jobs.js'
import { createSession as createAgentSession, sendMessageToSession } from '../lib/managed-agent.js'
import { v4 as uuidv4 } from 'uuid'

async function sendMessage(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const sessionId = req.params.sessionId
  if (!sessionId) return { status: 400 }

  const body = await req.json() as { content: string }
  if (!body.content?.trim()) return { status: 400, jsonBody: { error: 'content is required' } }

  // Verify session belongs to user
  const sessionResult = await query<{ id: string; agent_session_id: string | null; salesperson_id: string }>(
    `SELECT cs.id, cs.agent_session_id, cs.salesperson_id
     FROM coaching_sessions cs
     JOIN salesperson_profiles sp ON cs.salesperson_id = sp.id
     WHERE cs.id = @sessionId AND sp.user_oid = @userOid`,
    { sessionId, userOid: principal.userId },
    req,
  )
  if (sessionResult.recordset.length === 0) return { status: 404 }

  const session = sessionResult.recordset[0]

  // Save user message
  await query(
    `INSERT INTO coaching_messages (id, session_id, role, content, created_at)
     VALUES (@id, @sessionId, 'user', @content, GETUTCDATE())`,
    { id: uuidv4(), sessionId, content: body.content },
    req,
  )

  // Submit async job to get agent response
  const jobId = await submitJob(
    session.salesperson_id,
    sessionId,
    'coaching_message',
    async () => {
      let agentResponse
      if (session.agent_session_id) {
        // Continue existing agent session
        agentResponse = await sendMessageToSession(session.agent_session_id, body.content)
      } else {
        // First message: create new agent session
        agentResponse = await createAgentSession(body.content)
        // Store agent session ID for future messages
        await query(
          'UPDATE coaching_sessions SET agent_session_id = @agentSessionId WHERE id = @sessionId',
          { agentSessionId: agentResponse.sessionId, sessionId },
          req,
        )
      }

      // Save assistant message
      await query(
        `INSERT INTO coaching_messages (id, session_id, role, content, created_at)
         VALUES (@id, @sessionId, 'assistant', @content, GETUTCDATE())`,
        { id: uuidv4(), sessionId, content: agentResponse.text },
        req,
      )

      return JSON.stringify({ text: agentResponse.text })
    },
    { content: body.content },
    req,
  )

  return { status: 202, jsonBody: { jobId } }
}

app.http('sendMessage', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/messages',
  handler: sendMessage,
})
```

- [ ] **Step 3: Create api/src/functions/jobs.ts**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { getJob } from '../lib/jobs.js'
import { query } from '../lib/db.js'

async function getJobStatus(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const jobId = req.params.jobId
  if (!jobId) return { status: 400 }

  const job = await getJob(jobId, req)
  if (!job) return { status: 404 }

  // Verify job belongs to user
  const ownership = await query<{ id: string }>(
    `SELECT sp.id FROM salesperson_profiles sp WHERE sp.id = @salespersonId AND sp.user_oid = @userOid`,
    { salespersonId: job.salesperson_id, userOid: principal.userId },
    req,
  )
  if (ownership.recordset.length === 0) return { status: 404 }

  if (job.status === 'complete') {
    return {
      status: 200,
      jsonBody: {
        status: 'complete',
        result: job.result_json ? JSON.parse(job.result_json) : null,
        completedAt: job.completed_at,
      },
    }
  }

  if (job.status === 'failed') {
    return {
      status: 200,
      jsonBody: { status: 'failed', error: job.error_message },
    }
  }

  return { status: 200, jsonBody: { status: job.status } }
}

app.http('getJobStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'jobs/{jobId}',
  handler: getJobStatus,
})
```

- [ ] **Step 4: Verify build**

Run: `cd api && npx tsc && cd ..`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add api/src/functions/sessions.ts api/src/functions/messages.ts api/src/functions/jobs.ts
git commit -m "feat: coaching session CRUD, message sending with async agent, job polling"
```

---

### Task 10: Profile and Observation Endpoints

**Files:**
- Create: `api/src/functions/profile.ts`
- Create: `api/src/functions/observations.ts`
- Create: `api/src/functions/trends.ts`

- [ ] **Step 1: Create api/src/functions/profile.ts**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

interface ProfileRow {
  id: string
  display_name: string
  email: string
  current_focus_unit: string | null
  created_at: string
}

async function getProfile(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const result = await query<ProfileRow>(
    'SELECT id, display_name, email, current_focus_unit, created_at FROM salesperson_profiles WHERE user_oid = @userOid',
    { userOid: principal.userId },
    req,
  )

  if (result.recordset.length === 0) {
    return { status: 200, jsonBody: null }
  }

  return { status: 200, jsonBody: result.recordset[0] }
}

async function updateFocusUnit(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const body = await req.json() as { focusUnit: string | null }
  const validUnits = ['unit_1_positioning', 'unit_2_discovering', 'unit_3_building', 'unit_4_presenting', 'unit_5_resolving_concerns', null]
  if (!validUnits.includes(body.focusUnit)) {
    return { status: 400, jsonBody: { error: 'Invalid focus unit' } }
  }

  await query(
    'UPDATE salesperson_profiles SET current_focus_unit = @focusUnit, updated_at = GETUTCDATE() WHERE user_oid = @userOid',
    { focusUnit: body.focusUnit, userOid: principal.userId },
    req,
  )

  return { status: 200, jsonBody: { focusUnit: body.focusUnit } }
}

app.http('getProfile', { methods: ['GET'], authLevel: 'anonymous', route: 'profile', handler: getProfile })
app.http('updateFocusUnit', { methods: ['PUT'], authLevel: 'anonymous', route: 'profile/focus-unit', handler: updateFocusUnit })
```

- [ ] **Step 2: Create api/src/functions/observations.ts**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

interface ObservationRow {
  id: string
  observation_date: string
  meeting_type: string
  unit_assessed: string
  score: number
  specific_behaviour: string
  created_at: string
}

async function getObservations(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const unit = req.query.get('unit') || null
  const limit = Math.min(parseInt(req.query.get('limit') || '50', 10), 200)

  let sqlText = `
    SELECT TOP (@limit) ol.id, ol.observation_date, ol.meeting_type, ol.unit_assessed, ol.score, ol.specific_behaviour, ol.created_at
    FROM observation_log ol
    JOIN salesperson_profiles sp ON ol.salesperson_id = sp.id
    WHERE sp.user_oid = @userOid`

  const params: Record<string, unknown> = { userOid: principal.userId, limit }

  if (unit) {
    sqlText += ' AND ol.unit_assessed = @unit'
    params.unit = unit
  }

  sqlText += ' ORDER BY ol.observation_date DESC'

  const result = await query<ObservationRow>(sqlText, params, req)
  return { status: 200, jsonBody: result.recordset }
}

app.http('getObservations', { methods: ['GET'], authLevel: 'anonymous', route: 'profile/observations', handler: getObservations })
```

- [ ] **Step 3: Create api/src/functions/trends.ts**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

interface ScoreRow {
  unit_assessed: string
  score: number
  observation_date: string
}

interface UnitTrend {
  unit: string
  currentScore: number | null
  averageScore: number
  observationCount: number
  trend: 'improving' | 'plateauing' | 'declining' | 'insufficient_data'
  scores: Array<{ score: number; date: string }>
}

function classifyTrend(scores: number[]): 'improving' | 'plateauing' | 'declining' | 'insufficient_data' {
  if (scores.length < 3) return 'insufficient_data'

  const recent = scores.slice(-3)
  const range = Math.max(...recent) - Math.min(...recent)

  if (range <= 0.5) return 'plateauing'

  // Compare first half to second half of recent scores
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (last > first) return 'improving'
  if (last < first) return 'declining'
  return 'plateauing'
}

async function getTrends(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const result = await query<ScoreRow>(
    `SELECT ol.unit_assessed, ol.score, ol.observation_date
     FROM observation_log ol
     JOIN salesperson_profiles sp ON ol.salesperson_id = sp.id
     WHERE sp.user_oid = @userOid
     ORDER BY ol.observation_date ASC`,
    { userOid: principal.userId },
    req,
  )

  // Group by unit
  const unitMap = new Map<string, Array<{ score: number; date: string }>>()
  for (const row of result.recordset) {
    const entries = unitMap.get(row.unit_assessed) || []
    entries.push({ score: row.score, date: row.observation_date })
    unitMap.set(row.unit_assessed, entries)
  }

  const allUnits = [
    'unit_1_positioning', 'unit_2_discovering', 'unit_3_building',
    'unit_4_presenting', 'unit_5_resolving_concerns',
  ]

  const trends: UnitTrend[] = allUnits.map(unit => {
    const entries = unitMap.get(unit) || []
    const scores = entries.map(e => e.score)
    return {
      unit,
      currentScore: scores.length > 0 ? scores[scores.length - 1] : null,
      averageScore: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
      observationCount: scores.length,
      trend: classifyTrend(scores),
      scores: entries,
    }
  })

  return { status: 200, jsonBody: trends }
}

app.http('getTrends', { methods: ['GET'], authLevel: 'anonymous', route: 'profile/trends', handler: getTrends })
```

- [ ] **Step 4: Verify build**

Run: `cd api && npx tsc && cd ..`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add api/src/functions/profile.ts api/src/functions/observations.ts api/src/functions/trends.ts
git commit -m "feat: profile, observations, and trend endpoints for development dashboard"
```

---

### Task 11: Matrix Positions Endpoint

**Files:**
- Create: `api/src/functions/matrix.ts`

- [ ] **Step 1: Create api/src/functions/matrix.ts**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'

interface MatrixRow {
  id: string
  customer_name: string
  opportunity_name: string | null
  quadrant: string
  evidence: string
  assessed_at: string
}

async function getMatrixPositions(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const customer = req.query.get('customer') || null

  let sqlText = `
    SELECT mp.id, mp.customer_name, mp.opportunity_name, mp.quadrant, mp.evidence, mp.assessed_at
    FROM matrix_positions mp
    JOIN salesperson_profiles sp ON mp.salesperson_id = sp.id
    WHERE sp.user_oid = @userOid`

  const params: Record<string, unknown> = { userOid: principal.userId }

  if (customer) {
    sqlText += ' AND mp.customer_name = @customer'
    params.customer = customer
  }

  sqlText += ' ORDER BY mp.assessed_at DESC'

  const result = await query<MatrixRow>(sqlText, params, req)

  // Also compute current positions (latest per customer)
  const latestByCustomer = new Map<string, MatrixRow>()
  for (const row of result.recordset) {
    if (!latestByCustomer.has(row.customer_name)) {
      latestByCustomer.set(row.customer_name, row)
    }
  }

  return {
    status: 200,
    jsonBody: {
      history: result.recordset,
      currentPositions: Array.from(latestByCustomer.values()),
    },
  }
}

app.http('getMatrixPositions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'matrix/positions',
  handler: getMatrixPositions,
})
```

- [ ] **Step 2: Verify full API build**

Run: `cd api && npx tsc && cd ..`
Expected: No errors. All 8 function files compile.

- [ ] **Step 3: Commit**

```bash
git add api/src/functions/matrix.ts
git commit -m "feat: matrix position history endpoint with current position rollup"
```

---

### Task 12: Verify Complete API Build and Run Full TypeScript Check

- [ ] **Step 1: Run `tsc -b` from root (all project references)**

Run: `npx tsc -b`
Expected: Clean build across all 3 project references (app, node, api)

- [ ] **Step 2: Run `npm ci` in api directory to verify lockfile**

Run: `cd api && npm ci && cd ..`
Expected: Installs cleanly from lockfile

- [ ] **Step 3: Commit lockfiles if updated**

```bash
git add api/package-lock.json
git commit -m "chore: verify API lockfile with npm ci"
```

---

## Phase B: Frontend (Tasks 13-21)

### Task 13: Shared Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create src/types/index.ts**

```typescript
// Coaching session types
export type CoachingMode = 'pre-call' | 'post-call' | 'dev-review'

export interface CoachingSession {
  id: string
  mode: CoachingMode
  customerName: string | null
  opportunityName: string | null
  summary: string | null
  startedAt: string
  completedAt: string | null
}

export interface CoachingMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface SessionDetail extends CoachingSession {
  messages: CoachingMessage[]
}

// Job polling
export interface JobStatus {
  status: 'queued' | 'processing' | 'complete' | 'failed'
  result?: { text: string }
  error?: string
  completedAt?: string
}

// Development profile
export interface SalespersonProfile {
  id: string
  display_name: string
  email: string
  current_focus_unit: string | null
  created_at: string
}

// RSS units
export type RssUnit =
  | 'unit_1_positioning'
  | 'unit_2_discovering'
  | 'unit_3_building'
  | 'unit_4_presenting'
  | 'unit_5_resolving_concerns'

export const RSS_UNIT_LABELS: Record<RssUnit, string> = {
  unit_1_positioning: 'Unit 1: Positioning',
  unit_2_discovering: 'Unit 2: Discovering',
  unit_3_building: 'Unit 3: Building',
  unit_4_presenting: 'Unit 4: Presenting',
  unit_5_resolving_concerns: 'Unit 5: Resolving Concerns',
}

// Observations
export interface Observation {
  id: string
  observation_date: string
  meeting_type: string
  unit_assessed: RssUnit
  score: number
  specific_behaviour: string
  created_at: string
}

// Trends
export type TrendDirection = 'improving' | 'plateauing' | 'declining' | 'insufficient_data'

export interface UnitTrend {
  unit: RssUnit
  currentScore: number | null
  averageScore: number
  observationCount: number
  trend: TrendDirection
  scores: Array<{ score: number; date: string }>
}

// Matrix
export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export interface MatrixPosition {
  id: string
  customer_name: string
  opportunity_name: string | null
  quadrant: Quadrant
  evidence: string
  assessed_at: string
}

export interface MatrixData {
  history: MatrixPosition[]
  currentPositions: MatrixPosition[]
}

// Auth
export interface AuthUser {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: shared TypeScript types for coaching, profiles, matrix, and auth"
```

---

### Task 14: API Client and Auth Client

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Create src/lib/api.ts**

```typescript
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((error as { error?: string }).error || `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

const JOB_POLL_INTERVAL_MS = 2000
const JOB_POLL_TIMEOUT_MS = 5 * 60 * 1000

export async function pollJob<T>(jobId: string): Promise<T> {
  const startTime = Date.now()
  while (Date.now() - startTime < JOB_POLL_TIMEOUT_MS) {
    const status = await apiFetch<{ status: string; result?: T; error?: string }>(`/api/jobs/${jobId}`)

    if (status.status === 'complete') return status.result as T
    if (status.status === 'failed') throw new Error(status.error || 'Job failed')

    await new Promise(resolve => setTimeout(resolve, JOB_POLL_INTERVAL_MS))
  }
  throw new Error('Coaching response timed out')
}
```

- [ ] **Step 2: Create src/lib/auth.ts**

```typescript
import type { AuthUser } from '../types'

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/.auth/me')
    if (!response.ok) return null
    const data = await response.json() as { clientPrincipal: AuthUser | null }
    return data.clientPrincipal
  } catch {
    return null
  }
}

export function getLoginUrl(): string {
  return '/.auth/login/aad'
}

export function getLogoutUrl(): string {
  return '/.auth/logout'
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts src/lib/auth.ts
git commit -m "feat: frontend API client with job polling and SWA auth helpers"
```

---

### Task 15: Zustand Store

**Files:**
- Create: `src/lib/store.ts`

- [ ] **Step 1: Create src/lib/store.ts**

```typescript
import { create } from 'zustand'
import type { AuthUser, CoachingSession, SalespersonProfile, UnitTrend, MatrixData } from '../types'
import { apiFetch } from './api'
import { getAuthUser } from './auth'

interface AppState {
  // Auth
  user: AuthUser | null
  userLoading: boolean
  loadUser: () => Promise<void>

  // Sessions
  sessions: CoachingSession[]
  sessionsLoading: boolean
  loadSessions: () => Promise<void>

  // Profile
  profile: SalespersonProfile | null
  profileLoading: boolean
  loadProfile: () => Promise<void>

  // Trends
  trends: UnitTrend[]
  trendsLoading: boolean
  loadTrends: () => Promise<void>

  // Matrix
  matrixData: MatrixData | null
  matrixLoading: boolean
  loadMatrix: () => Promise<void>
}

export const useStore = create<AppState>((set) => ({
  user: null,
  userLoading: true,
  loadUser: async () => {
    set({ userLoading: true })
    const user = await getAuthUser()
    set({ user, userLoading: false })
  },

  sessions: [],
  sessionsLoading: false,
  loadSessions: async () => {
    set({ sessionsLoading: true })
    const sessions = await apiFetch<CoachingSession[]>('/api/sessions')
    set({ sessions, sessionsLoading: false })
  },

  profile: null,
  profileLoading: false,
  loadProfile: async () => {
    set({ profileLoading: true })
    const profile = await apiFetch<SalespersonProfile | null>('/api/profile')
    set({ profile, profileLoading: false })
  },

  trends: [],
  trendsLoading: false,
  loadTrends: async () => {
    set({ trendsLoading: true })
    const trends = await apiFetch<UnitTrend[]>('/api/profile/trends')
    set({ trends, trendsLoading: false })
  },

  matrixData: null,
  matrixLoading: false,
  loadMatrix: async () => {
    set({ matrixLoading: true })
    const matrixData = await apiFetch<MatrixData>('/api/matrix/positions')
    set({ matrixData, matrixLoading: false })
  },
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: Zustand store for auth, sessions, profile, trends, and matrix data"
```

---

### Task 16: Shared UI Components

**Files:**
- Create: `src/components/Layout.tsx`
- Create: `src/components/ChatMessage.tsx`
- Create: `src/components/ChatInput.tsx`
- Create: `src/components/ModeSelector.tsx`
- Create: `src/components/UnitBadge.tsx`
- Create: `src/components/ScoreBar.tsx`
- Create: `src/components/TrendIndicator.tsx`
- Create: `src/components/QuadrantLabel.tsx`
- Create: `src/components/LoadingSpinner.tsx`

- [ ] **Step 1: Create src/components/LoadingSpinner.tsx**

```tsx
export default function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full h-6 w-6 border-2 border-proudfoot-navy border-t-transparent ${className}`} />
  )
}
```

- [ ] **Step 2: Create src/components/Layout.tsx**

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../lib/store'
import { getLogoutUrl } from '../lib/auth'

const navItems = [
  { to: '/coaching', label: 'Coaching' },
  { to: '/matrix', label: 'Matrix' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/history', label: 'History' },
]

export default function Layout() {
  const user = useStore(s => s.user)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <nav className="w-56 bg-proudfoot-navy text-white flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-lg font-semibold">RSS Coach</h1>
          <p className="text-xs text-white/60">Proudfoot</p>
        </div>

        <div className="flex-1 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'bg-white/10 font-medium' : 'text-white/70 hover:bg-white/5'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {user && (
          <div className="p-4 border-t border-white/10">
            <p className="text-xs text-white/60 truncate">{user.userDetails}</p>
            <a href={getLogoutUrl()} className="text-xs text-white/40 hover:text-white/70">
              Sign out
            </a>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create src/components/UnitBadge.tsx**

```tsx
import type { RssUnit } from '../types'
import { RSS_UNIT_LABELS } from '../types'

const unitColors: Record<RssUnit, string> = {
  unit_1_positioning: 'bg-blue-100 text-blue-800',
  unit_2_discovering: 'bg-green-100 text-green-800',
  unit_3_building: 'bg-amber-100 text-amber-800',
  unit_4_presenting: 'bg-purple-100 text-purple-800',
  unit_5_resolving_concerns: 'bg-red-100 text-red-800',
}

export default function UnitBadge({ unit }: { unit: RssUnit }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${unitColors[unit]}`}>
      {RSS_UNIT_LABELS[unit]}
    </span>
  )
}
```

- [ ] **Step 4: Create src/components/ScoreBar.tsx**

```tsx
export default function ScoreBar({ score, max = 6 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = score <= 2 ? 'bg-red-500' : score <= 4 ? 'bg-amber-500' : 'bg-green-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium w-6 text-right">{score}</span>
    </div>
  )
}
```

- [ ] **Step 5: Create src/components/TrendIndicator.tsx**

```tsx
import type { TrendDirection } from '../types'

const trendConfig: Record<TrendDirection, { label: string; color: string; arrow: string }> = {
  improving: { label: 'Improving', color: 'text-green-600', arrow: '\u2191' },
  plateauing: { label: 'Plateauing', color: 'text-amber-600', arrow: '\u2192' },
  declining: { label: 'Declining', color: 'text-red-600', arrow: '\u2193' },
  insufficient_data: { label: 'Insufficient data', color: 'text-gray-400', arrow: '\u2014' },
}

export default function TrendIndicator({ trend }: { trend: TrendDirection }) {
  const config = trendConfig[trend]
  return (
    <span className={`text-sm font-medium ${config.color}`}>
      {config.arrow} {config.label}
    </span>
  )
}
```

- [ ] **Step 6: Create src/components/QuadrantLabel.tsx**

```tsx
import type { Quadrant } from '../types'

const quadrantConfig: Record<Quadrant, { label: string; description: string; color: string }> = {
  Q1: { label: 'Q1', description: 'High Need, High Value', color: 'bg-green-100 text-green-800 border-green-300' },
  Q2: { label: 'Q2', description: 'High Need, Low Value', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  Q3: { label: 'Q3', description: 'Low Need, High Value', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  Q4: { label: 'Q4', description: 'Low Need, Low Value', color: 'bg-red-100 text-red-800 border-red-300' },
}

export default function QuadrantLabel({ quadrant, showDescription = false }: { quadrant: Quadrant; showDescription?: boolean }) {
  const config = quadrantConfig[quadrant]
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${config.color}`}>
      {config.label}{showDescription ? `: ${config.description}` : ''}
    </span>
  )
}
```

- [ ] **Step 7: Create src/components/ModeSelector.tsx**

```tsx
import type { CoachingMode } from '../types'

const modes: Array<{ value: CoachingMode; label: string; description: string }> = [
  { value: 'pre-call', label: 'Pre-Call Coaching', description: 'Prepare for an upcoming customer interaction' },
  { value: 'post-call', label: 'Post-Call Debrief', description: 'Debrief after a customer interaction' },
  { value: 'dev-review', label: 'Development Review', description: 'Review your skill development progress' },
]

export default function ModeSelector({
  selected,
  onSelect,
}: {
  selected: CoachingMode | null
  onSelect: (mode: CoachingMode) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {modes.map(mode => (
        <button
          key={mode.value}
          onClick={() => onSelect(mode.value)}
          className={`p-4 rounded-lg border text-left transition ${
            selected === mode.value
              ? 'border-proudfoot-blue bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="font-medium text-sm">{mode.label}</div>
          <div className="text-xs text-gray-500 mt-1">{mode.description}</div>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Create src/components/ChatMessage.tsx**

```tsx
import type { CoachingMessage } from '../types'

export default function ChatMessage({ message }: { message: CoachingMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? 'bg-proudfoot-navy text-white'
            : 'bg-white border border-gray-200 text-gray-800'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Create src/components/ChatInput.tsx**

```tsx
import { useState } from 'react'

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
}: {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-proudfoot-blue focus:border-transparent disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-4 py-2 bg-proudfoot-navy text-white rounded-lg text-sm font-medium hover:bg-proudfoot-slate disabled:opacity-50 transition"
      >
        Send
      </button>
    </form>
  )
}
```

- [ ] **Step 10: Verify build**

Run: `npx tsc -b`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add src/components/
git commit -m "feat: shared UI components — layout, chat, badges, scores, trends, quadrants"
```

---

### Task 17: Coaching Screen

**Files:**
- Create: `src/screens/coaching/CoachingScreen.tsx`

- [ ] **Step 1: Create src/screens/coaching/CoachingScreen.tsx**

```tsx
import { useState, useRef, useEffect } from 'react'
import type { CoachingMode, CoachingMessage } from '../../types'
import { apiFetch, pollJob } from '../../lib/api'
import ModeSelector from '../../components/ModeSelector'
import ChatMessage from '../../components/ChatMessage'
import ChatInput from '../../components/ChatInput'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function CoachingScreen() {
  const [mode, setMode] = useState<CoachingMode | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<CoachingMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function startSession(selectedMode: CoachingMode) {
    setMode(selectedMode)
    setError(null)
    try {
      const result = await apiFetch<{ id: string }>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ mode: selectedMode }),
      })
      setSessionId(result.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
    }
  }

  async function handleSend(content: string) {
    if (!sessionId) return
    setSending(true)
    setError(null)

    const userMsg: CoachingMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const { jobId } = await apiFetch<{ jobId: string }>(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      const result = await pollJob<{ text: string }>(jobId)

      const assistantMsg: CoachingMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.text,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get coaching response')
    } finally {
      setSending(false)
    }
  }

  function handleNewSession() {
    setMode(null)
    setSessionId(null)
    setMessages([])
    setError(null)
  }

  // Mode selection view
  if (!mode) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <h2 className="text-2xl font-semibold text-proudfoot-navy mb-2">Start Coaching Session</h2>
        <p className="text-gray-500 mb-8">Choose a coaching mode to begin</p>
        <div className="w-full max-w-2xl">
          <ModeSelector selected={mode} onSelect={startSession} />
        </div>
      </div>
    )
  }

  // Chat view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div>
          <h2 className="font-medium text-proudfoot-navy">
            {mode === 'pre-call' ? 'Pre-Call Coaching' : mode === 'post-call' ? 'Post-Call Debrief' : 'Development Review'}
          </h2>
        </div>
        <button
          onClick={handleNewSession}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          New Session
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.length === 0 && !sending && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Send a message to begin your coaching session.
          </p>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <LoadingSpinner className="h-4 w-4" />
            <span>Coach is thinking...</span>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white px-6 py-4">
        <ChatInput onSend={handleSend} disabled={sending} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/coaching/CoachingScreen.tsx
git commit -m "feat: coaching chat screen with mode selection, async messaging, job polling"
```

---

### Task 18: Situational Matrix Screen

**Files:**
- Create: `src/screens/matrix/MatrixScreen.tsx`

- [ ] **Step 1: Create src/screens/matrix/MatrixScreen.tsx**

```tsx
import { useEffect } from 'react'
import { useStore } from '../../lib/store'
import QuadrantLabel from '../../components/QuadrantLabel'
import LoadingSpinner from '../../components/LoadingSpinner'
import type { Quadrant, MatrixPosition } from '../../types'

const quadrants: Array<{ id: Quadrant; label: string; description: string; gridArea: string }> = [
  { id: 'Q1', label: 'Q1: High Need, High Value', description: 'Customer recognises need and values your solution', gridArea: 'row-start-1 col-start-2' },
  { id: 'Q2', label: 'Q2: High Need, Low Value', description: 'Customer recognises need but does not yet value your solution', gridArea: 'row-start-1 col-start-1' },
  { id: 'Q3', label: 'Q3: Low Need, High Value', description: 'Customer values relationship but has not articulated need', gridArea: 'row-start-2 col-start-2' },
  { id: 'Q4', label: 'Q4: Low Need, Low Value', description: 'Customer does not recognise need or value your solution', gridArea: 'row-start-2 col-start-1' },
]

function QuadrantCell({
  quadrant,
  positions,
}: {
  quadrant: typeof quadrants[number]
  positions: MatrixPosition[]
}) {
  return (
    <div className={`${quadrant.gridArea} border border-gray-200 rounded-lg p-4 bg-white`}>
      <div className="mb-3">
        <QuadrantLabel quadrant={quadrant.id} showDescription />
      </div>
      <p className="text-xs text-gray-500 mb-3">{quadrant.description}</p>
      {positions.length === 0 ? (
        <p className="text-xs text-gray-300 italic">No customers</p>
      ) : (
        <div className="space-y-2">
          {positions.map(pos => (
            <div key={pos.id} className="text-sm bg-gray-50 rounded px-2 py-1">
              <div className="font-medium">{pos.customer_name}</div>
              {pos.opportunity_name && (
                <div className="text-xs text-gray-500">{pos.opportunity_name}</div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {new Date(pos.assessed_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MatrixScreen() {
  const { matrixData, matrixLoading, loadMatrix } = useStore()

  useEffect(() => { loadMatrix() }, [loadMatrix])

  if (matrixLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  const currentPositions = matrixData?.currentPositions || []

  function positionsForQuadrant(q: Quadrant): MatrixPosition[] {
    return currentPositions.filter(p => p.quadrant === q)
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold text-proudfoot-navy mb-2">Situational Matrix</h2>
      <p className="text-gray-500 text-sm mb-6">Customer positions across the RSS Situational Matrix</p>

      {/* Axis labels */}
      <div className="relative max-w-3xl mx-auto">
        <div className="text-center text-xs text-gray-500 mb-2 font-medium">HIGH NEED</div>
        <div className="grid grid-cols-2 gap-3">
          {quadrants.map(q => (
            <QuadrantCell key={q.id} quadrant={q} positions={positionsForQuadrant(q.id)} />
          ))}
        </div>
        <div className="text-center text-xs text-gray-500 mt-2 font-medium">LOW NEED</div>
        <div className="absolute -left-16 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-500 font-medium whitespace-nowrap">
          LOW VALUE
        </div>
        <div className="absolute -right-16 top-1/2 -translate-y-1/2 rotate-90 text-xs text-gray-500 font-medium whitespace-nowrap">
          HIGH VALUE
        </div>
      </div>

      {/* Position history */}
      {matrixData && matrixData.history.length > 0 && (
        <div className="mt-8 max-w-3xl mx-auto">
          <h3 className="font-medium text-proudfoot-navy mb-3">Recent Position Changes</h3>
          <div className="space-y-2">
            {matrixData.history.slice(0, 20).map(pos => (
              <div key={pos.id} className="flex items-center gap-3 text-sm bg-white rounded-lg border px-4 py-2">
                <QuadrantLabel quadrant={pos.quadrant} />
                <span className="font-medium">{pos.customer_name}</span>
                <span className="text-gray-400 text-xs ml-auto">
                  {new Date(pos.assessed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/matrix/MatrixScreen.tsx
git commit -m "feat: Situational Matrix screen — 4-quadrant grid with customer positions"
```

---

### Task 19: Development Dashboard Screen

**Files:**
- Create: `src/screens/dashboard/DashboardScreen.tsx`

- [ ] **Step 1: Create src/screens/dashboard/DashboardScreen.tsx**

```tsx
import { useEffect } from 'react'
import { useStore } from '../../lib/store'
import { RSS_UNIT_LABELS, type RssUnit } from '../../types'
import UnitBadge from '../../components/UnitBadge'
import ScoreBar from '../../components/ScoreBar'
import TrendIndicator from '../../components/TrendIndicator'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function DashboardScreen() {
  const { profile, profileLoading, loadProfile, trends, trendsLoading, loadTrends } = useStore()

  useEffect(() => {
    loadProfile()
    loadTrends()
  }, [loadProfile, loadTrends])

  if (profileLoading || trendsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-2xl font-semibold text-proudfoot-navy mb-2">Development Dashboard</h2>
      <p className="text-gray-500 text-sm mb-6">
        Your RSS skill development profile across all 5 units
      </p>

      {/* Focus unit */}
      {profile?.current_focus_unit && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
          <span className="text-sm text-blue-700 font-medium">Current Focus: </span>
          <UnitBadge unit={profile.current_focus_unit as RssUnit} />
        </div>
      )}

      {/* Unit competency cards */}
      <div className="space-y-4">
        {trends.map(unitTrend => (
          <div key={unitTrend.unit} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <UnitBadge unit={unitTrend.unit} />
              <TrendIndicator trend={unitTrend.trend} />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-xs text-gray-500">Current Score</div>
                <div className="text-lg font-semibold">
                  {unitTrend.currentScore ?? '-'}
                  <span className="text-xs text-gray-400"> / 6</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Average</div>
                <div className="text-lg font-semibold">{unitTrend.averageScore || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Observations</div>
                <div className="text-lg font-semibold">{unitTrend.observationCount}</div>
              </div>
            </div>

            {unitTrend.currentScore !== null && (
              <ScoreBar score={unitTrend.currentScore} />
            )}

            {/* Mini score history */}
            {unitTrend.scores.length > 0 && (
              <div className="mt-3 flex items-end gap-1 h-8">
                {unitTrend.scores.map((s, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-proudfoot-blue/20 rounded-t"
                    style={{ height: `${(s.score / 6) * 100}%` }}
                    title={`${s.date}: ${s.score}/6`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {trends.every(t => t.observationCount === 0) && (
        <div className="text-center text-gray-400 mt-8">
          <p>No observations yet. Complete coaching sessions to build your development profile.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/dashboard/DashboardScreen.tsx
git commit -m "feat: development dashboard — per-unit scores, trends, and score history"
```

---

### Task 20: Session History Screen

**Files:**
- Create: `src/screens/history/HistoryScreen.tsx`

- [ ] **Step 1: Create src/screens/history/HistoryScreen.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../lib/store'
import type { CoachingMode } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'

const modeLabels: Record<CoachingMode, string> = {
  'pre-call': 'Pre-Call',
  'post-call': 'Post-Call',
  'dev-review': 'Dev Review',
}

export default function HistoryScreen() {
  const { sessions, sessionsLoading, loadSessions } = useStore()
  const navigate = useNavigate()
  const [filterMode, setFilterMode] = useState<CoachingMode | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { loadSessions() }, [loadSessions])

  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  const filtered = sessions.filter(s => {
    if (filterMode !== 'all' && s.mode !== filterMode) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (s.customerName?.toLowerCase().includes(q)) ||
        (s.summary?.toLowerCase().includes(q)) ||
        s.mode.includes(q)
      )
    }
    return true
  })

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-2xl font-semibold text-proudfoot-navy mb-2">Coaching History</h2>
      <p className="text-gray-500 text-sm mb-6">Browse your past coaching sessions</p>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sessions..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-proudfoot-blue"
        />
        <select
          value={filterMode}
          onChange={e => setFilterMode(e.target.value as CoachingMode | 'all')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Modes</option>
          <option value="pre-call">Pre-Call</option>
          <option value="post-call">Post-Call</option>
          <option value="dev-review">Dev Review</option>
        </select>
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">No coaching sessions found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(session => (
            <button
              key={session.id}
              onClick={() => navigate(`/coaching?session=${session.id}`)}
              className="w-full text-left bg-white rounded-lg border px-4 py-3 hover:border-gray-300 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {modeLabels[session.mode as CoachingMode]}
                  </span>
                  {session.customerName && (
                    <span className="text-sm font-medium">{session.customerName}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(session.startedAt).toLocaleDateString()}
                </span>
              </div>
              {session.summary && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{session.summary}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/history/HistoryScreen.tsx
git commit -m "feat: coaching session history browser with search and mode filter"
```

---

### Task 21: Wire Up App Router with Layout and Screens

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update src/App.tsx to use Layout and real screens**

```tsx
import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './lib/store'
import Layout from './components/Layout'
import CoachingScreen from './screens/coaching/CoachingScreen'
import MatrixScreen from './screens/matrix/MatrixScreen'
import DashboardScreen from './screens/dashboard/DashboardScreen'
import HistoryScreen from './screens/history/HistoryScreen'
import LoadingSpinner from './components/LoadingSpinner'

export default function App() {
  const { user, userLoading, loadUser } = useStore()

  useEffect(() => { loadUser() }, [loadUser])

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-semibold text-proudfoot-navy">Proudfoot RSS Coach</h1>
        <a
          href="/.auth/login/aad"
          className="px-6 py-2 bg-proudfoot-navy text-white rounded-lg font-medium hover:bg-proudfoot-slate transition"
        >
          Sign in with Microsoft
        </a>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/coaching" replace />} />
        <Route path="/coaching" element={<CoachingScreen />} />
        <Route path="/matrix" element={<MatrixScreen />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 2: Run full typecheck**

Run: `npx tsc -b`
Expected: No errors across all project references

- [ ] **Step 3: Run dev server to verify rendering**

Run: `npx vite build`
Expected: Build completes, output in `dist/`

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up App router with Layout, all 4 screens, and auth gate"
```

---

## Phase G: Bot Review (Task 22)

### Task 22: Pre-Push Verification and PR

- [ ] **Step 1: Run MH exclusion grep (mandatory before every PR)**

Run:
```bash
grep -rni "economic buyer\|user buyer\|technical buyer\|buying influence\|win-results\|red flag\|sponsorship gap\|concept.*mode.*rating\|perspective.*strateg\|even keel\|overconfident" --include="*.md" --include="*.yaml" --include="*.json" --include="*.ts" --include="*.tsx" . | grep -v "miller-heiman-exclusion-register" | grep -v "MUST NEVER\|EXCLUDED\|Exclusion\|never.*use\|never appear"
```
Expected: Zero results

- [ ] **Step 2: Run full typecheck**

Run: `npx tsc -b`
Expected: No errors

- [ ] **Step 3: Run `npm ci` in both root and api**

Run: `npm ci && cd api && npm ci && cd ..`
Expected: Installs cleanly from lockfiles

- [ ] **Step 4: Run `vite build` to verify production build**

Run: `npx vite build`
Expected: Build completes

- [ ] **Step 5: Update CLAUDE.md for Phase 2**

The CLAUDE.md currently says "Do not introduce Azure hosting patterns, SWA config files, or MSAL auth into this repo." This must be updated to reflect Phase 2's SWA architecture per D099. Update the relevant sections to document the new architecture while preserving all Phase 1 context.

- [ ] **Step 6: Update docs/architecture.md for Phase 2**

Add Phase 2 architecture diagram showing SWA + Managed Agent Backend + Azure SQL. Preserve Phase 1 architecture as historical context.

- [ ] **Step 7: Create feature branch, push, and open PR**

```bash
git checkout -b feature/D099-rss-platform-phase2
git push -u origin feature/D099-rss-platform-phase2
gh pr create --title "feat: RSS Platform Phase 2 — SWA with Managed Agent Backend" --body "..."
```

- [ ] **Step 8: Wait for Claude Code Review bot**

Run: `gh pr checks {PR_NUMBER} --repo alexander-proudfoot/rss-platform --watch`
Expected: Code Review check completes

- [ ] **Step 9: Address bot findings**

Read findings via `gh pr view {PR_NUMBER} --comments`, fix per pattern sweep protocol (Gotcha #4), commit fixes.

---

## Phase F: Playwright E2E (Task 23)

### Task 23: Playwright Test Scaffold

**Files:**
- Create: `e2e/tsconfig.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/tests/auth.spec.ts`
- Create: `e2e/tests/coaching.spec.ts`
- Create: `e2e/tests/dashboard.spec.ts`

- [ ] **Step 1: Create e2e/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 2: Create e2e/playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 3: Create e2e/tests/auth.spec.ts**

```typescript
import { test, expect } from '@playwright/test'

test('unauthenticated user sees sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Sign in with Microsoft')).toBeVisible()
})

test('sign-in link points to AAD auth', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: 'Sign in with Microsoft' })
  await expect(link).toHaveAttribute('href', '/.auth/login/aad')
})
```

- [ ] **Step 4: Create e2e/tests/coaching.spec.ts**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Coaching screen', () => {
  // Note: These tests require auth mocking for SWA /.auth/me
  // In local dev, the auth gate can be bypassed by mocking the fetch response

  test.skip('shows mode selector when no session active', async ({ page }) => {
    await page.goto('/coaching')
    await expect(page.getByText('Pre-Call Coaching')).toBeVisible()
    await expect(page.getByText('Post-Call Debrief')).toBeVisible()
    await expect(page.getByText('Development Review')).toBeVisible()
  })
})
```

- [ ] **Step 5: Create e2e/tests/dashboard.spec.ts**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Dashboard screen', () => {
  test.skip('shows development dashboard heading', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Development Dashboard')).toBeVisible()
  })
})
```

- [ ] **Step 6: Install Playwright browsers**

Run: `npx playwright install chromium`

- [ ] **Step 7: Commit**

```bash
git add e2e/
git commit -m "test: Playwright E2E scaffold with auth, coaching, and dashboard specs"
```

---

## Phase E: UAT Preparation (Task 24)

### Task 24: Update Documentation and Verify

- [ ] **Step 1: Update README.md for Phase 2**

Add Phase 2 sections: architecture overview, local development setup, deployment steps, environment variables needed.

- [ ] **Step 2: Create .env.example for local development**

```
# Anthropic Managed Agent
ANTHROPIC_API_KEY=
MANAGED_AGENT_ID=
MANAGED_ENVIRONMENT_ID=

# Azure SQL
SQL_CONNECTION_STRING=
SQL_CONNECTION_STRING_PREVIEW=

# SWA Auth (local dev uses SWA CLI emulator)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
```

- [ ] **Step 3: Final MH exclusion check**

Run the grep command from Task 22 Step 1 again. Must return zero results.

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "docs: Phase 2 README update and environment variable template"
```

---

## Risk Areas

| Risk | Mitigation |
|------|-----------|
| **Managed Agent API shape may differ from Imerys usage** | managed-agent.ts follows the exact session create/poll/extract pattern proven in Imerys. If API changes, only one file needs updating. |
| **SWA proxy timeout (45s) vs. long agent responses** | Async job pattern returns 202 immediately. Frontend polls `/api/jobs/{id}`. No SWA timeout risk. |
| **Tailwind v4 breaking changes from v3** | Using `@import 'tailwindcss'` syntax (v4). Utility classes are stable. |
| **Azure SQL not provisioned yet** | All endpoints work against the schema. Database is a deployer action (D099 section). Mock data can be used for frontend development. |
| **MH terminology leaking into frontend** | Grep check in Task 22 covers `.ts` and `.tsx` files. RSS terminology only in all labels. |
| **Multi-turn agent sessions** | `sendMessageToSession` reuses the agent session ID stored in `coaching_sessions.agent_session_id`. First message creates, subsequent messages continue. |

---

## Deployer Prerequisites (Manual, Not Code-Buildable)

These must be completed before end-to-end testing:

1. Provision Managed Agent on Anthropic platform (yields `MANAGED_AGENT_ID`, `MANAGED_ENVIRONMENT_ID`)
2. Upload Phase 1 system instructions, skills, and methodology to the Managed Agent
3. Configure Zoho CRM MCP tool on the Managed Agent
4. Add Key Vault secrets: `ANTHROPIC_API_KEY`, `MANAGED_AGENT_ID`, `MANAGED_ENVIRONMENT_ID`
5. Provision Azure SQL database and run `database/001-initial-schema.sql`
6. Configure Azure AD app registration for SWA auth
7. Deploy SWA via Azure CLI or GitHub Actions

---

## Summary

| Phase | Tasks | Files Created | Purpose |
|-------|-------|---------------|---------|
| A: Scaffold | 1-5 | ~15 | Package configs, TypeScript, Vite, SWA config, DB schema |
| C: Auth | 6 | 2 | API auth + database connection libraries |
| D: API | 7-12 | 10 | Jobs, managed-agent, CRUD endpoints |
| B: Frontend | 13-21 | ~20 | Types, API client, store, components, 4 screens, router |
| G: Bot Review | 22 | 0 | MH check, typecheck, PR, bot review |
| F: Playwright | 23 | 5 | E2E test scaffold |
| E: UAT | 24 | 2 | Documentation, env template |

**Total: 24 tasks, ~45 new files**
