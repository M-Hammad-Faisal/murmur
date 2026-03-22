# Murmur — Claude Code Context

> Personal broadcaster. Send bulk WhatsApp messages and emails from **your own accounts**.
> No SaaS. No subscriptions. No data leaving the machine. Open source. Forever free.

---

## What this project is

Murmur is a **desktop app** (Electron) that wraps a Next.js UI and an Express API server.
Users import a CSV of contacts, compose a message with `{{name}}` variables, pick a schedule,
and Murmur sends from **their own** WhatsApp number (via QR scan) and **their own** Gmail account
(via App Password). Everything — credentials, contacts, logs — stays in a local SQLite database.

---

## Monorepo structure

```
murmur/                          ← pnpm workspaces + Turborepo
├── apps/
│   ├── renderer/               @murmur/renderer   Next.js 16, App Router, static export
│   ├── main/                   @murmur/main       Electron 41 — window, tray, IPC
│   └── server/                 @murmur/server     Express 5 — API, SQLite, Gmail, WhatsApp
├── packages/
│   ├── types/                  @murmur/types      Shared TypeScript interfaces (no runtime code)
│   └── utils/                  @murmur/utils      replaceVars(), formatPhone() — pure functions
├── scripts/
│   └── clean.mjs               Cross-platform clean script (no rm -rf)
└── .github/workflows/
    ├── ci.yml                  Lint + typecheck + format check on every PR
    └── release.yml             Build .dmg + .exe on git tag push (v*.*.*)
```

---

## How the three apps connect at runtime

```
Electron (main)
  │
  ├── spawns → Express server on localhost:4000
  │              (process.env.MURMUR_USER_DATA = app.getPath('userData'))
  │
  └── creates BrowserWindow
          │
          ├── dev:  loads http://localhost:3000  (Next.js dev server)
          └── prod: loads file://...resources/renderer/index.html  (static export)

Next.js renderer
  └── all /api/* calls → localhost:4000 (proxied in dev via next.config.ts rewrites,
                                          direct fetch in prod since both run locally)
```

---

## Key commands

```bash
# Install everything (run once)
pnpm install

# Start in dev mode (all three apps at once)
pnpm dev

# Clean all build output
pnpm clean

# Full CI pipeline: clean → format:check → lint → typecheck → build
pnpm build:ci

# Standard build (no clean)
pnpm build

# Build and package installers
pnpm dist:mac          # → apps/main/release/Murmur-*.dmg
pnpm dist:win          # → apps/main/release/Murmur-*-Setup.exe

# Individual checks
pnpm lint              # ESLint 9 across all packages
pnpm typecheck         # tsc --noEmit across all packages
pnpm format            # auto-format with Prettier 3
pnpm format:check      # check formatting (used in CI)

# Run a command in one app only
pnpm --filter @murmur/renderer dev
pnpm --filter @murmur/server dev
pnpm --filter @murmur/main dist:mac
```

---

## apps/renderer — Next.js 16

**Package:** `@murmur/renderer`
**Port (dev):** 3000
**Build output:** `apps/renderer/out/` (static HTML, loaded by Electron in prod)

### Pages (App Router)

| Route       | File                    | Purpose                                          |
| ----------- | ----------------------- | ------------------------------------------------ |
| `/setup`    | `app/setup/page.tsx`    | Connect WhatsApp (QR) + Gmail (App Password)     |
| `/contacts` | `app/contacts/page.tsx` | CSV upload, group filter, contact table          |
| `/compose`  | `app/compose/page.tsx`  | Message body, `{{variable}}` chips, live preview |
| `/schedule` | `app/schedule/page.tsx` | Send now / schedule / recurring options          |
| `/review`   | `app/review/page.tsx`   | Summary, send button, live progress bar          |
| `/logs`     | `app/logs/page.tsx`     | Per-contact send/fail/retry table + stats        |

### Important files

- `app/layout.tsx` — root layout, imports `Sidebar` and `globals.css`
- `components/layout/Sidebar.tsx` — nav with `usePathname` for active state
- `lib/api.ts` — **all** API calls live here; typed wrappers around `fetch('/api/...')`
- `styles/globals.css` — full design system (CSS variables, dark mode, all utility classes)
- `next.config.ts` — **critical**: `output: 'export'` only in prod; dev uses rewrites proxy

