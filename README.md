# Murmur — Personal Broadcaster

> Send bulk WhatsApp messages and emails from **your own accounts** — no SaaS, no subscriptions, no data leaving your machine.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Open Source](https://img.shields.io/badge/open--source-forever%20free-brightgreen)

---

## What is Murmur?

Murmur is a desktop app that lets you send personalized bulk messages from **your own** WhatsApp number and Gmail account. You import contacts from a CSV, write a message with `{{name}}` variables, pick a time, and Murmur handles the rest — entirely on your machine.

- ✅ Your WhatsApp number sends the messages (via QR scan)
- ✅ Your Gmail account sends the emails (via App Password)
- ✅ Your contacts stay in a local SQLite database
- ✅ Scheduled sends run in the background via system tray
- ✅ No cloud, no subscription, no data shared with anyone

---

## Download

Head to [Releases](https://github.com/M-Hammad-Faisal/murmur/releases) and grab the latest:

| Platform                          | File                          |
| --------------------------------- | ----------------------------- |
| macOS Apple Silicon (M1/M2/M3/M4) | `Murmur-x.x.x-arm64.dmg`      |
| macOS Intel                       | `Murmur-x.x.x-x64.dmg`        |
| Windows 64-bit                    | `Murmur-x.x.x-Setup.exe`      |
| Windows 32-bit                    | `Murmur-x.x.x-ia32-Setup.exe` |
| Linux (any distro)                | `Murmur-x.x.x.AppImage`       |
| Linux Debian/Ubuntu               | `murmur_x.x.x.deb`            |

> **WhatsApp** requires Google Chrome installed. [Download here](https://www.google.com/chrome).

---

## Local Development Setup

### Prerequisites

- Node.js v24+
- pnpm v10+

```bash
# Install pnpm if needed
npm install -g pnpm

# Clone
git clone https://github.com/M-Hammad-Faisal/murmur.git
cd murmur

# Install all dependencies
pnpm install

# Start dev mode (Next.js + Express + Electron all at once)
pnpm dev
```

---

## CSV Format

```csv
name,phone,email,tag,birthday
Ahmed Khan,+923001234567,ahmed@gmail.com,family,1990-03-15
Sara Ali,+923009876543,sara@email.com,client,1988-07-22
```

- `name` — required
- `phone` — required for WhatsApp sends
- `email` — required for Gmail sends
- `tag` — optional, used for group targeting
- `birthday` — optional, enables birthday scheduling
- Any extra column becomes a `{{variable}}` in your message

---

## Tech Stack

| Layer         | Tech                                     |
| ------------- | ---------------------------------------- |
| Desktop shell | Electron 41                              |
| UI            | Next.js 16 (App Router, static export)   |
| Backend       | Express 5 + TypeScript                   |
| Database      | SQLite via better-sqlite3                |
| Email         | Nodemailer (Gmail SMTP)                  |
| WhatsApp      | whatsapp-web.js                          |
| Scheduler     | node-cron                                |
| Monorepo      | pnpm workspaces + Turborepo              |
| Linting       | ESLint 9 flat config + typescript-eslint |
| Formatting    | Prettier 3                               |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). PRs welcome!

---

## License

[MIT](./LICENSE) — free forever.
