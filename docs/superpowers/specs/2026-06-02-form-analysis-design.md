# Form Analysis (CV Pipeline) — Design

**Date:** 2026-06-02
**Ticket:** T19 (replaces original T19 scope)
**Status:** Approved by user — ready for implementation planning when resumed
**Depends on:** T1–T20b complete, Docker Desktop available, AWS account set up, Terraform CLI installed

---

## Scope

Build a standalone form analysis feature that lets users upload a workout video and receive scored feedback on their form. The feature lives at `/form-analysis` (new authenticated nav item). The CV pipeline runs as an async AWS microservice — completely separate from the existing Next.js/Supabase/Vercel stack which stays untouched.

LimenFit is a **responsive web application** (Next.js, Vercel). All UI must work well on both desktop (sidebar nav) and mobile browsers (bottom nav). No native app code.

**In scope:**

- New `/form-analysis` page with upload flow, job status, and results view
- AWS async pipeline: S3 → SQS → ECS Fargate worker (Python + FastAPI + MediaPipe)
- Stable score interface: Form, Control, Range, Overall + rep count + Gemini coaching tips
- v1 exercise analyser: Squat (side view only)
- Supabase Realtime for live job status in the browser
- Terraform IaC for all AWS resources
- GitHub Actions CI/CD: Docker → ECR → ECS
- Responsive layout across desktop and mobile web

**Out of scope for v1:**

- Deadlift, bench press, or any other exercise analysers (architecture supports adding them later)
- Live camera analysis (upload-only)
- Linking analysis to a specific workout session (standalone — user uploads freely)
- Front-view analysis (side view only for v1)
- Video playback of the uploaded clip in the results view (show thumbnail only in v1)

---

## Motivation

Form analysis is the most portfolio-differentiating feature in LimenFit. It demonstrates:

- **Cloud infrastructure** (AWS ECS Fargate, S3, SQS, ALB, ECR, Secrets Manager, CloudWatch)
- **Infrastructure as code** (Terraform modules across dev/prod environments)
- **Containerisation** (Python FastAPI service + analysis worker, Docker → ECR → ECS)
- **Computer vision** (MediaPipe pose estimation, OpenCV frame extraction)
- **CI/CD pipeline** (GitHub Actions end-to-end deployment)
- **AI integration** (Gemini-generated coaching feedback from extracted metrics)
- **Real-time UX** (Supabase Realtime for live job status)

Most junior portfolios stop at CRUD. This feature goes from video upload → S3 → SQS → ECS worker → MediaPipe → Gemini → Supabase Realtime → results card. Every step is an interview talking point.

---

## Architecture

### High-level overview

```
User Browser (desktop or mobile web)
    │
    │  /form-analysis  (new nav item)
    ▼
Next.js App (Vercel)  ◄────────────────────── Supabase Realtime
    │                                          (job status push)
    │  1. GET /api/form-analysis/presign       │
    │     → returns presigned S3 PUT URL       │
    │  2. PUT video directly to S3             │
    │  3. POST /api/form-analysis/jobs         │
    │     → creates job row in Supabase        │
    │  4. Subscribe to job row (Realtime)  ────┘
    │
    ▼
────────────────────── AWS ──────────────────────
    │
    ├─ S3 Bucket (limenfit-form-analysis-videos)
    │     PutObject event → EventBridge → SQS
    │
    ├─ SQS Queue (form-analysis-jobs)
    │     + Dead-Letter Queue (3 retries)
    │
    ├─ ALB (Application Load Balancer)
    │     Routes to ECS FastAPI service
    │     (no API Gateway — unnecessary hop)
    │
    ├─ ECS Fargate Cluster
    │   ├─ FastAPI Service (HTTP API + health check)
    │   └─ Analysis Worker (polls SQS, runs CV pipeline)
    │         Images pulled from ECR
    │         Secrets pulled from Secrets Manager via IAM role
    │
    ├─ ECR (stores Docker images)
    │
    ├─ Secrets Manager
    │     SUPABASE_URL
    │     SUPABASE_SERVICE_ROLE_KEY
    │     GOOGLE_GENAI_API_KEY
    │
    └─ CloudWatch
          Container logs · Job latency · Error rate · DLQ alarm
─────────────────────────────────────────────────
    │
    ▼
Supabase
    form_analysis_jobs table
    (worker writes result here; Realtime notifies browser)
```

