# Contributing to Murmur

Thanks for your interest in contributing! Murmur is open source and always free.

## Getting Started

1. Fork the repo
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/murmur.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feat/your-feature`
5. Make your changes
6. Run lint + typecheck: `pnpm lint && pnpm typecheck`
7. Push and open a PR against `main`

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add Telegram channel support`
- `fix: correct WhatsApp phone formatting for UK numbers`
- `docs: update CSV format in README`
- `chore: bump electron to 41.1`

## Code Standards

- TypeScript strict mode — no `any`
- ESLint 9 flat config — run `pnpm lint` before pushing
- Prettier 3 — run `pnpm format` to auto-fix
- Husky pre-commit hook enforces both automatically

## Reporting Bugs

Open a GitHub issue with:

- OS and version
- Steps to reproduce
- Expected vs actual behavior
