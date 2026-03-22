# Murmur — Setup Guide

## Quick Start (Mac / Linux)

```bash
git clone https://github.com/M-Hammad-Faisal/murmur.git
cd murmur
chmod +x setup.sh && ./setup.sh
pnpm dev
```

## Quick Start (Windows)

```
git clone https://github.com/M-Hammad-Faisal/murmur.git
cd murmur
setup.bat
pnpm dev
```

---

## Manual Setup

### 1. Prerequisites

| Tool    | Version  | Install               |
| ------- | -------- | --------------------- |
| Node.js | v24 LTS+ | https://nodejs.org    |
| pnpm    | v10+     | `npm install -g pnpm` |
| Git     | any      | https://git-scm.com   |

### 2. Install dependencies

```bash
pnpm install
```

This installs all packages across all three apps (`renderer`, `main`, `server`) and both
shared packages (`types`, `utils`) in one shot via pnpm workspaces.

### 3. Run in dev mode

```bash
pnpm dev
```

This starts three processes concurrently via Turborepo:

- **Next.js renderer** on `http://localhost:3000`
- **Express API server** on `http://localhost:4000`
- **Electron** — opens the app window loading from localhost:3000

---

## Build installers

### macOS Apple Silicon — arm64 (.dmg)

Run on an M1/M2/M3/M4 Mac:

```bash
pnpm --filter @murmur/main dist:mac
# Output: apps/main/release/Murmur-1.0.0-arm64.dmg
```

### macOS Intel — x64 (.dmg)

Run on an Intel Mac (or use CI on `macos-13` runner):

```bash
pnpm --filter @murmur/main dist:mac:x64
# Output: apps/main/release/Murmur-1.0.0.dmg
```

### Windows (.exe)

Run on a Windows machine (or GitHub Actions `windows-latest`).
Builds both 64-bit and 32-bit installers:

```bash
pnpm --filter @murmur/main dist:win
# Output: apps/main/release/Murmur-1.0.0-Setup.exe       (64-bit)
#         apps/main/release/Murmur-1.0.0-ia32-Setup.exe  (32-bit)
```

### Linux (.AppImage + .deb)

Run on a Linux x64 machine (or GitHub Actions `ubuntu-latest`):

```bash
pnpm --filter @murmur/main dist:linux
# Output: apps/main/release/Murmur-1.0.0.AppImage
#         apps/main/release/murmur_1.0.0_amd64.deb
```

Linux users — run the AppImage:

```bash
chmod +x Murmur-1.0.0.AppImage && ./Murmur-1.0.0.AppImage
```

Or install the deb on Debian/Ubuntu:

```bash
sudo dpkg -i murmur_1.0.0_amd64.deb
```

> WhatsApp requires Chrome. Install it first: https://www.google.com/chrome
> On Linux, puppeteer auto-downloads a compatible Chromium during pnpm install.

### Via GitHub Actions (recommended)

Push a version tag to trigger the release pipeline automatically:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions builds all platforms and publishes a GitHub Release with all installers.
See `.github/workflows/release.yml`.

CI runners: macOS arm64 → `macos-14`, macOS x64 → `macos-13`, Windows → `windows-latest`, Linux → `ubuntu-latest`.

---

## Project structure

```
murmur/
├── apps/
│   ├── renderer/     Next.js 16 — the UI (6 pages)
│   ├── main/         Electron — native shell, tray, window
│   └── server/       Express — Gmail, WhatsApp, SQLite, scheduler
├── packages/
│   ├── types/        Shared TypeScript interfaces
│   └── utils/        Shared pure functions (replaceVars, formatPhone)
└── .github/
    └── workflows/
        ├── ci.yml        Lint + typecheck on every PR
        └── release.yml   Build .dmg + .exe on git tag
```

---

## Adding app icons (required for packaging)

electron-builder needs real icon files before it can package the app.

1. Design or download a 1024×1024 PNG of your logo
2. Place files in `apps/main/resources/icons/`:
   - `icon.png` — 512×512, used for Linux + general
   - `icon.ico` — Windows (use https://convertico.com)
   - `icon.icns` — macOS (use https://cloudconvert.com/png-to-icns)
   - `tray.png` — 16×16 or 32×32, shown in system tray

Without icons the build will still work but use a default blank icon.

---

## Environment

No `.env` file needed — all credentials are stored locally in SQLite via the app's
Settings UI. The database lives at:

- **macOS**: `~/Library/Application Support/murmur/murmur.db`
- **Windows**: `C:\Users\<you>\AppData\Roaming\murmur\murmur.db`
- **Linux**: `~/.config/murmur/murmur.db`
- **Dev**: `./data/murmur.db` (gitignored)

---

## Useful commands

```bash
pnpm dev                        # start everything
pnpm build                      # build all apps
pnpm lint                       # lint all packages
pnpm typecheck                  # type-check all packages
pnpm format                     # auto-format all files
pnpm format:check               # check formatting (used in CI)

# Run a command in a specific app only:
pnpm --filter @murmur/renderer dev        # Next.js only
pnpm --filter @murmur/server dev          # Express only
pnpm --filter @murmur/main dist:mac       # package macOS arm64
pnpm --filter @murmur/main dist:mac:x64   # package macOS Intel
pnpm --filter @murmur/main dist:win       # package Windows
pnpm --filter @murmur/main dist:linux     # package Linux
```
