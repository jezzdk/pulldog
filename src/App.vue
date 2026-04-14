<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from 'vue'
import { useAudio }   from '@/composables/useAudio'
import { useGithub }  from '@/composables/useGithub'
import { slaStatus }  from '@/composables/useSla'
import { useTheme }   from '@/composables/useTheme'
import type { PullRequest, ActivityMetrics, Toast, ReviewStatus, CheckStatus } from '@/types'

import Button       from '@/components/ui/Button.vue'
import Badge        from '@/components/ui/Badge.vue'
import Card         from '@/components/ui/Card.vue'
import Input        from '@/components/ui/Input.vue'
import Textarea     from '@/components/ui/Textarea.vue'
import Label        from '@/components/ui/Label.vue'
import Dialog       from '@/components/ui/Dialog.vue'
import Avatar       from '@/components/ui/Avatar.vue'
import Tooltip      from '@/components/ui/Tooltip.vue'
import ThemeToggle  from '@/components/ui/ThemeToggle.vue'
import MultiSelect  from '@/components/ui/MultiSelect.vue'
import SlaIndicator from '@/components/SlaIndicator.vue'
import SlaLegend    from '@/components/SlaLegend.vue'
import SummaryBar   from '@/components/SummaryBar.vue'

import {
  RefreshCw, Settings, Volume2, VolumeX,
  GitPullRequest, CheckCircle2, Zap,
} from 'lucide-vue-next'

// Boot theme before anything renders
useTheme()

// ── constants ────────────────────────────────────────────────────
const COMMENT_FIRE_THRESHOLD = Number(import.meta.env.VITE_COMMENT_FIRE_THRESHOLD ?? 10)

interface FilterOption { v: string; l: string }
const FILTERS: FilterOption[] = [
  { v: 'all',        l: 'All' },
  { v: 'open',       l: 'Open' },
  { v: 'approved',   l: 'Approved' },
  { v: 'failing',    l: 'Failing' },
  { v: 'draft',      l: 'Draft' },
  { v: 'changes',    l: 'Changes' },
  { v: 'sla-warn',   l: '⚠ Warning' },
  { v: 'sla-breach', l: '🔴 Breach' },
]

// ── auth / setup ─────────────────────────────────────────────────
interface SetupForm { token: string; repos: string }
const connected    = ref(false)
const loading      = ref(false)
const setupError   = ref('')
const setup        = ref<SetupForm>({ token: '', repos: '' })
const showSettings = ref(false)

// ── data ─────────────────────────────────────────────────────────
type RepoEntry = PullRequest[] | { error: string }
const prData      = ref<Record<string, RepoEntry>>({})
const knownIds    = ref<Record<string, Set<number>>>({})
const lastUpdated = ref('')

// ── filters ──────────────────────────────────────────────────────
const activeFilter    = ref('all')
const staleOnly       = ref(false)
const searchQ         = ref('')
const selectedRepos   = ref<string[]>([])
const selectedAuthors = ref<string[]>([])

// ── activity metrics ─────────────────────────────────────────────
const activityData = ref<ActivityMetrics>({
  created7d: null, merged7d: null, avgLeadTimeHours: null, activityLoading: true,
})

// ── toasts ───────────────────────────────────────────────────────
const toasts = ref<Toast[]>([])
let toastId = 0

function addToast(type: Toast['type'], icon: string, title: string, sub: string): void {
  const id = ++toastId
  toasts.value.push({ id, type, icon, title, sub, out: false })
  setTimeout(() => {
    const t = toasts.value.find(x => x.id === id)
    if (t) t.out = true
    setTimeout(() => { toasts.value = toasts.value.filter(x => x.id !== id) }, 300)
  }, 4500)
}

// ── audio / github ────────────────────────────────────────────────
const { soundEnabled, toggle: toggleSound, playNewPR, playMerged } = useAudio()
const token  = computed(() => setup.value.token)
const { fetchRepo, checkIfMerged, fetchRecentActivity } = useGithub(token)
const repos  = computed<string[]>(() =>
  setup.value.repos.split('\n').map(r => r.trim()).filter(Boolean),
)

// ── computed stats ────────────────────────────────────────────────
const allPRs = computed<PullRequest[]>(() =>
  Object.values(prData.value)
    .filter((v): v is PullRequest[] => Array.isArray(v))
    .flat(),
)

const repoOptions = computed<string[]>(() =>
  repos.value.filter(r => Array.isArray(prData.value[r])),
)

