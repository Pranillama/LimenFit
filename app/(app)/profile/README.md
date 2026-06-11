# app/(app)/profile

The profile area — a master/detail shell with six sections plus Account, under `/profile/*`. Authenticated (guarded by `middleware.ts`).

## Routes

| Route                   | Section                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `/profile`              | Landing — section list (mobile); on desktop the list is the left rail      |
| `/profile/personal`     | Personal info (name, age, gender, height, starting weight, time zone)      |
| `/profile/fitness`      | Fitness profile (goal, activity, experience, frequency, goal weight, kcal) |
| `/profile/body-metrics` | Body metrics (BMI card + gauge, weight log + chart, measurements)          |
| `/profile/preferences`  | Preferences (weight/height units, default rest timer)                      |
| `/profile/subscription` | Subscription (cosmetic: plan card, AI-usage meter, activity stats)         |
| `/profile/account`      | Account (change password, delete account)                                  |

## Layout

`layout.tsx` (server) loads the user + profile once and renders the master/detail shell:

- **Desktop (`lg+`):** sticky `SectionList` rail (300px) + the active section.
- **Mobile:** `ProfileChrome` provides a fixed back-to-Profile bar; the `/profile` landing shows the section list, and each row pushes to its route.

```
Desktop
┌──────────────┬───────────────────────────────┐
│ ProfileHeader (avatar + name + handle)        │
├──────────────┼───────────────────────────────┤
│ SectionList  │  <active section>             │
│  Personal    │                               │
│  Fitness     │                               │
│  Body metrics│                               │
│  Preferences │                               │
│  Subscription│                               │
│  Account     │                               │
│  [Sign out]  │                               │
└──────────────┴───────────────────────────────┘
```

## Files

| File                  | Role                                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| `layout.tsx`          | Server — loads user/profile, renders `ProfileChrome` + `SectionList` + section |
| `page.tsx`            | `/profile` landing — renders `ProfileView` (mobile section list)               |
| `<section>/page.tsx`  | Server — reads that section's data, renders its form/view                      |
| `template.tsx`        | Re-mounts on navigation (drives settings hydration)                            |
| `sign-out-button.tsx` | Client — full client wipe before sign-out (see `features/profile/README.md`)   |
| `actions.ts`          | Server action — Supabase sign-out + redirect to `/auth`                        |

## Data flow

Each section page server-reads its data (profile / `user_settings` / bodyweight entries / measurements / AI usage), computes any derived values, and passes them to a client form. Forms write through focused mutation hooks (`@/features/profile`) that hit `/api/profile`, `/api/settings`, `/api/bodyweight`, or `/api/measurements`, then call `router.refresh()` to re-read. Avatar uploads go to the public `avatars` Supabase Storage bucket (migration `20260608000001`), then patch `profiles.avatar_url`.

See `features/profile/README.md` for the component/hook surface, and the data layer in `lib/body-metrics`, `lib/schemas`, and `app/api/*`.