### Why ECS over Lambda

Lambda hides container/networking complexity that interviewers probe. ECS Fargate forces you to understand Docker images, task definitions, VPC networking, security groups, ALB routing, and IAM roles — all standard resume bullets. Lambda is fine for simple functions; ECS is what you want to talk about in a cloud/DevOps interview.

### Why no API Gateway

The original ChatGPT suggestion included API Gateway, but with an ALB already in front of ECS the extra hop adds cost and latency with no benefit. API Gateway earns its place when you need per-client API keys, usage plans, or request transformation — none of which apply here. ALB → FastAPI directly.

---

## Upload flow

```
1. User selects exercise + picks video file on /form-analysis/new
2. Browser calls  GET /api/form-analysis/presign?exercise=squat
3. Next.js API calls S3.getSignedUrl (PutObject, 5-min expiry)
   Key: uploads/{userId}/{uuid}.mp4
   Returns: { uploadUrl, videoKey, jobId }
4. Browser PUTs video directly to S3 using the presigned URL
   (no video bytes pass through Next.js or Vercel)
5. Browser calls  POST /api/form-analysis/jobs
   Body: { jobId, videoKey, exercise }
   Next.js writes row to Supabase: status = "queued"
6. Browser subscribes to that row via Supabase Realtime
7. S3 PutObject fires EventBridge rule → SQS message enqueued
8. ECS worker picks up message, updates status = "processing"
9. Worker completes analysis, updates status = "completed" + result JSONB
10. Realtime pushes the update → browser renders results card instantly
```

Direct-to-S3 via presigned URL is the right approach: video files never pass through Vercel (avoiding serverless payload/timeout limits) and the architecture scales naturally.

---

## AWS pipeline — analysis worker steps

```
1. Pull video from S3 (boto3)
2. Extract frames at 10 fps (OpenCV)
3. Run MediaPipe Pose Landmarker on each frame
   → 33 body landmarks (x, y, z, visibility) per frame
4. View validation
   → Check that left/right hip, knee, ankle landmarks are visible
   → Estimate whether this is a side view
   → If not: update job status = "failed", reason = "unsupported_angle"
   → Return early; worker does not proceed
5. Exercise router
   → v1: only "squat" is supported; any other exercise returns
     status = "failed", reason = "unsupported_exercise"
   → Instantiate SquatAnalyser(frames, landmarks)
6. SquatAnalyser computes metrics:
   - Rep detection (hip landmark vertical travel)
   - Per-rep: knee angle at bottom (Range), back angle (Form),
     knee-over-toe tracking (Form), descent smoothness (Control)
7. Score aggregation → { form, control, range, overall, reps }
8. Call Gemini API with metrics + exercise context
   → Returns coaching_tips string
   → Prompt: structured, includes raw metric values
9. Write to Supabase:
   form_analysis_jobs.status = "completed"
   form_analysis_jobs.result = { form, control, range, overall, reps, feedback }
```

---

## Stable score interface

The output shape **never changes** regardless of exercise. This means the frontend results card, Supabase schema, and API response format are all stable as new exercises are added.

```typescript
// Always this shape — exercise-specific calculators are swappable internals
interface AnalysisResult {
  form: number; // 0–10
  control: number; // 0–10
  range: number; // 0–10
  overall: number; // weighted average
  reps: number; // rep count detected
  feedback: string; // Gemini coaching tips
}
```

### What each metric means per exercise

| Metric  | Squat (v1)                                          | Deadlift (future)             | Bench (future)             |
| ------- | --------------------------------------------------- | ----------------------------- | -------------------------- |
| Form    | Back angle + knee-over-toe tracking                 | Spine neutrality + bar path   | Bar path + wrist alignment |
| Control | Descent smoothness + time under tension             | Hinge control + lockout tempo | Eccentric control + pause  |
| Range   | Knee angle at bottom (depth)                        | Hip hinge depth               | Elbow angle at bottom      |
| Overall | Weighted average (Form×0.4, Control×0.3, Range×0.3) | Same weights                  | Same weights               |

Adding a new exercise = add one new `ExerciseAnalyser` class. No schema changes, no API changes, no frontend changes.