const authorOptions = computed<string[]>(() => {
  const logins = new Set(allPRs.value.map(p => p.author.login))
  return [...logins].sort((a, b) => a.localeCompare(b))
})

const totalOpen    = computed(() => allPRs.value.length)
const statOpen     = computed(() => allPRs.value.filter(p => p.reviewStatus === 'open').length)
const statApproved = computed(() => allPRs.value.filter(p => p.reviewStatus === 'approved').length)
const statFailing  = computed(() => allPRs.value.filter(p => p.reviewStatus === 'failing').length)
const statWarn     = computed(() => allPRs.value.filter(p => slaStatus(p.createdAt) === 'warning').length)
const statBreach   = computed(() => allPRs.value.filter(p => slaStatus(p.createdAt) === 'breach').length)

interface FilteredGroup { repo: string; prs: PullRequest[]; error: string | null }
const filteredGroups = computed<FilteredGroup[]>(() =>
  repos.value
    .filter(repo => selectedRepos.value.length === 0 || selectedRepos.value.includes(repo))
    .map(repo => {
      const entry = prData.value[repo]
      if (!entry)                         return { repo, prs: [], error: null }
      if (!Array.isArray(entry))          return { repo, prs: [], error: entry.error }

      let prs: PullRequest[] = entry
      if      (activeFilter.value === 'sla-warn')   prs = prs.filter(p => slaStatus(p.createdAt) === 'warning')
      else if (activeFilter.value === 'sla-breach')  prs = prs.filter(p => slaStatus(p.createdAt) === 'breach')
      else if (activeFilter.value !== 'all')         prs = prs.filter(p => p.reviewStatus === activeFilter.value)

      if (staleOnly.value)
        prs = prs.filter(p => Date.now() - p.createdAt.getTime() > 7 * 86_400_000)

      if (selectedAuthors.value.length > 0)
        prs = prs.filter(p => selectedAuthors.value.includes(p.author.login))

      if (searchQ.value) {
        const q = searchQ.value.toLowerCase()
        prs = prs.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.author.login.toLowerCase().includes(q) ||
          String(p.number).includes(q),
        )
      }
      return { repo, prs, error: null }
    }),
)

const anyVisible = computed(() =>
  filteredGroups.value.some(g => g.prs.length > 0 || g.error !== null),
)

// ── data loading ──────────────────────────────────────────────────
async function loadAll(isRefresh = false): Promise<void> {
  loading.value = true
  const results = await Promise.allSettled(repos.value.map(fetchRepo))
  let anyOk = false

  for (let i = 0; i < results.length; i++) {
    const repo = repos.value[i]!
    const r    = results[i]!

    if (r.status === 'fulfilled') {
      const fresh = r.value
      anyOk = true

      if (isRefresh && knownIds.value[repo]) {
        const prevIds  = knownIds.value[repo]!
        const freshIds = new Set(fresh.map(p => p.id))

        for (const p of fresh) {
          if (!prevIds.has(p.id)) {
            playNewPR()
            addToast('new', '🔔', 'New pull request', `${repo} #${p.number}: ${p.title}`)
            await nextTick()
            p._flashClass = 'flash-new'
            setTimeout(() => { p._flashClass = '' }, 900)
          }
        }

        for (const id of prevIds) {
          if (!freshIds.has(id)) {
            const existing = prData.value[repo]
            const prev = Array.isArray(existing) ? existing.find(p => p.id === id) : undefined
            if (prev) {
              void checkIfMerged(repo, prev.number).then(merged => {
                if (merged) {
                  playMerged()
                  addToast('merged', '🎉', 'PR merged!', `${repo} #${prev.number}: ${prev.title}`)
                }
              })
            }
          }
        }
      }

      knownIds.value[repo] = new Set(fresh.map(p => p.id))
      prData.value[repo]   = fresh
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : 'Failed to load'
      prData.value[repo] = { error: msg }
    }
  }

  if (!isRefresh && !anyOk) {
    const first = results[0]
    const msg = first?.status === 'rejected' && first.reason instanceof Error
      ? first.reason.message
      : 'Failed to connect'
    throw new Error(msg)
  }

  loading.value    = false
  lastUpdated.value = new Date().toLocaleTimeString()
}