### CSS conventions

All styling is plain CSS classes in `globals.css`. No Tailwind at runtime.

```tsx
// Correct
<div className="card">
  <button className="btn btn-primary btn-block">Send</button>
</div>

// Never do inline styles for layout — use CSS classes
```

Key class families: `card`, `btn`, `btn-primary`, `btn-danger`, `btn-sm`, `btn-block`,
`badge`, `badge-green/red/blue/amber/muted`, `dot`, `dot-green/red/amber/muted`,
`input`, `label`, `field`, `ch-group`, `ch-btn`, `var-chip`, `alert`, `alert-error/success/info`,
`stat-grid`, `stat-box`, `stat-green/red/blue`, `review-row`, `progress-wrap/fill`, `tbl-wrap`

### Draft persistence

Compose and Schedule pages save state to `sessionStorage` under two keys:

- `murmur-draft` — `{ subject, message, channelWA, channelGmail, waDelay, recipientGroup }`
- `murmur-schedule` — `{ scheduleType, date, time, recur }`

Review page reads both keys to build the `CreateBroadcastPayload`.

---

## apps/server — Express API

**Package:** `@murmur/server`
**Port:** 4000 (hardcoded, only binds to 127.0.0.1)
**Entry:** `src/index.ts` exports `startServer(): Promise<void>`

### Route map

```
GET    /health                         → { status: 'ok' }

GET    /channels/status                → ChannelStatusResponse
POST   /channels/gmail/save            → save + verify Gmail credentials
DELETE /channels/gmail                 → remove Gmail credentials
POST   /channels/whatsapp/connect      → start WA client, begin QR flow
GET    /channels/whatsapp/status       → { status, qrDataUrl, message }
POST   /channels/whatsapp/disconnect   → logout + destroy WA session

GET    /contacts                       → Contact[]  (optional ?tag=)
GET    /contacts/groups                → { total, groups: ContactGroup[] }
POST   /contacts/upload                → parse + import CSV  (?replace=true to wipe first)
DELETE /contacts/all                   → wipe all contacts
DELETE /contacts/:id                   → delete one contact

POST   /broadcasts                     → create + optionally fire immediately
GET    /broadcasts                     → Broadcast[]
GET    /broadcasts/:id/progress        → BroadcastProgress (polled by Review page)

GET    /logs                           → SendLog[]  (optional ?status= ?broadcast_id=)
GET    /logs/stats                     → LogStats
POST   /logs/:id/retry                 → mark failed log as pending
DELETE /logs/all                       → clear all logs
```

### Services

**`services/gmail.ts`**

- `testGmail(user, pass)` — calls `transporter.verify()`, throws on failure
- `sendGmailBroadcast({ broadcast, contacts, onProgress })` — loops contacts, calls `replaceVars`,
  sends via Nodemailer, fires `onProgress` after each, sleeps 1.2s between sends

**`services/whatsapp.ts`**

- Uses `whatsapp-web.js` with `LocalAuth` (session stored at `MURMUR_USER_DATA/whatsapp-session`)
- `initWhatsApp()` — creates client, attaches event handlers, calls `client.initialize()`
- `getStatus()` — returns `{ status, qrDataUrl, message }` — polled by frontend every 2s
- `sendWhatsAppBroadcast({ broadcast, contacts, onProgress })` — loops, formats phone with
  `formatPhone()`, calls `client.sendMessage()`, sleeps `broadcast.wa_delay * 1000` ms between sends

**`services/scheduler.ts`**

- `startScheduler()` — starts a `node-cron` job that fires every minute
- `setRunner(fn)` — called by broadcasts route to inject the `runBroadcast` function (avoids circular dep)
- Checks `broadcasts` table for rows where `status = 'pending'` AND `scheduled_at <= NOW()`

### Database (`db/index.ts`)

SQLite via `better-sqlite3`. DB path: `process.env.MURMUR_USER_DATA/murmur.db`

**Tables:**