---

## Supabase schema

```sql
create table form_analysis_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise    text not null,           -- 'squat', 'deadlift', etc.
  video_key   text not null,           -- S3 object key
  status      text not null default 'queued',
              -- 'queued' | 'processing' | 'completed' | 'failed'
  fail_reason text,                    -- 'unsupported_angle' | 'unsupported_exercise' | 'worker_error'
  result      jsonb,                   -- AnalysisResult (null until completed)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS: users can only read their own rows
alter table form_analysis_jobs enable row level security;

create policy "users read own jobs"
  on form_analysis_jobs for select
  using (auth.uid() = user_id);

create policy "service role full access"
  on form_analysis_jobs for all
  using (true)
  with check (true);  -- worker uses service role key
```

Supabase Realtime is enabled on this table. The browser subscribes to `eq('id', jobId)` and receives the payload when the worker updates `status` and `result`.

---

## Frontend — pages and components

LimenFit is a responsive web app. All pages use the existing `AppShell` which renders the sidebar on `md+` screens and the bottom nav on mobile. The form analysis pages follow the same layout conventions as the rest of the app.

### Navigation

Add "Form" nav item to both `MobileBottomNav.tsx` and `AppSidebar.tsx` using the same `BASE_NAV_ITEMS` pattern. No feature flag — always visible.

```
Desktop sidebar:  Home · Train · Form · Ask (if flag on) · Profile
Mobile bottom:    Home · Train · Form · Ask (if flag on) · Profile
```

Use a `Video` or `Scan` icon from lucide-react to match the existing icon style.

### `/form-analysis` — list page

- Header: "Form Analysis" + "New Analysis" button (links to `/form-analysis/new`)
- Responsive grid of past job cards:
  - On desktop: 2–3 columns
  - On mobile: single column
  - Each card: exercise name, date, overall score badge (amber), "View Report" link, delete button
- Empty state: short prompt + "Upload your first video" CTA with camera guide note
- Fetches jobs via `SELECT * FROM form_analysis_jobs WHERE user_id = ? ORDER BY created_at DESC`

### `/form-analysis/new` — upload page

Step-based flow (single page, conditional rendering):

- **Step 1 — Exercise selector:** Squat available; Deadlift/Bench greyed out with "coming soon" label
- **Step 2 — Camera guide:** Instruction card with positioning tips
  - "Film from the side · Hip height · 8 feet away · Entire body visible"
  - Simple diagram (can be a static illustration or CSS wireframe for v1)
- **Step 3 — File upload:** `<input type="file" accept="video/*">` + upload progress bar
  - XHR to presigned S3 URL with `onprogress` event for the progress bar
  - On complete: POST to create job, redirect to `/form-analysis/[jobId]`

### `/form-analysis/[jobId]` — results page

- **While processing** (`status` is `queued` or `processing`):
  - Spinner + status label ("Queued…" / "Analysing your squat…")
  - Supabase Realtime subscription keeps this live without any page refresh
- **On completion** (`status === 'completed'`):
  - Header: exercise name + date
  - 2×2 metric grid:
    - Form · Control · Range · Overall Score
    - Each tile: large score number + `/10` + one-line summary from Gemini
    - Overall tile styled distinctly (amber badge, like the reference UI)
  - Rep count shown below the grid ("5 reps detected")
  - "Tips for Improvement" section: Gemini bullet points
- **On failure** (`status === 'failed'`):
  - Clear message based on `fail_reason`:
    - `unsupported_angle`: "We couldn't detect a clear side view. Film with your full body visible from the side, hip height, about 8 feet away."
    - `unsupported_exercise`: "Only squats are supported in v1. More exercises coming soon."
    - `worker_error`: "Something went wrong on our end. Try uploading again."
  - "Try again" button → `/form-analysis/new`

---

## Terraform structure

```
terraform/
  modules/
    networking/     VPC, subnets, IGW, NAT, security groups
    ecs/            Cluster, task definition, service, IAM roles
    alb/            ALB, target group, listener, HTTPS cert
    ecr/            Repository (limenfit-form-analysis)
    s3/             Video bucket, bucket policy, lifecycle rules
    sqs/            Queue, DLQ, EventBridge rule from S3
    secrets/        Secrets Manager secrets (values injected separately)
    cloudwatch/     Log groups, metric alarms, DLQ depth alarm
  environments/
    dev/            main.tf referencing modules, dev-scale sizing
    prod/           main.tf referencing modules, prod-scale sizing
```

