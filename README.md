# Pulldog 🐕

> The faithful watchdog for your pull requests. Live PR dashboard with sound alerts, SLA tracking, and light/dark mode — built with Vue 3, Tailwind CSS, and shadcn/ui.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue](https://img.shields.io/badge/vue-3.x-4FC08D.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6.svg)
![Tailwind](https://img.shields.io/badge/tailwindcss-3.x-38BDF8.svg)

---

## Features

- **Multi-repo dashboard** — monitor open PRs across any number of GitHub repositories in one view
- **Live status** — review state (open, approved, changes requested, draft), CI check results, assignees, and reviewers
- **SLA tracking** — configurable warning and breach thresholds; rows highlight amber/red as PRs age past them
- **Comment heat** — shows comment count per PR with a 🔥 when it crosses a configurable threshold
- **Sound alerts** — synthesised chime when a new PR is opened, gong when one is merged (Web Audio API, no audio files required)
- **7-day summary bar** — total open PRs, PRs opened, PRs merged, average lead time, and merge rate
- **Light / dark / system theme** — persisted to `localStorage`, respects OS preference in system mode
- **Auto-refresh** — polls GitHub every 60 seconds; detects new and merged PRs and plays the appropriate sound
- **Filters** — by status, SLA state, repo, author, staleness (7d+), or free-text search

## Screenshots

| Dark mode | Light mode |
|-----------|------------|
| _(add your own)_ | _(add your own)_ |

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A GitHub [Personal Access Token](https://github.com/settings/tokens) with the `repo` scope

## Getting started

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/pulldog.git
cd pulldog

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), enter the repositories you want to watch, then click **Connect**.

## Configuration

All configuration lives in `.env`. Copy `.env.example` to get started:

```env
# GitHub Personal Access Token (repo scope required) — REQUIRED
VITE_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Hours until a PR row turns amber (SLA warning)
VITE_SLA_WARNING_HOURS=24

# Hours until a PR row turns red (SLA breach)
VITE_SLA_BREACH_HOURS=72

# Show 🔥 next to comment count when it reaches this number
VITE_COMMENT_FIRE_THRESHOLD=10
```

> **Note:** Vite bakes `VITE_*` variables into the bundle at build time. Restart `npm run dev` after any change to `.env`.

`VITE_GITHUB_TOKEN` is required — the app will show an error on the setup screen if it is not set. The token is never written to `localStorage`; it lives only in the compiled bundle.

## Project structure

```
pulldog/
├── src/
│   ├── components/
│   │   ├── ui/                  # shadcn-style primitive components
│   │   │   ├── Avatar.vue
│   │   │   ├── Badge.vue
│   │   │   ├── Button.vue
│   │   │   ├── Card.vue
│   │   │   ├── Dialog.vue
│   │   │   ├── Input.vue
│   │   │   ├── Label.vue
│   │   │   ├── MultiSelect.vue
│   │   │   ├── Progress.vue
│   │   │   ├── Textarea.vue
│   │   │   ├── ThemeToggle.vue
│   │   │   └── Tooltip.vue
│   │   ├── SlaIndicator.vue     # Per-row SLA badge
│   │   ├── SlaLegend.vue        # Filter bar legend
│   │   └── SummaryBar.vue       # 7-day metrics strip
│   ├── composables/
│   │   ├── useAudio.ts          # Web Audio API sounds
│   │   ├── useGithub.ts         # GitHub REST API calls
│   │   ├── useSla.ts            # SLA threshold logic
│   │   └── useTheme.ts          # Light/dark/system theme
│   ├── lib/
│   │   └── utils.ts             # cn() helper (clsx + tailwind-merge)
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── App.vue                  # Root component and dashboard layout
│   ├── base.css                 # Tailwind directives + CSS variable themes
│   ├── main.ts
│   └── vite-env.d.ts
├── .env.example
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run type-check` | Run TypeScript type checking via `vue-tsc` |

## Building for production

```bash
npm run build
```

The `dist/` directory contains a fully static build you can deploy to any static host — Vercel, Netlify, GitHub Pages, Cloudflare Pages, or your own server.

Example with the Vercel CLI:

```bash
npm i -g vercel
vercel --prod
```

## Contributing

Contributions are welcome! Here's how to get involved:

1. **Fork** the repository and create a branch from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Make your changes** and ensure the project builds and type-checks cleanly
   ```bash
   npm run type-check && npm run build
   ```
3. **Commit** using a descriptive message
   ```bash
   git commit -m "feat: add X"
   ```
4. **Push** your branch and open a **Pull Request** against `main`

Please keep pull requests focused — one feature or fix per PR makes review much easier.

### Reporting issues

Open an [issue](../../issues) and include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser and Node.js version

## License

Distributed under the [MIT License](LICENSE). See `LICENSE` for full text.

## Kiosk / TV mode

Pulldog has a built-in **fullscreen toggle** (⛶ button in the top-right corner) that uses the browser Fullscreen API to hide all browser chrome — address bar, tabs, bookmarks — leaving only the dashboard.

Press **Esc** or click the button again to exit.

For a permanent TV kiosk setup, launch Chrome or Chromium directly into kiosk mode pointing at your deployed Pulldog URL:

```bash
# Linux / Raspberry Pi
chromium-browser --kiosk --noerrdialogs --disable-infobars https://your-pulldog-url.com

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --kiosk --noerrdialogs https://your-pulldog-url.com

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk --noerrdialogs https://your-pulldog-url.com
```

Set `VITE_GITHUB_TOKEN` and pre-seed repos in `.env` before building so the dashboard connects automatically without any interaction needed on boot.
