# features/profile

Everything behind `/profile/*`: the master/detail profile shell, the six sections, the Account section, avatar upload, and the shared section-UI primitives.

## Architecture

`/profile` is a **master/detail** layout (`app/(app)/profile/layout.tsx`):

- **Desktop:** a sticky `SectionList` rail on the left, the active section on the right.
- **Mobile:** the section list is the `/profile` landing; tapping a row pushes to a sub-route with an iOS-style back bar (`ProfileChrome`).

Each section is its own route (`/profile/<section>`). **Pages are server components** that read data (profile, settings, derived values) and pass it to a presentational/client form. Writes go through focused TanStack Query **mutation hooks** that PATCH/POST an API route, then call `router.refresh()` so the server-rendered page re-reads canonical data. Weights are stored in kg, lengths in cm; the UI converts at render using the user's unit prefs.

The data layer lives outside this folder: `lib/schemas/*` (Zod + DTOs), `lib/body-metrics/{server,derive}.ts`, and the route handlers in `app/api/*`.

## Public API surface

Import from `@/features/profile` (the barrel). Do **not** import from sub-paths.

### Shell & header

- **`ProfileChrome`** — master/detail chrome: desktop header + mobile back-to-Profile bar; renders `ProfileHeader`.
- **`ProfileHeader`** — avatar (via `AvatarUploader`) + name / handle / email.
- **`SectionList`** — the six section rows + Account + Sign Out.
- **`ProfileView`** — mobile-only wrapper that renders `SectionList` on the `/profile` landing.

### Sections

- **`PersonalInfoForm`** — identity + physical basics (`profiles` columns); height/weight unit toggles.
- **`FitnessProfileForm`** — goal, activity, experience, weekly frequency, goal weight, target calories.
- **`BmiCard`** + **`BmiGauge`** — BMI value, category, SVG gauge, healthy/ideal weight, and Sex/Age/Weight/Height stats. _(Body metrics)_
- **`BodyweightSection`** + **`WeightChart`** — current weight + trend pill, recharts chart, "log today's weight". _(Body metrics)_
- **`MeasurementsForm`** — body fat + waist/chest/arms/legs (in/cm per pref). _(Body metrics)_
- **`ProgressPhotosPlaceholder`** — "coming soon" stub. _(Body metrics)_
- **`SubscriptionView`** — Free plan card, real AI-token meter (`ai_usage_daily` vs the 50k/day `costGuard` cap), activity stats, Pro-features list.
- **`AccountSection`** (+ `ChangePasswordRow`, `DeleteAccountDialog`) — password reset, delete account, sign-out.

### Avatar

- **`Avatar`** — reusable circular avatar (image → initials fallback, `size` prop). Reusable anywhere (nav, author chips).
- **`AvatarUploader`** — pencil menu (upload / change / remove); client-side center-crop + downscale to a 512² webp; uploads to the public `avatars` Supabase Storage bucket, then patches `profiles.avatar_url`.

### Shared section-UI primitives (`components/ui`)

`Field`, `Segmented`, `Select`, `RangeSlider`, `GoalGrid`, `SectionRow`, `IconChip`, `Pill`.

### Hooks

- **`useUpdateProfileMutation`** → `PATCH /api/profile`
- **`useUpdatePreferencesMutation`** → `PATCH /api/settings`
- **`useLogBodyweightMutation`** → `POST /api/bodyweight`
- **`useUpdateMeasurementsMutation`** → `PATCH /api/measurements`
- **`useChangePassword`**, **`useDeleteAccount`**

### lib

- **`avatar.ts`** — bucket/size/type constants, `avatarObjectPath`, `validateAvatarFile`.
- **`unitConversions.ts`** — kg↔lbs, cm↔ft/in, cm↔in.
- **`timezones.ts`** — common time-zone list for the Personal info select.

## Sign-out cleanup contract

`SignOutButton` (`app/(app)/profile/sign-out-button.tsx`) performs a full client wipe before handing off to the server action:

1. `useActiveWorkoutStore.getState().resetStore()` — resets workout + settings state to defaults (keeps `hydrated: true`).
2. `useActiveWorkoutStore.persist.clearStorage()` — removes the persisted localStorage key.
3. `queryClient.clear()` — evicts all TanStack Query caches.
4. `clearPendingDuplicate()` — removes the plan-duplicate session-storage entry.
5. `toast.dismiss('persistence-degraded')` — dismisses any sticky storage-warning toast.
6. `signOut()` server action — Supabase sign-out + redirect to `/auth`.
