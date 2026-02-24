# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Run all apps in dev mode
pnpm dev

# Run specific app only
pnpm --filter mobile dev
pnpm --filter web dev
```

### Database (from repo root or packages/database)
```bash
pnpm db:generate    # Regenerate Prisma client after schema changes
pnpm db:push        # Push schema changes to Supabase (no migration file)
pnpm db:migrate     # Create + apply a migration
pnpm db:studio      # Open Prisma Studio
```

**Windows caveat:** Close VS Code before running `db:generate` to avoid DLL lock errors on `@prisma/client`.

### Build & Lint
```bash
pnpm build          # Build all apps
pnpm lint           # Lint all packages
```

## Architecture

### Monorepo Layout
- `apps/mobile` — Expo React Native (Expo Router v6, TypeScript)
- `apps/web` — Next.js 15 App Router (TypeScript, API-only backend)
- `packages/database` — Prisma schema + PrismaClient re-export

The mobile app is the primary user-facing product. The web app serves only as a backend API — it has no user-facing pages (or the pages are minimal). All AI and database logic lives in `apps/web`.

### Authentication Flow
Every API route in `apps/web` validates the Supabase JWT via `getUserFromRequest(request)` in `apps/web/lib/supabase.ts`. The mobile app attaches the JWT as a `Bearer` token. No route should skip this check.

### AI Integration (`apps/web/lib/claude.ts`)
Three Claude Haiku (`claude-haiku-4-5-20251001`) functions:
- `parseGoal(rawInput)` — Extracts structure, category, deadline from free-text goal
- `generateTasks(input)` — Generates exactly 3 `TaskItem` objects per goal per day; behavior modified by `requestingAdditional`, `focusShifted`, `postReview` flags
- `generateInsight(input)` — 2–3 sentence coaching note after daily review

### Mobile App Routing (`apps/mobile/app/`)
`_layout.tsx` handles auth-gating at the root level:
1. Not authenticated → `/(auth)/login`
2. Authenticated, not onboarded → `/(onboarding)`
3. Onboarded, no valid subscription → `/payment` (bypassed in `__DEV__` via `DEV_BYPASS_PAYWALL`)
4. Onboarded + active/trialing subscription → `/(tabs)`

The 5-step onboarding flow (`/(onboarding)/index.tsx`) ends with a "Magic Moment" — animated reveal of the first 3 generated tasks.

### Data Model Key Points
- **TaskItem** (stored as JSON in `DailyTask.tasks`): use `task` field for the task name, not `title`
- **DailyTask** has a unique constraint on `(goalId, date)` — one task set per goal per day
- **DailyReview** must exist before calling the `/api/insights` route
- **UserProfile** stores `dailyTimeMinutes` and `intensityLevel` (1=steady, 2=committed, 3=all_in), used to tune task generation

### Mobile API Client (`apps/mobile/lib/api.ts`)
All API calls go to `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:3000`). Every call fetches the current Supabase session and attaches the JWT. Modules: `profileApi`, `goalsApi`, `tasksApi`, `reviewsApi`, `insightsApi`, `statsApi`, `accountApi`, `subscriptionApi`.

### Design System (`apps/mobile/constants/theme.ts`)
Stripe-inspired light theme. Primary color `#635BFF`. Use the token file for all colors, spacing, radius, typography, and shadows — do not hardcode values.
