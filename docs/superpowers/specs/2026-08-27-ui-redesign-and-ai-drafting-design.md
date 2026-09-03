# ApplyFlow: UI/UX Redesign + AI Answer Drafting (Phase 2)

## Context

ApplyFlow (the job application autofiller extension) works, but two problems
surfaced through real use:

1. **The side panel is one long scrolling page.** Daily actions (Fill this
   page, Attach documents, Log to Notion) sit directly above the entire
   profile editor, documents settings, and Notion settings, all expanded at
   once. It works, but it doesn't feel like a finished product — it feels
   like a form dump.
2. **Setup is intimidating for non-technical users.** A friend opening this
   for the first time sees the same wall of sections before they've done
   anything, with no guidance on what's required vs. optional.

A "sign in with Notion"-style OAuth flow was considered to ease integration
setup, but was explicitly ruled out: it requires a backend server to hold
the OAuth client secret (a secret cannot live inside distributable extension
code), which is real infrastructure to build, host, and maintain — a
different scope of commitment than "a personal tool, polished." The user
decided to stay local-only/personal and instead make the *existing* manual
setup steps as unintimidating as possible.

Separately, this redesign is the right moment to fold in **Phase 2** (AI-
drafted answers to free-text application questions), since it needs the same
new "Setup" surface (a projects/skills directory) and shouldn't be built as
a bolt-on after the redesign is done.

## Goals

- Cut the daily-use surface down to just the actions someone uses every
  time, with a separate place for setup/configuration.
- Make first-time setup feel guided rather than dumped-on, without requiring
  any backend infrastructure.
- Give the UI a deliberate, designed visual identity (typography, custom
  icons, color-tinted action cards) instead of a stack of identical gray
  buttons and paragraphs.
- Add AI-drafted answers for free-text questions, using the same profile
  storage model already in place (no new storage mechanism, no RAG/vector
  search — the directory is small enough to hand an LLM directly).

## Non-goals (explicitly out of scope for this plan)

- OAuth / "sign in with X" flows, or any backend server.
- Chrome Web Store publishing, landing page, or other distribution work.
- Resume/LinkedIn-import parsing (a bigger feature that would need either an
  LLM call or a dedicated parser; not required for AI drafting to work).
- Vector search / embeddings-based retrieval for the projects directory.

## Architecture: two-mode panel

The side panel gets two modes, switched by local component state (no
router library needed — this is small enough for a simple `view` state
variable):

- **Daily view** (default once a profile exists): a compact dashboard of
  action cards — Fill this page, Attach documents, Log to Notion, Draft
  answers — each showing its own result inline. A settings gear icon in the
  header enters Setup.
- **Setup view**: holds the profile editor, documents folder link, Notion
  settings, and the new AI-drafting settings. Reached two ways:
  - **First run** (no profile saved yet): opens automatically as a
    step-by-step **wizard** — one section per screen, Next/Back, a slim
    progress indicator, most steps skippable.
  - **Later** (via the gear icon): opens the *same* section components, but
    laid out as plain tabs (Profile / Documents / Notion / AI) navigated
    freely — no wizard ceremony for a one-field edit.

Both entry points render the same underlying section components
(`ContactSection`, `WorkHistorySection`, etc. — already built in
`components/ProfileForm.tsx`); only the shell around them differs (stepped
vs. tabbed).

### Wizard step sequence

1. **Welcome** — one or two sentences on what the extension does.
2. **Contact** — the only step nudged as "recommended" (still skippable).
3. **Work history**
4. **Education**
5. **Projects** *(new — see Phase 2 below)*
6. **Job preferences** — merges links, work authorization/EEO, and
   logistics into one step to keep the step count down.
7. **Documents** — folder access, explained plainly, skippable.
8. **Notion tracker** — explained plainly with numbered steps, "Test
   connection" button for instant feedback, skippable.
9. **AI drafting** *(new — see Phase 2 below)* — backend choice, skippable.
10. **Done** — confirms setup, explains the gear icon reopens this anytime.

Skipping a step never blocks proceeding. Finishing (or explicitly leaving)
the wizard writes the profile as-is and switches to Daily view.

## Visual design language

- **Action cards, not a button stack.** Each Daily-view action is a card:
  a small custom inline-SVG icon (hand-drawn, one consistent stroke
  weight — no icon library dependency, keeps bundle size and CSP simple),
  the action name, a one-line description, and — once run — its result
  rendered inside the same card (replacing the current separate paragraphs
  below a bare button). Each card gets a faint background tint from the
  existing pale-accent tokens (pale blue / green / amber) so the actions
  are visually distinct at a glance.
- **Real header chrome.** Small wordmark top-left, settings gear top-right,
  replacing the current plain "Your profile" text link.
