#!/usr/bin/env bash
set -e

echo ""
echo "  ╭─────────────────────────────────────╮"
echo "  │   Relay — Personal Broadcaster      │"
echo "  │   Setting up your local dev env...  │"
echo "  ╰─────────────────────────────────────╯"
echo ""

# Check Node version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 24 ]; then
  echo "  ✗ Node.js v24+ is required. Current: $(node -v 2>/dev/null || echo 'not found')"
  echo "    Install from https://nodejs.org or use nvm: nvm install 24"
  exit 1
fi
echo "  ✓ Node.js $(node -v)"

# Check / install pnpm
if ! command -v pnpm &> /dev/null; then
  echo "  → Installing pnpm..."
  npm install -g pnpm
fi
echo "  ✓ pnpm $(pnpm -v)"

# Install dependencies
echo ""
echo "  → Installing dependencies (this takes ~1 min on first run)..."
pnpm install

# Setup husky
echo "  → Setting up git hooks..."
pnpm prepare 2>/dev/null || true

echo ""
echo "  ✓ All done! Run the app:"
echo ""
echo "    pnpm dev          → start in development mode"
echo "    pnpm lint         → run linter across all packages"
echo "    pnpm typecheck    → run TypeScript checks"
echo "    pnpm format       → auto-format all files"
echo ""
echo "  To build installers (requires icons in apps/main/resources/icons/):"
echo ""
echo "    pnpm --filter main dist:mac    → build .dmg"
echo "    pnpm --filter main dist:win    → build .exe (run on Windows)"
echo ""