async function loadActivity(): Promise<void> {
  activityData.value.activityLoading = true
  const results = await Promise.allSettled(repos.value.map(fetchRecentActivity))

  let totalCreated = 0, totalMerged = 0, totalLeadMs = 0, mergedWithTime = 0
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { created7d, merged7d, avgLeadTimeHours } = r.value
      totalCreated += created7d
      totalMerged  += merged7d
      if (avgLeadTimeHours !== null) {
        totalLeadMs    += avgLeadTimeHours * 3_600_000 * merged7d
        mergedWithTime += merged7d
      }
    }
  }

  activityData.value = {
    created7d:        totalCreated,
    merged7d:         totalMerged,
    avgLeadTimeHours: mergedWithTime > 0 ? totalLeadMs / mergedWithTime / 3_600_000 : null,
    activityLoading:  false,
  }
}

async function connect(): Promise<void> {
  setupError.value = ''
  if (!setup.value.token || !setup.value.repos.trim()) {
    setupError.value = 'Please enter a token and at least one repository.'
    return
  }
  loading.value = true
  try {
    await loadAll(false)
    void loadActivity()
    connected.value = true
    startPolling()
  } catch (e) {
    setupError.value = e instanceof Error ? e.message : 'Unknown error'
  }
  loading.value = false
}

async function refreshAll(): Promise<void> {
  if (!loading.value) {
    await loadAll(true)
    void loadActivity()
  }
}

async function saveSettings(): Promise<void> {
  showSettings.value    = false
  prData.value          = {}
  knownIds.value        = {}
  selectedRepos.value   = []
  selectedAuthors.value = []
  activityData.value    = { created7d: null, merged7d: null, avgLeadTimeHours: null, activityLoading: true }
  await loadAll(false)
  void loadActivity()
  startPolling()
}

let pollTimer: ReturnType<typeof setInterval> | null = null
function startPolling(): void {
  if (pollTimer !== null) clearInterval(pollTimer)
  pollTimer = setInterval(() => { void loadAll(true); void loadActivity() }, 60_000)
}
onUnmounted(() => { if (pollTimer !== null) clearInterval(pollTimer) })

// ── display helpers ───────────────────────────────────────────────
function setFilter(v: string): void { activeFilter.value = v; staleOnly.value = false }

const STATUS_LABELS: Record<ReviewStatus, string> = {
  open: 'Open', approved: 'Approved', failing: 'Failing',
  draft: 'Draft', changes: 'Changes', merged: 'Merged',
}
const statusLabel = (pr: PullRequest): string => STATUS_LABELS[pr.reviewStatus] ?? 'Open'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'purple'
const STATUS_BADGE_VARIANT: Partial<Record<ReviewStatus, BadgeVariant>> = {
  open:     'default',
  approved: 'success',
  failing:  'destructive',
  draft:    'secondary',
  changes:  'outline',
}

interface ChecksInfo { variant: BadgeVariant; label: string }
const CHECKS_MAP: Record<string, ChecksInfo> = {
  pass:    { variant: 'success',     label: '✓ Passing' },
  fail:    { variant: 'destructive', label: '✗ Failing' },
  pending: { variant: 'warning',     label: '⏳ Running' },
}
const checksVariant = (c: CheckStatus): BadgeVariant => (c ? CHECKS_MAP[c]?.variant : undefined) ?? 'outline'
const checksLabel   = (c: CheckStatus): string       => (c ? CHECKS_MAP[c]?.label   : undefined) ?? '—'

function ageText(d: Date): string {
  const m = (Date.now() - d.getTime()) / 60_000
  if (m < 60)   return `${Math.floor(m)}m`
  const h = m / 60;  if (h < 24)  return `${Math.floor(h)}h`
  const dy = h / 24; if (dy < 30) return `${Math.floor(dy)}d`
  return `${Math.floor(dy / 30)}mo`
}

function ageClass(d: Date): string {
  const days = (Date.now() - d.getTime()) / 86_400_000
  if (days < 1) return 'text-emerald-400'
  if (days < 3) return 'text-muted-foreground'
  if (days < 7) return 'text-yellow-400'
  return 'text-destructive'
}

function hex2rgb(hex: string): string {
  const n = parseInt(hex, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

function openPR(url: string): void {
  window.open(url, '_blank')
}

function slaRowCss(createdAt: Date): string {
  const s = slaStatus(createdAt)
  if (s === 'breach')  return 'row-sla-breach'
  if (s === 'warning') return 'row-sla-warning'
  return ''
}
</script>

<template>

<!-- ── SETUP SCREEN ──────────────────────────────────────────── -->
<div
  v-if="!connected"
  class="min-h-screen flex items-center justify-center p-6
         bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(217_89%_65%_/_0.07)_0%,transparent_70%)]"