```sql
contacts      (id, name, phone, email, tag, birthday, extra_data JSON, created_at)
broadcasts    (id, subject, message, channels JSON, recipient_group, wa_delay,
               scheduled_at, is_recurring, recur_type, status, total,
               sent_count, failed_count, created_at)
send_logs     (id, broadcast_id FK, contact_id FK, contact_name, channel,
               status, error, sent_at)
settings      (key PK, value)   ← stores gmail_user, gmail_pass, gmail_name
```

**`extra_data` field:** stored as JSON string in SQLite, must be `JSON.parse()`d before use.
Both `contacts.ts` route and `broadcasts.ts` route parse it before passing to `replaceVars`.

**Settings keys:** `gmail_user`, `gmail_pass`, `gmail_name`

---

## apps/main — Electron

**Package:** `@murmur/main`
**Entry:** `src/main.ts` (compiled to `dist/main.js`, referenced in `package.json` "main")

### Files

| File             | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `src/main.ts`    | App bootstrap — starts server, creates window + tray, IPC handlers |
| `src/window.ts`  | `createMainWindow()` — BrowserWindow factory                       |
| `src/tray.ts`    | `createTray(win, onQuit)` — system tray with Open/Quit menu        |
| `src/preload.ts` | `contextBridge` — exposes `window.murmurBridge` to renderer        |

### Dev vs prod server loading

```typescript
// Dev: workspace package import
const { startServer } = await import('@murmur/server')

// Prod (packaged): server compiled to resources/server/index.js
const serverPath = path.join(process.resourcesPath, 'server', 'index.js')
const { startServer } = require(serverPath)
```

### Packaging (electron-builder)

- **Mac:** `apps/main/release/Murmur-*.dmg` — universal (x64 + arm64)
- **Win:** `apps/main/release/Murmur-*-Setup.exe` — NSIS installer, x64
- Icons must be placed in `apps/main/resources/icons/` before packaging
  (see `apps/main/resources/icons/README.txt` for required filenames)
- `extraResources` copies `apps/renderer/out/` → `resources/renderer/`
  and `apps/server/dist/` → `resources/server/`

---

## packages/types — Shared types

**Package:** `@murmur/types` — no runtime code, types only.

Key interfaces: `Contact`, `Broadcast`, `CreateBroadcastPayload`, `BroadcastProgress`,
`SendLog`, `LogStats`, `ChannelStatusResponse`, `WhatsAppStatusResponse`,
`GmailStatus`, `SaveGmailPayload`, `ContactGroupsResponse`, `ImportResult`

Always `import type` from here — never a regular import.

---

## packages/utils — Shared utilities

**Package:** `@murmur/utils`

```typescript
replaceVars(template: string, contact: Contact): string
// Replaces {{name}}, {{email}}, {{tag}}, {{birthday}}, plus any extra CSV columns
// contact.extra_data must already be a Record<string,string> (parsed from JSON)

extractVars(template: string): string[]
// Returns unique variable names found in template e.g. ['name', 'tag']

formatPhone(phone: string): string | null
// '+92 300-123-4567' → '923001234567@c.us'   (WhatsApp format)
// Returns null if too short to be valid

isValidPhone(phone: string): boolean
```

---

## TypeScript conventions

- **Strict mode** on everywhere — no `any`, no implicit `any`
- `import type` for all type-only imports (enforced by ESLint)
- No `console.log` in app code — use `console.info`, `console.warn`, `console.error`
- Unused vars must start with `_` (e.g. `_req`, `_next`)
- All async functions return explicit `Promise<T>` types
- `noUncheckedIndexedAccess: true` — array/object access always returns `T | undefined`

```typescript
// Correct
const first = arr[0] // type: string | undefined
if (first) doSomething(first) // type: string

// Correct route handler pattern
router.get('/path', (req, res) => {
  const result = db.prepare('...').get() as MyType | undefined
  if (!result) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json(result)
})
```

---

## ESLint 9 flat config

Config is in `eslint.config.mjs` at the root. Key rules:

- `import/order` — imports grouped: builtin → external → internal → relative, alphabetical
- `@typescript-eslint/consistent-type-imports` — enforces `import type`
- `@typescript-eslint/no-unused-vars` — error, but `_prefixed` args and caught errors ignored (`argsIgnorePattern` + `caughtErrorsIgnorePattern: '^_'`)
- `no-console` — warn, allows `.warn` `.error` `.info`
- React + Next.js rules only applied to `apps/renderer/**`
- `react-hooks/set-state-in-effect` — off for renderer (new rule in v7, too strict for init-on-mount patterns)
- `@typescript-eslint/no-require-imports` — off for `apps/main` (Electron uses CJS)

