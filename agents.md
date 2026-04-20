# Pulldog — Agent Context

## What this is

Pulldog is a **client-side Vue 3 SPA** (no backend) that renders a live PR dashboard for GitHub repositories. All data flows directly from the browser to the GitHub REST API. There is no server, no database, and no auth layer beyond a GitHub Personal Access Token stored in localStorage or baked in at build time via `.env`.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Vue 3 + Composition API + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS 3 + CSS custom properties for theming |
| UI primitives | Radix Vue (headless) + class-variance-authority |
| Icons | Lucide Vue Next |
| State | Composables (no Vuex / Pinia) |
| Persistence | localStorage only |
| Audio | Web Audio API (synthesised, no asset files) |

## Project layout

```
src/
  App.vue                   # Root: orchestrates data fetching, polling, state
  types.ts                  # Shared interfaces (PullRequest, FilterState, etc.)
  main.ts                   # Vue bootstrap
  base.css                  # Tailwind directives + CSS variables (light/dark)
  components/
    ui/                     # Primitive components (Button, Badge, Dialog, …)
    PrTable.vue             # Main PR data table with sorting
    FilterBar.vue           # Status / repo / author filters
    SummaryBar.vue          # Configurable-period metrics (created, merged, lead time)
    SlaIndicator.vue        # Per-row SLA badge
    SlaLegend.vue           # Filter legend
    SetupScreen.vue         # First-run token + repo selection
    SettingsDialog.vue      # Edit repos/token at runtime
    Topbar.vue              # Header: stats, sound toggle, refresh
  composables/
    useGithub.ts            # All GitHub REST API calls
    useSla.ts               # SLA threshold logic
    useAudio.ts             # Bell / gong synthesis
    useTheme.ts             # Light / dark / system toggle
    usePersistedToken.ts    # Token management (env vs localStorage)
    usePersistedRepos.ts    # Repo list persistence
    useFullscreen.ts        # Browser Fullscreen API
  lib/utils.ts              # cn() (clsx + tailwind-merge)
```

## Environment variables

Vite bakes these into the bundle at build time. Prefix `VITE_` required.

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_GITHUB_TOKEN` | — | GitHub PAT (repo scope). If absent, user enters it via UI and it's saved to localStorage. |
| `VITE_SLA_WARNING_HOURS` | `24` | Hours before a PR row turns amber |
| `VITE_SLA_BREACH_HOURS` | `72` | Hours before a PR row turns red |
| `VITE_COMMENT_FIRE_THRESHOLD` | `10` | Comment count at which 🔥 appears |
| `VITE_TEST_MODE` | `false` | Shows sound test buttons in toolbar |

See `.env.example` for the canonical list. Always update `.env.example` and `README.md` when adding or removing env vars.

## Data flow

1. `App.vue` calls `useGithub().fetchRepo()` for each configured repo via `Promise.allSettled()` (partial failures don't crash).
2. Results stored in `prData: Record<string, PullRequest[]>` keyed by `owner/repo`.
3. A `computed()` flattens + filters + sorts into the rows `PrTable` renders.
4. `App.vue` polls every 60 s, diffs previous states, plays audio on new / merged PRs.
5. Metrics are fetched separately via `fetchRecentActivity()` and `fetchReviewStats()`.

## GitHub API details (useGithub.ts)

- Pagination: up to 5 pages × 100 items; early-exit when items fall outside time window.
- Open PRs are enriched with review data to determine `reviewStatus`.
- `ReviewStatus` values: `"open" | "approved" | "draft" | "changes" | "merged"`.
- Token passed as `Authorization: Bearer <token>` header.

## Theming

CSS custom properties in `base.css` drive all colours for both light and dark modes. Tailwind extends these via `tailwind.config.js`. Status dot colours (`.dot-open`, `.dot-approved`, etc.) and row highlights (`.row-approved`, `.row-changes`) are defined there. Flash animations (`.flash-new`, `.flash-merged`) fire on state transitions.

## Key conventions

- **Composables own logic; App.vue owns orchestration.** Don't reach into composables from sibling components — bubble state up.
- **No Vuex / Pinia.** Reactive state lives in composable `ref`/`computed` and is passed as props.
- **`cn()` for class strings.** Always use `cn()` from `src/lib/utils.ts` when merging Tailwind classes.
- **TypeScript strict mode.** All new code must pass `npm run type-check`.
- **Update `.env.example` and `README.md`** whenever env vars or config change.

## Common commands

```bash
npm run dev          # Dev server at localhost:5173
npm run build        # Production build → dist/
npm run type-check   # Type checking (no emit)
npm run lint         # ESLint
npm run format       # Prettier
```

## Deployment

`dist/` is fully static. Deploy to Vercel, Netlify, GitHub Pages, or any static host. Pre-set `VITE_GITHUB_TOKEN` before building to embed the token for single-user / kiosk deployments.