Every AWS resource is provisioned by Terraform — no manual console clicks. This is the key differentiator vs most portfolio projects.

---

## CI/CD pipeline

```
git push to main (files under services/form-analysis/ changed)
    │
    ▼
GitHub Actions  (.github/workflows/deploy-form-analysis.yml)
    │
    ├─ Run Python tests (pytest)
    ├─ Build Docker image
    │     services/form-analysis/Dockerfile
    ├─ Push to ECR
    │     aws ecr get-login-password | docker login
    │     docker tag limenfit-form-analysis:latest $ECR_URI:$SHA
    │     docker push
    └─ Update ECS service
          aws ecs update-service --force-new-deployment
```

Required GitHub secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ECR_REGISTRY`.

The existing `ci.yml` (Next.js quality gate) is unchanged. The new `deploy-form-analysis.yml` triggers only when `services/form-analysis/**` changes.

---

## Service structure

```
services/
  form-analysis/
    Dockerfile
    requirements.txt      fastapi, uvicorn, boto3, mediapipe, opencv-python-headless,
                          google-generativeai, supabase
    src/
      main.py             FastAPI app, routes (POST /analyze, GET /results/:jobId, GET /health)
      worker.py           SQS polling loop
      analysers/
        base.py           ExerciseAnalyser abstract class
        squat.py          SquatAnalyser (v1 implementation)
      pipeline/
        frames.py         OpenCV frame extraction
        pose.py           MediaPipe Pose Landmarker wrapper
        validation.py     View detection + camera angle validation
      feedback.py         Gemini API call, prompt construction
      db.py               Supabase client (service role key from Secrets Manager)
      config.py           Settings loaded from env / Secrets Manager at startup
    tests/
      test_squat.py
      test_validation.py
      test_pipeline.py
```

---

## Monitoring

CloudWatch alarms:

| Alarm             | Condition         | Action            |
| ----------------- | ----------------- | ----------------- |
| DLQ depth         | > 0 messages      | SNS notification  |
| Worker error rate | > 5% of jobs fail | SNS notification  |
| Analysis latency  | p95 > 60s         | SNS notification  |
| ECS task health   | < 1 running task  | ECS auto-restarts |

Structured JSON logs from the worker:

```json
{
  "job_id": "...",
  "exercise": "squat",
  "status": "completed",
  "duration_s": 14.3,
  "reps": 5,
  "overall": 7.5
}
```

---

## Learning roadmap (before implementing)

This feature requires AWS/DevOps knowledge. Suggested sequence:

| Week | Focus                                                                             |
| ---- | --------------------------------------------------------------------------------- |
| 1    | Docker — containerise a small FastAPI app, run locally                            |
| 2    | ECS Fargate — deploy that container manually via console to understand the pieces |
| 3    | Terraform — provision ECS + VPC + ALB with Terraform, destroy, repeat             |
| 4    | ECR + GitHub Actions — full CI/CD: push → ECR → ECS                               |
| 5    | S3 + SQS + EventBridge — wire up the async trigger                                |
| 6    | MediaPipe — pose estimation on sample squat videos locally in Python              |
| 7    | Connect everything — integrate worker into the full pipeline                      |
| 8    | Connect to LimenFit — presigned URL upload, Realtime subscription, results UI     |

---

## Resume bullets this feature enables

- "Designed and deployed an async CV pipeline on AWS ECS Fargate using Docker, ECR, S3, SQS, and ALB — provisioned end-to-end with Terraform modules across dev and production environments"
- "Built a MediaPipe + OpenCV pose estimation worker in Python/FastAPI that extracts Form, Control, and Range metrics from uploaded workout videos"
- "Implemented Gemini-powered coaching feedback generation from structured biomechanical metrics"
- "Delivered real-time job status updates via Supabase Realtime — worker writes to Postgres, browser updates instantly"
- "Stable score interface (form, control, range, overall) with swappable exercise-specific analysers — adding a new exercise requires zero schema or API changes"