- **Wizard steps carry typographic weight.** Step titles are sized/weighted
  distinctly larger than anything in the Daily view — the one "hero" moment
  in the app. A slim progress indicator (dots or a thin bar) sits at the
  top; steps transition with a gentle ~200ms slide/fade rather than an
  abrupt swap.
- **Icons**: hand-drawn inline SVGs for fill, attach (paperclip), tracker
  (grid), draft (sparkle/pen), gear, and check — zero dependencies.
- The existing color-token system (light/dark aware,
  `assets/base.css`), button variants, and pill/status styles carry
  forward — this extends that system rather than replacing it.

## Phase 2: AI-drafted answers

### Data model

Add to `Profile` (`lib/schema.ts`):

```ts
interface ProjectEntry {
  id: string;
  name: string;
  role: string;
  description: string;
  techStack: string;
  outcomes: string;
}
// Profile.projects: ProjectEntry[]
```

Add to `Settings` (`lib/settings.ts`):

```ts
interface LlmSettings {
  backend: 'ollama' | 'openrouter' | null; // null = not configured, feature inactive
  ollamaModel: string;       // e.g. "llama3.1"
  openRouterApiKey: string;
  openRouterModel: string;   // e.g. "anthropic/claude-3.5-sonnet"
}
// Settings.llm: LlmSettings
```

Both follow the existing `withDefaults`/backfill pattern in `storage.ts` so
existing saved profiles/settings don't break when these fields are added.

### Question detection

New `lib/question-detector.ts`: scans the page for `textarea` elements and
long-label `input[type=text]` fields *not already claimed* by
`matchFields`/`matchRadioGroups` — these are the leftover open-ended
questions ("Why do you want to work here?", "Describe a challenge you
overcame"). Reuses `getDisplayLabel` from `field-matcher.ts` for the
question text.

### Drafting flow (new "Draft answers" action)

1. Content script detects candidate question fields + re-scrapes JD (reusing
   `jd-scraper.ts`, already built).
2. For each question, check `profile.customQA` for a close match first
   (cheap substring/keyword match — no LLM call if found).
3. Otherwise, call `lib/llm-client.ts`'s `draftAnswer(question, context,
   settings)`, where `context` = JD + work history + projects. Routes to:
   - **Ollama**: `POST http://localhost:11434/api/generate` (or `/api/chat`)
   - **OpenRouter**: `POST https://openrouter.ai/api/v1/chat/completions`
     with the user's own API key
4. Side panel shows each draft in an editable textarea with:
   - **Insert** — sends it to the content script to write into that page
     field (same DataTransfer/native-setter approach already used for text
     fields).
   - **Save as reusable answer** — adds it to `profile.customQA`.

Nothing is inserted without the user seeing and being able to edit it first
— consistent with the rest of the app's "never silently submit" principle.

### New manifest permissions

`host_permissions`: add `http://localhost:11434/*` (Ollama) and
`https://openrouter.ai/*` (OpenRouter), alongside the existing
`https://api.notion.com/*`.

### AI drafting settings step/tab

Backend selector (Ollama / OpenRouter / off), model name field, API key
field (masked, only shown for OpenRouter) — mirrors the existing
`NotionSettingsSection` pattern. Skippable; "Draft answers" simply stays
disabled with an explanatory message until configured.

## File/component changes (summary)

- `entrypoints/sidepanel/App.tsx` — split into `DailyView` and `SetupView`
  (wizard/tabs shell), with a `view` state and a `hasCompletedSetup` check
  (profile non-empty) deciding the initial mode.
- `components/ProfileForm.tsx` — gains `ProjectsSection`; existing sections
  are reused as-is by both the wizard and the tabbed settings shell.
- `components/Wizard.tsx` *(new)* — generic step container (progress
  indicator, Next/Back, skip) that renders whichever section is passed to
  it; used only by the first-run flow.
- `components/icons.tsx` *(new)* — the small set of hand-drawn inline SVG
  icons, as simple React components.
- `lib/question-detector.ts`, `lib/llm-client.ts` *(new)*.
- `lib/schema.ts`, `lib/settings.ts` — extended as above.
- `wxt.config.ts` — add the two new `host_permissions`.

## Verification

1. Fresh install (cleared `chrome.storage.local`) → side panel opens
   directly into the wizard; each step's Skip works; Done lands in Daily
   view with an empty-but-valid profile.
2. Reopen via the gear icon → same sections appear as tabs, editable
   independently, Save persists.
3. Fill/Attach/Log cards show results inline, tinted per action, on a real
   job posting (reuse the revel8 test page from earlier verification).
4. Draft answers: on a form with a free-text question, confirm detection
   finds it, a saved `customQA` entry is used without an LLM call when one
   matches, and both Ollama (if running locally) and OpenRouter (with a
   test key) paths produce a draft that can be inserted and edited.
5. Existing saved profiles (pre-redesign) load without errors — the
   `withDefaults` backfill covers the new `projects` field and `Settings.llm`.
