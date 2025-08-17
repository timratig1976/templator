# 🧩 AI Maintenance & Quality Blueprint
## Prompt Versioning, Evaluation, A/B Testing, and Operations

A production playbook for maintaining high-quality AI features over time. Focuses on prompt lifecycle, telemetry, evaluation metrics, A/B testing, and rollback safety.

---

Quick links: [Database Integration](#db-integration)

## 🎯 Objectives
- Ensure prompt and model changes improve quality, not regress it
- Provide observability across cost, latency, and outcomes
- Enable controlled rollouts, quick rollbacks, and reproducibility

---

## 📦 Prompt Lifecycle Management

### Versioning & Immutability
- Store prompts as versioned artifacts with metadata
- Immutability: a version cannot change once released
- Link each run to exact `promptVersionId`, `model`, `params`

### Governance
- Required metadata per version: owner, intent, risk level, eval suite, rollout plan
- Approval gates for high-risk prompts (security, compliance)

### Storage Model (see DB blueprint)
- `PromptTemplate` (logical prompt), `PromptVersion` (frozen variant)
- `PromptRun` (runtime execution logs + metrics)
- `PromptABTest` (traffic splitting with goals)

---

## 📊 Evaluation Framework

### Ground Truth Evaluation
- Golden set with expected outputs
- Compare predictions→metrics: Precision/Recall/F1, nDCG, BLEU/ROUGE where relevant
- Computer vision: IoU@0.5, AP@0.5:0.95

### Live Quality Signals
- User actions as implicit labels: edits, re-runs, abandons
- Thumbs up/down, reason codes
- Drift detection: detect shifts in input distribution and output scores

### Test Types
- Regression suite on golden set per version bump
- Canary subset live evaluation (1–5%)
- Shadow mode (no-user-impact) before traffic

---

## 🧪 A/B Testing

### Design
- Split by user or request hash; ensure sticky assignment
- Define primary metric (e.g., F1 on CV eval, task completion), guardrails (latency, cost)

### Rollout
- 0% → 5% → 25% → 50% → 100% with auto-halt on guardrail breach
- Record cohort, assignment, exposure time, and outcomes

### Analysis
- Minimum sample size & power checks
- Non-parametric tests when metrics are non-normal

---

## 🔍 Observability & Telemetry

- Structured logs with `requestId`, `sessionId`, `promptVersionId`
- Metrics per run: tokens, cost, latency, retry count, cache hit, model
- Tracing: span phases (prompt-build, API-call, parse, validate)
- Dashboards: quality (F1/nDCG), cost ($/day), latency p50/p95, error budget

---

## 🛡️ Safety & Reliability

- Output validators and schema parsers with strict failure modes
- Abuse filters: PII redaction, prompt injection guards
- Timeouts, retries with jitter, circuit breakers, bulkheads
- Rollback strategy: last-known-good promptVersionId, auto-rollback on guardrail violation

---

## 🧠 RAG-Specific Maintenance

- Data freshness SLAs; scheduled re-embedding and index compaction
- Source hygiene: deduplicate, filter boilerplate, track provenance
- Retrieval quality eval: Recall@K, nDCG@K, answer faithfulness

---

## 🧰 Tooling & Workflow

- CLI/Script: create version, attach metadata, run eval, stage rollout
- CI gates: eval must pass thresholds before publishing
- Feature flags: prompt routing by version or cohort

---

<a id="db-integration"></a>
## 🗄️ Database Integration

Use a small set of tables to support prompt lifecycle, live telemetry, and experimentation. Keep ownership within the AI service.

- Required models (Prisma guidance):
  - `PromptTemplate` (logical prompt)
  - `PromptVersion` (immutable, metadata, params)
  - `PromptRun` (per-execution metrics: tokens, cost, latency, errors)
  - `PromptABTest`, `ABExposure` (assignments and outcomes)
  - `PromptFeedback` (user ratings, reason codes)
- Relationships: runs → version; versions → template; A/B test → two versions; exposures → A/B test
- Indexing: `(versionId, createdAt)`, `status`, `success`, and time-based partitions if high volume
- Migrations: live in AI service repo and are applied via CI/CD
- Core DB scope: see `03-database-architecture.md` for platform-wide conventions (indexes, backups, migrations). Feature-specific schemas are documented here.

Note: Link `PromptRun.requestId`/`sessionId` to system telemetry (`AnalyticsEvent`) for end-to-end traces.

---

### Prisma Schema (Reference)
```prisma
// Models owned by the AI service
model PromptTemplate {
  id          String          @id @default(cuid())
  key         String          @unique   // logical identifier used in code
  name        String
  description String?
  ownerId     String?
  tags        String[]        @default([])

  versions    PromptVersion[]

  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@map("prompt_templates")
}

model PromptVersion {
  id            String              @id @default(cuid())
  templateId    String
  version       String              // e.g., "v1", "2025-08-16-rc1"
  content       String              // final rendered template string
  variables     String[]            // expected variables
  model         String              // LLM model name
  params        Json?
  notes         String?
  status        PromptVersionStatus @default(DRAFT)
  createdBy     String?
  createdAt     DateTime            @default(now())
  publishedAt   DateTime?

  template      PromptTemplate      @relation(fields: [templateId], references: [id], onDelete: Cascade)
  runs          PromptRun[]
  abTestsA      PromptABTest[]      @relation("AB_VersionA")
  abTestsB      PromptABTest[]      @relation("AB_VersionB")

  @@unique([templateId, version])
  @@map("prompt_versions")
  @@index([status])
}

enum PromptVersionStatus {
  DRAFT
  REVIEWED
  LIVE
  ARCHIVED
}

model PromptRun {
  id               String   @id @default(cuid())
  versionId        String
  requestId        String?
  userId           String?
  sessionId        String?
  input            Json?
  output           Json?
  success          Boolean  @default(true)
  tokensPrompt     Int?
  tokensCompletion Int?
  costUsd          Float?
  latencyMs        Int?
  cacheHit         Boolean  @default(false)
  errorMessage     String?
  createdAt        DateTime @default(now())

  version          PromptVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  feedbacks        PromptFeedback[]

  @@map("prompt_runs")
  @@index([versionId, createdAt])
  @@index([success])
}

model PromptABTest {
  id             String       @id @default(cuid())
  templateId     String
  name           String
  status         ABTestStatus @default(DRAFT)
  primaryMetric  String       // e.g., "f1", "task_completion"
  guardrails     Json?        // latency/cost thresholds
  allocationA    Int          @default(50)
  allocationB    Int          @default(50)
  versionAId     String
  versionBId     String
  startedAt      DateTime?
  endedAt        DateTime?
  results        Json?
  createdAt      DateTime     @default(now())

  template       PromptTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  versionA       PromptVersion  @relation("AB_VersionA", fields: [versionAId], references: [id])
  versionB       PromptVersion  @relation("AB_VersionB", fields: [versionBId], references: [id])
  exposures      ABExposure[]

  @@map("prompt_ab_tests")
  @@index([templateId])
  @@index([status])
}

enum ABTestStatus {
  DRAFT
  RUNNING
  PAUSED
  COMPLETED
  CANCELLED
}

model ABExposure {
  id              String      @id @default(cuid())
  abTestId        String
  userId          String?
  requestHash     String?
  assignedVariant String      // "A" or "B"
  exposedAt       DateTime    @default(now())
  outcome         Json?

  abTest          PromptABTest @relation(fields: [abTestId], references: [id], onDelete: Cascade)

  @@map("ab_exposures")
  @@index([abTestId])
}

model PromptFeedback {
  id        String   @id @default(cuid())
  runId     String
  userId    String?
  rating    Int?     // -1/0/1 or 1..5
  reason    String?
  metadata  Json?
  createdAt DateTime @default(now())

  run       PromptRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@map("prompt_feedback")
  @@index([runId])
}
```

## ✅ Checklist
- [ ] Versioned prompts with metadata and owners
- [ ] Golden-set regression suite configured
- [ ] Live metrics and dashboards in place
- [ ] A/B testing with guardrails and auto-rollback
- [ ] Structured logs linking runs to versions
- [ ] RAG maintenance jobs and retrieval evals

---

## 🔗 Related
- `09-ai-pipeline-architecture.md`
- `13-rag-systems.md`
- `03-database-architecture.md` (Core DB conventions; prompt models documented here)