>
  <Card class="w-full max-w-[480px] p-10">
    <div class="flex items-center gap-3 mb-9">
      <div class="h-9 w-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
        <Zap class="h-4 w-4" />
      </div>
      <div>
        <div class="font-mono text-base font-semibold text-foreground tracking-tight">Pulldog</div>
        <div class="text-[11px] text-muted-foreground mt-0.5">Live dashboard · sound alerts · SLA tracking</div>
      </div>
    </div>

    <div class="space-y-5">
      <div class="space-y-1.5">
        <Label>GitHub Personal Access Token</Label>
        <Input type="password" v-model="setup.token" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" @keyup.enter="connect" />
        <p class="font-mono text-[10.5px] text-muted-foreground">
          Needs <code class="text-foreground/70">repo</code> scope — create at github.com/settings/tokens
        </p>
      </div>

      <div class="space-y-1.5">
        <Label>Repositories</Label>
        <Textarea v-model="setup.repos" placeholder="owner/repo&#10;owner/another-repo" class="min-h-[88px]" />
        <p class="font-mono text-[10.5px] text-muted-foreground">
          One per line — format: <code class="text-foreground/70">owner/repo</code>
        </p>
      </div>

      <Button class="w-full mt-2" :disabled="loading" @click="connect">
        <RefreshCw v-if="loading" class="h-3 w-3 animate-spin" />
        <span>{{ loading ? 'Connecting…' : 'Connect & Start Watching →' }}</span>
      </Button>

      <p
        v-if="setupError"
        class="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2
               font-mono text-[11px] text-destructive"
      >
        {{ setupError }}
      </p>
    </div>
  </Card>
</div>