---

## Prettier 3 config

```json
{ "semi": false, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

---

## CI/CD pipelines

### CI (`ci.yml`) — runs on push to main/dev and all PRs

```
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm format:check
```

### Release (`release.yml`) — runs on `git tag v*.*.*`

```
macos-latest:   pnpm --filter renderer build → pnpm --filter main dist:mac → upload .dmg
windows-latest: pnpm --filter renderer build → pnpm --filter main dist:win → upload .exe
ubuntu-latest:  download both artifacts → create GitHub Release with both files
```

To trigger a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Common tasks

### Add a new API endpoint

1. Add route handler in `apps/server/src/routes/<file>.ts`
2. Add typed wrapper in `apps/renderer/lib/api.ts`
3. Add any new types to `packages/types/src/`
4. Export new types from `packages/types/src/index.ts`

### Add a new page

1. Create `apps/renderer/app/<route>/page.tsx` with `'use client'` and `export default function`
2. Add nav link in `apps/renderer/components/layout/Sidebar.tsx`
3. No router config needed — Next.js App Router is file-based

### Add a new channel (e.g. Telegram)

1. Create `apps/server/src/services/telegram.ts` with `send*Broadcast()` and `getStatus()`
2. Add routes to `apps/server/src/routes/channels.ts`
3. Extend `Channel` type in `packages/types/src/broadcast.ts`
4. Update `runBroadcast()` in `apps/server/src/routes/broadcasts.ts`
5. Add connect UI to `apps/renderer/app/setup/page.tsx`
6. Add channel toggle in `apps/renderer/app/compose/page.tsx`

### Change the DB schema

1. Edit `initSchema()` in `apps/server/src/db/index.ts`
2. For existing installations, add a migration (bare `ALTER TABLE` in a separate function called after `initSchema`)
3. Update relevant TypeScript interfaces in `packages/types/src/`

---

## Environment variables

No `.env` file is used. All user credentials are stored in the SQLite `settings` table.

The only env vars used at runtime (set by Electron before starting the server):

```
MURMUR_USER_DATA   absolute path to Electron userData dir (where murmur.db lives)
MURMUR_SESSIONS    absolute path for WhatsApp session storage
PORT              Express port (defaults to 4000)
```

---

## Things to be careful about

**WhatsApp:**

- `whatsapp-web.js` uses Puppeteer under the hood — needs `--no-sandbox` flags on Linux
- Session is saved to `MURMUR_USER_DATA/whatsapp-session/` — delete this dir to force re-scan
- Too-fast sends will get the number banned — minimum 2s delay enforced in UI (default 5s)
- `formatPhone()` must be called before every `client.sendMessage()` — raw `+92...` numbers won't work

**SQLite:**

- `better-sqlite3` is a native module — must be rebuilt for Electron's Node version via `electron-rebuild`
- `postinstall` in `apps/main/package.json` handles this: `electron-rebuild -f -w better-sqlite3`
- WAL mode is enabled — safe for concurrent reads from multiple code paths

**Next.js static export:**

- `output: 'export'` is incompatible with `rewrites()` — `next.config.ts` handles this conditionally
- All pages must be compatible with static export: no server components with data fetching, no `getServerSideProps`
- All data fetching is done client-side via `lib/api.ts` (React `useEffect` + `fetch`)

**Electron packaging:**

- Icons must exist before running `dist:mac` / `dist:win` (see `resources/icons/README.txt`)
- The `postinstall` `electron-rebuild` step must run after every `pnpm install`
- In packaged app, server is loaded via `require(process.resourcesPath/server/index.js)` — not workspace import

---

## Project info

- **Author:** Muhammad Hammad Faisal
- **GitHub:** `M-Hammad-Faisal/murmur`
- **License:** MIT
- **Brand:** Code Mage (YouTube: @code_your_magic)
- **Stack:** Electron 41 · Next.js 16 · Express 5 · SQLite · TypeScript 5.9 · pnpm · Turborepo
- **Node:** v24 LTS required
