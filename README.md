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
- **GitHub OAuth** — one-click "Connect with GitHub" via a Cloudflare Worker; no token copy-pasting required

## Screenshots

| Dark mode | Light mode |
|-----------|------------|
| _(add your own)_ | _(add your own)_ |

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for the auth worker (`npm i -g wrangler`)
- A Cloudflare account (free tier is sufficient)
- A GitHub OAuth App (see setup below)

## GitHub OAuth App setup

You need **two** OAuth Apps — one for development, one for production — because each only supports a single callback URL.

1. Go to **github.com → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Create the **development** app:
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:5173`
3. Create the **production** app:
   - Homepage URL: `https://pulldog.dev` _(or your domain)_
   - Authorization callback URL: `https://pulldog.dev`
4. Note the **Client ID** and generate a **Client secret** for each app

## Cloudflare Worker setup

The worker handles the GitHub token exchange server-side so your client secret never touches the browser.

### Deploy to production

```bash
# Authenticate with Cloudflare
wrangler login

# Set production secrets (uses the production OAuth App credentials)
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# Deploy
wrangler deploy
```

This gives you a worker URL like `https://pulldog-auth.<your-subdomain>.workers.dev`.

### Run locally

```bash
# Copy the example and fill in your dev OAuth App credentials
cp .dev.vars.example .dev.vars

# Start the local worker (runs at http://localhost:8787)
wrangler dev
```

## Getting started

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/pulldog.git
cd pulldog

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and fill in VITE_GITHUB_CLIENT_ID and VITE_GITHUB_WORKER_URL

# 4. Start the local worker in a separate terminal
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your dev OAuth App credentials
wrangler dev

# 5. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click **Connect with GitHub**.

## Configuration

### Frontend — `.env`

Copy `.env.example` to get started:

```env
# GitHub OAuth App Client ID (dev app for local, prod app for production)
VITE_GITHUB_CLIENT_ID=your_client_id

# URL of your deployed Cloudflare Worker
VITE_GITHUB_WORKER_URL=https://pulldog-auth.<your-subdomain>.workers.dev

# Override the OAuth redirect URI (defaults to window.location.origin)
VITE_GITHUB_REDIRECT_URI=

# Optional: bake a token directly into the bundle (skips the OAuth flow)
VITE_GITHUB_TOKEN=

# Hours until a PR row turns amber (SLA warning)
VITE_SLA_WARNING_HOURS=24

# Hours until a PR row turns red (SLA breach)
VITE_SLA_BREACH_HOURS=72

# Show 🔥 next to comment count when it reaches this number
VITE_COMMENT_FIRE_THRESHOLD=10
```

For local development, override `VITE_GITHUB_WORKER_URL` to point at the local worker:

```env
# .env.local (git-ignored, overrides .env in dev)
VITE_GITHUB_CLIENT_ID=your_dev_client_id
VITE_GITHUB_WORKER_URL=http://localhost:8787
```

> **Note:** Vite bakes `VITE_*` variables into the bundle at build time. Restart `npm run dev` after any change.

### Worker — `.dev.vars`

Copy `.dev.vars.example` and fill in your **dev** OAuth App credentials:

```env
GITHUB_CLIENT_ID=your_dev_client_id
GITHUB_CLIENT_SECRET=your_dev_client_secret
```

Production secrets are stored in Cloudflare (via `wrangler secret put`) and never committed.

## Project structure

```
pulldog/
├── worker/
│   └── index.js             # Cloudflare Worker — GitHub token exchange
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn-style primitive components
│   │   ├── SetupScreen.vue  # OAuth + manual token onboarding flow
│   │   ├── SettingsDialog.vue
│   │   ├── SlaLegend.vue
│   │   ├── SummaryBar.vue
│   │   └── Topbar.vue
│   ├── composables/
│   │   ├── useAudio.ts      # Web Audio API sounds
│   │   ├── useGithub.ts     # GitHub REST API calls
│   │   ├── useGithubOAuth.ts  # GitHub OAuth flow + callback handling
│   │   ├── usePersistedRepos.ts
│   │   ├── usePersistedToken.ts
│   │   ├── useSla.ts        # SLA threshold logic
│   │   └── useTheme.ts      # Light/dark/system theme
│   ├── types.ts
│   ├── App.vue
│   ├── base.css
│   ├── main.ts
│   └── vite-env.d.ts
├── .dev.vars.example        # Worker local secrets template
├── .env.example             # Frontend env template
├── wrangler.toml            # Cloudflare Worker config
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
| `wrangler dev` | Run the auth worker locally on port 8787 |
| `wrangler deploy` | Deploy the worker to Cloudflare |

## Building for production

```bash
npm run build
```

The `dist/` directory is a fully static build. Deploy it to Cloudflare Pages, Vercel, Netlify, or any static host.

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

For a permanent TV kiosk setup, launch Chrome or Chromium directly into kiosk mode:

```bash
# Linux / Raspberry Pi
chromium-browser --kiosk --noerrdialogs --disable-infobars https://pulldog.dev

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --kiosk --noerrdialogs https://pulldog.dev

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk --noerrdialogs https://pulldog.dev
```

Set `VITE_GITHUB_TOKEN` in `.env` before building to pre-seed a token so the dashboard connects automatically on boot without any interaction.