<!-- ── DASHBOARD ─────────────────────────────────────────────── -->
<template v-else>

  <!-- Topbar -->
  <header class="sticky top-0 z-40 flex h-12 items-center justify-between
                 border-b border-border bg-background/90 backdrop-blur-md px-5">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 font-mono text-sm font-semibold text-foreground">
        <Zap class="h-3.5 w-3.5 text-primary" />
        Pulldog
      </div>
      <div class="hidden sm:flex items-center gap-1.5">
        <Badge variant="default">{{ statOpen }} open</Badge>
        <Badge variant="success">{{ statApproved }} approved</Badge>
        <Badge variant="destructive" v-if="statFailing > 0">{{ statFailing }} failing</Badge>
        <Badge variant="warning"     v-if="statWarn   > 0">⚠ {{ statWarn }} warn</Badge>
        <Badge variant="destructive" v-if="statBreach > 0" class="animate-breach-pulse">
          🔴 {{ statBreach }} breach
        </Badge>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <span v-if="lastUpdated" class="hidden lg:block font-mono text-[10px] text-muted-foreground/60">
        {{ lastUpdated }}
      </span>
      <Button variant="outline" size="sm" :class="loading ? 'opacity-60' : ''" @click="refreshAll">
        <RefreshCw class="h-3 w-3" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </Button>
      <Button
        variant="outline" size="sm"
        :class="soundEnabled ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' : ''"
        @click="toggleSound"
      >
        <Volume2 v-if="soundEnabled" class="h-3 w-3" />
        <VolumeX v-else              class="h-3 w-3" />
        {{ soundEnabled ? 'Sound on' : 'Sound off' }}
      </Button>
      <ThemeToggle />
      <Button variant="ghost" size="icon" @click="showSettings = true">
        <Settings class="h-3.5 w-3.5" />
      </Button>
    </div>
  </header>

  <!-- Sound status strip -->
  <div class="flex items-center gap-2.5 border-b border-border bg-card px-5 py-2">
    <span class="relative flex h-1.5 w-1.5">
      <span
        v-if="soundEnabled"
        class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"
      />
      <span
        class="relative inline-flex rounded-full h-1.5 w-1.5"
        :class="soundEnabled ? 'bg-emerald-400' : 'bg-muted-foreground/30'"
      />
    </span>
    <span class="font-mono text-[10.5px] text-muted-foreground">
      {{ soundEnabled ? 'Sound alerts active — chime on new PR · gong on merge' : 'Sound muted' }}
    </span>
  </div>

  <!-- Summary bar -->
  <SummaryBar
    :total-open="totalOpen"
    :created7d="activityData.created7d"
    :merged7d="activityData.merged7d"
    :avg-lead-time-hours="activityData.avgLeadTimeHours"
    :loading="activityData.activityLoading"
  />

  <!-- Filter bar -->
  <div class="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-2.5">
    <span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mr-1">Filter:</span>

    <button
      v-for="f in FILTERS" :key="f.v"
      @click="setFilter(f.v)"
      class="rounded-full border px-3 py-0.5 font-mono text-[11px] transition-colors whitespace-nowrap"
      :class="activeFilter === f.v && !staleOnly
        ? 'border-primary/50 bg-primary/10 text-primary'
        : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'"
    >{{ f.l }}</button>

    <div class="h-4 w-px bg-border mx-1" />

    <button
      @click="staleOnly = !staleOnly"
      class="rounded-full border px-3 py-0.5 font-mono text-[11px] transition-colors"
      :class="staleOnly
        ? 'border-primary/50 bg-primary/10 text-primary'
        : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'"
    >Stale 7d+</button>

    <SlaLegend class="ml-1" />

    <div class="h-4 w-px bg-border mx-1" />

    <MultiSelect label="Repo"   :options="repoOptions"   v-model:selected="selectedRepos" />
    <MultiSelect label="Author" :options="authorOptions" v-model:selected="selectedAuthors" />

    <Input v-model="searchQ" placeholder="Search PRs…" class="ml-auto w-44 h-7" />
  </div>

  <!-- PR groups -->
  <main class="p-5 flex flex-col gap-6">
    <div
      v-if="loading && allPRs.length === 0"
      class="flex items-center justify-center gap-2 py-16 font-mono text-xs text-muted-foreground"
    >
      <RefreshCw class="h-3.5 w-3.5 animate-spin" />
      Loading pull requests…
    </div>

    <template v-else>
      <div v-for="group in filteredGroups" :key="group.repo">

        <!-- Repo header -->
        <div class="flex items-center gap-2 pb-2 mb-1 border-b border-border">
          <GitPullRequest class="h-3.5 w-3.5 text-muted-foreground" />
          <a
            :href="'https://github.com/' + group.repo"
            target="_blank"
            class="font-mono text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
          >{{ group.repo }}</a>
          <Badge variant="secondary" class="text-[10px] px-1.5 py-0">{{ group.prs.length }}</Badge>
          <span v-if="group.error" class="font-mono text-[11px] text-destructive ml-1">⚠ {{ group.error }}</span>
        </div>

        <!-- Table -->
        <div v-if="group.prs.length" class="rounded-lg border border-border overflow-hidden">
          <table class="w-full border-collapse text-xs">
            <thead>
              <tr class="border-b border-border bg-muted/30">
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-32">Status</th>
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2">Pull Request</th>
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-20">Assignee</th>
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-24">Reviewers</th>
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-28 hidden md:table-cell">Checks</th>
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-28 hidden lg:table-cell">Labels</th>
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-20 hidden sm:table-cell">Comments</th>
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-12">Age</th>
                <th class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-36">SLA</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="pr in group.prs"
                :key="pr.id"
                :class="['border-b border-border last:border-0 transition-colors cursor-pointer hover:bg-muted/20',
                         pr._flashClass, slaRowCss(pr.createdAt)]"
                @click="openPR(pr.url)"
              >
                <!-- Status -->
                <td class="px-3 py-2.5">
                  <div class="flex items-center gap-1.5">
                    <div class="h-1.5 w-1.5 rounded-full shrink-0" :class="`dot-${pr.reviewStatus}`" />
                    <Badge :variant="STATUS_BADGE_VARIANT[pr.reviewStatus] ?? 'secondary'" class="text-[10px]">
                      {{ statusLabel(pr) }}
                    </Badge>
                  </div>
                </td>

                <!-- Title -->
                <td class="px-3 py-2.5 max-w-xs">
                  <a
                    :href="pr.url" target="_blank" @click.stop
                    class="block truncate font-medium text-foreground hover:text-primary transition-colors leading-snug"
                  >{{ pr.title }}</a>
                  <span class="font-mono text-[10px] text-muted-foreground">#{{ pr.number }} · {{ pr.author.login }}</span>
                </td>

                <!-- Assignee -->
                <td class="px-3 py-2.5">
                  <div v-if="pr.assignees.length" class="flex -space-x-1.5">
                    <Tooltip v-for="u in pr.assignees" :key="u.login" :text="u.login">
                      <Avatar :src="u.avatar_url + '&s=48'" :alt="u.login" />
                    </Tooltip>
                  </div>
                  <span v-else class="font-mono text-[11px] text-muted-foreground/40">—</span>
                </td>

                <!-- Reviewers -->
                <td class="px-3 py-2.5">
                  <div v-if="pr.requestedReviewers.length" class="flex -space-x-1.5">
                    <Tooltip v-for="u in pr.requestedReviewers" :key="u.login" :text="u.login">
                      <Avatar :src="u.avatar_url + '&s=48'" :alt="u.login" />
                    </Tooltip>
                  </div>
                  <span v-else class="font-mono text-[11px] text-muted-foreground/40">—</span>
                </td>

                <!-- Checks -->
                <td class="px-3 py-2.5 hidden md:table-cell">
                  <Badge :variant="checksVariant(pr.checks)" class="text-[10px]">
                    {{ checksLabel(pr.checks) }}
                  </Badge>
                </td>

                <!-- Labels -->
                <td class="px-3 py-2.5 hidden lg:table-cell">
                  <div v-if="pr.labels.length" class="flex flex-wrap gap-1">
                    <span
                      v-for="l in pr.labels.slice(0, 2)" :key="l.name"
                      class="inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] whitespace-nowrap"
                      :style="{
                        borderColor: `rgba(${hex2rgb(l.color)}, 0.4)`,
                        color:        `#${l.color}`,
                        background:   `rgba(${hex2rgb(l.color)}, 0.07)`,
                      }"
                    >{{ l.name }}</span>
                  </div>
                  <span v-else class="font-mono text-[11px] text-muted-foreground/40">—</span>
                </td>

                <!-- Comments -->
                <td class="px-3 py-2.5 hidden sm:table-cell">
                  <div
                    class="flex items-center gap-1 font-mono text-[11px]"
                    :class="pr.commentCount >= COMMENT_FIRE_THRESHOLD
                      ? 'text-orange-400 font-semibold'
                      : 'text-muted-foreground'"
                  >
                    <span>{{ pr.commentCount }}</span>
                    <span
                      v-if="pr.commentCount >= COMMENT_FIRE_THRESHOLD"
                      class="text-sm leading-none"
                      title="Hot PR!"
                    >🔥</span>
                  </div>
                </td>

                <!-- Age -->
                <td class="px-3 py-2.5">
                  <span class="font-mono text-[11px]" :class="ageClass(pr.createdAt)">
                    {{ ageText(pr.createdAt) }}
                  </span>
                </td>

                <!-- SLA -->
                <td class="px-3 py-2.5">
                  <SlaIndicator :created-at="pr.createdAt" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- Empty state -->
      <div v-if="!anyVisible" class="flex flex-col items-center justify-center gap-2 py-20">
        <CheckCircle2 class="h-8 w-8 text-muted-foreground/30" />
        <p class="text-sm font-medium text-muted-foreground">No matching pull requests</p>
        <p class="font-mono text-[11px] text-muted-foreground/50">Adjust filters or wait for new activity</p>
      </div>
    </template>
  </main>

  <footer class="border-t border-border px-5 py-3 font-mono text-[10px] text-muted-foreground/40 text-right">
    Pulldog · auto-refresh every 60s
  </footer>

  <!-- Toasts -->
  <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
    <Transition
      v-for="t in toasts" :key="t.id"
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-3 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0 translate-y-1 scale-97"
    >
      <Card
        v-if="!t.out"
        class="flex items-center gap-3 px-4 py-3 min-w-[240px] max-w-sm shadow-xl"
        :class="t.type === 'merged' ? 'border-purple-500/30' : 'border-primary/30'"
      >
        <span class="text-base shrink-0">{{ t.icon }}</span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-foreground text-xs">{{ t.title }}</div>
          <div class="font-mono text-[10.5px] text-muted-foreground truncate">{{ t.sub }}</div>
        </div>
      </Card>
    </Transition>
  </div>

  <!-- Settings dialog -->
  <Dialog :open="showSettings" @close="showSettings = false">
    <div class="space-y-5">
      <h2 class="font-mono text-sm font-semibold text-foreground">Settings</h2>
      <div class="space-y-1.5">
        <Label>GitHub Token</Label>
        <Input type="password" v-model="setup.token" />
      </div>
      <div class="space-y-1.5">
        <Label>Repositories</Label>
        <Textarea v-model="setup.repos" class="min-h-[110px]" />
      </div>
      <div class="flex gap-2 pt-1">
        <Button variant="outline" class="flex-1" @click="showSettings = false">Cancel</Button>
        <Button class="flex-1" @click="saveSettings">Save &amp; Reload</Button>
      </div>
    </div>
  </Dialog>

</template>
</template>
