# AI Migration Implementation Plan (IR-first, Advanced TestRun/TestResult)

This implementation plan operationalizes the MVP described in `enhanceplan.md`. It prioritizes IR (Intermediate Representation) management and uses `TestRun`/`TestResult` as the primary audit/history for AI and Quality while preserving existing UIs. All changes are additive.

Refs:
- Plan: `enhanceplan.md`
- Prisma schema: `backend/prisma/schema.prisma`
- Extensions: `database/init/01-extensions.sql`

## Goals

- PostgreSQL is the single source of truth for AI IO, metrics, IR schemas, human feedback, and history.
- Preserve maintenance and HiTL UIs; no breaking API changes.
- IR management (CRUD + validation) is a first-class component.

## Alignment with enhanceplan.md

- Phase 1 (lines 19–26): pgvector/UUID, additive migrations only.
- Phase 2 (lines 27–44): Central tables — reuse existing; add IR/metrics/ground-truth/embedding.
- Phase 3 (lines 45–53): Keep orchestrator; log runs in DB.
- Phase 4 (lines 53–60): Define IR schemas and validate each run.
- Phase 5 (lines 61–68): Metrics definition and per-run results.
- Phase 6 (lines 69–74): Human-in-the-loop via existing `ReviewFeedback`.
- Phase 7 (lines 75–79): Monitoring via Postgres; optional Prometheus/Grafana later.

## Data Model Strategy (Additive, Reuse-first)

- Reuse:
  - ai_steps → `AIProcess`, `AIPrompt`
  - ai_step_runs → `PromptData` (inputs), `PromptResult` (outputs/metrics)
  - history/audit → `TestRun`, `TestResult`
  - human_feedback → `ReviewFeedback`
- Add (Prisma models):
  - IRSchemaDefinition: `{ id, processId?, promptId?, name, version, schema Json, createdAt, updatedAt }`
  - MetricDefinition: `{ id, key unique, name, description?, unit?, target?, aggregation?, scope?, createdAt, updatedAt }`
  - GroundTruth: `{ id, scope, referenceId, data Json, version?, createdAt, updatedAt }` + index(scope, referenceId)
  - Embedding: `{ id, namespace, refType?, refId?, vector(pgvector), metadata Json?, createdAt }` + index(namespace, refType, refId)

Note: `Embedding.vector` created via raw SQL `vector(1536)` and mapped with Prisma Unsupported type if needed.

## Database Setup & Migrations

- Update `database/init/01-extensions.sql`:
  - `CREATE EXTENSION IF NOT EXISTS pgvector;`
  - `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` (or use `pgcrypto` for `gen_random_uuid()`)
- Prisma migration:
  - Add the 4 models.
  - Add raw SQL step: `ALTER TABLE "Embedding" ADD COLUMN "vector" vector(1536);`
  - Run `npx prisma migrate dev && npx prisma generate`.

## IR Management (Priority)

- Service: `backend/src/services/schema/IRSchemaService.ts`
  - Methods: `create`, `update`, `getById`, `getActiveForPrompt`, `activateVersion`, `validateJson(schemaId|promptId, data)`
  - Validator: AJV or Zod; store readable error summaries
- Routes: `backend/src/routes/irSchemas.ts` (admin-protected)
  - `POST /api/ir-schemas`
  - `PUT /api/ir-schemas/:id`
  - `GET /api/ir-schemas?promptId=&processId=`
  - `POST /api/ir-schemas/:id/activate`
  - `POST /api/ir-schemas/validate`
- Run-time integration:
  - On AI completion: fetch active schema by `promptId`/`processId`, validate result JSON
  - Record `TestResult` name="IR Validation" with pass/fail, duration, and error details
  - Add `TestRun.summary.validation = { schemaId, version, passed, errorCount }`

## Advanced TestRun/TestResult Logging

- AI Steps
  - Persist `PromptData` (input/context/meta) and `PromptResult` (output, metrics: tokens, cost, latency, model, provider)
  - Create `TestRun` type="ai" with `summary`: pipelineId, processId, promptId, promptVersion, tokens, cost, latency, rag context refs
  - Create `TestResult`s:
    - "Prompt IO" (sanitized input/output, hashes)
    - "IR Validation" (status + errors)
    - optional: "Safety/Policy"
- Quality Evaluations
  - Create `TestRun` type="quality" (link `designSplitId`)
  - `summary.scores` { html, accessibility, performance, hubspot, seo, tailwind }, `summary.grade`, recommendations
  - `TestResult` per check (e.g., "Accessibility ARIA", "SEO Meta"); raw findings in `details`
  - Optional: also update `DesignSplit.metrics` with a small "latest summary" for legacy views

## Monitoring & Analytics

- Extend `backend/src/routes/pipelineMonitoring.ts` (or adjacent):
  - `GET /api/monitoring/test-runs` (filters: type, designSplitId, promptId, date range)
  - `GET /api/monitoring/test-runs/:id`
  - `GET /api/monitoring/test-results?runId=`
  - `GET /api/monitoring/quality/trends` (rollups from `TestRun.summary.scores`)
  - `GET /api/monitoring/ai/metrics` (tokens, cost, latency, validation pass rates)

## Seeding

- Script: `backend/prisma/seed.ts`:
  - Seed 1–2 `IRSchemaDefinition` for key prompts
  - Seed `MetricDefinition` for:
    - ai: tokens_in, tokens_out, total_cost_usd, latency_ms, validation_pass_rate
    - quality: html_score, accessibility_score, performance_score, hubspot_score, seo_score, tailwind_score
  - Optional: seed `Embedding` for namespace "guidelines"

## Security & Governance

- Admin-only for IR schema mutations
- Redact PII in "Prompt IO" details
- Validate IR schemas on write; provide friendly validation errors
- Explicit version activation; default to single active per `promptId`

## Rollout Steps

1. Enable extensions (pgvector, uuid/pgcrypto)
2. Add Prisma models + raw SQL for vector; migrate + generate
3. Implement `IRSchemaService` + `routes/irSchemas.ts` with admin guard
4. Wire AI/Quality logging to produce `TestRun` + `TestResult` alongside `PromptData`/`PromptResult`
5. Extend monitoring routes for history/trends
6. Seed IR/metrics; run E2E pipeline and verify
7. Optional: implement Embedding persistence for RAG

## Acceptance Criteria

- IR CRUD + validation working; `TestResult` "IR Validation" recorded for AI runs
- Each AI/Quality evaluation creates `TestRun` with granular `TestResult`s
- `PromptData`/`PromptResult` remain the AI IO source of truth
- Monitoring endpoints expose latest and historical views without breaking existing UIs
- All changes additive; legacy views continue to work

## Backout & Safety

- Additive-only migrations; no renames/drops
- Feature-flag IR validation enforcement (log-only vs strict)
- Roll back by disabling reads from new tables; existing tables remain sufficient

---

## UI Stability Guarantees (Frontend + Maintenance)

To ensure the current UI does not break, disappear, or regress, we will apply these concrete safeguards:

- Feature flags and modes
  - `PIPELINE_LOGGING_ENABLED` (default: false) gates all new Pipeline/Step logging.
  - `IR_VALIDATION_MODE=off|log|enforce` (default: log in dev, off in prod initially).
  - New monitoring routes start read-only and are disabled unless explicitly enabled.
- Preserve API contracts
  - No changes to existing endpoints or response shapes used by the frontend/maintenance UIs.
  - Maintain legacy summaries (e.g., continue updating `DesignSplit.metrics`) to power current views.
- Shadow writes, no shadow reads
  - Write to new tables in parallel, but existing UIs continue reading from legacy tables/fields.
  - Promote reads to new routes only after canary validation.
- Canary rollout
  - Dark-launch new models and endpoints behind flags.
  - Opt-in per environment/project; enable for internal testers first.
- Synthetic checks and regression monitoring
  - Add health checks for critical UI pages and API endpoints used by the frontend/maintenance areas.
  - Alert on contract changes or non-200 responses.
- Contract tests
  - Add automated tests that assert response shapes for existing endpoints to prevent accidental breaking changes.
- Rollback strategy
  - Toggle flags off to immediately revert to legacy-only behavior (no DB schema rollback needed).
  - Clear, documented runbook in this plan.

These measures guarantee the UI remains operational throughout the migration.

## Testing posture during migration (freeze)

- Freeze current test suite and refactoring: do not add/modify tests until the new pipeline/IR approach is fully implemented and verified.
- Jest/tsconfig remain unchanged; no new test files are introduced during this phase.
- AutoBuildTestService and any watch-mode that could restart servers should remain disabled in CI to avoid instability (keep manual runs only).
- Feature flags default to off/log-only, so CI tests exercise legacy behavior exclusively.
- Post-implementation, we will add contract tests and new coverage targeting PipelineRun/StepRun, IR validation, and metrics.

## Addendum: Pipeline/Step Orchestration, IR Artifacts, and Output Linking

This addendum integrates a clean multi-step, IR-validated execution model while keeping domain tables unchanged. All entities are additive.

### New additive models (Prisma)

- PipelineDefinition, PipelineVersion (DAG in `PipelineVersion.dag`)
- StepDefinition, StepVersion (catalog + versioning)
- IRSchema (per StepVersion; JSON Schema Draft 2020-12)
- PipelineRun, StepRun (runtime instances)
- IRArtifact (validated IR JSON per StepRun)
- MetricDefinition, MetricProfile, MetricProfileItem, MetricResult
- StepOutputLink (generic link StepRun → existing tables)

These coexist with and do not replace: `SplitAsset`, `ModuleTemplate`, `GeneratedArtifact`, `DesignSplit`, `ValidationResult`, `AIPrompt*`, `PromptData`, `PromptResult`, `TestRun`, `TestResult`.

### DAG schema and nodeKey conventions

- `PipelineVersion.dag` JSON shape:
  - `nodes`: [{ key, stepVersionId, metricProfileId?, config? }]
  - `edges`: [{ fromKey, toKey }]
- `StepRun.nodeKey` must match `dag.nodes[i].key` to enable precise UI traceability.

### StepRun lifecycle (worker)

1) Create `StepRun(status=running)` with `nodeKey`, params from `defaultConfig` + node `config`.
2) Execute step logic → produce IR object.
3) Load `IRSchema` for the `StepVersion`; validate IR → write `IRArtifact { irJson, isValid, validationErrors }`.
4) Evaluate metrics using `MetricProfile` → write `MetricResult[]` (value, passed, details).
5) Upsert domain outputs (e.g., `SplitAsset`, `ModuleTemplate`, `GeneratedArtifact`).
6) Create `StepOutputLink[]` for each produced domain record.
7) Set `StepRun.status` to `completed` or `failed` (attach `error` if any).

### SplitAsset / ModuleTemplate integration

- Layout split step: keep writing to `SplitAsset`; then `StepOutputLink(targetType="split_assets", targetId=<SplitAsset.id>)`.
- Module generate step: keep writing to `ModuleTemplate` (or `GeneratedArtifact`); link via `StepOutputLink` accordingly.
- Rationale: Domain entities remain stable; process auditability lives in Step/IR/Metrics layer.

### Seeds (initial)

- StepDefinition: `layout_split`, `module_generate`, `validate_artifact`.
- StepVersion: v1 for each; attach sample `IRSchema` (see examples in the user brief).
- MetricDefinition: `latency_ms`, `split_coverage`, `overlap_ratio`, `faithfulness_v1`, `html_validity`, etc.
- MetricProfile(s): `split_profile_v1`, `module_profile_v1` linking the above metrics.

### Coexistence with TestRun/TestResult

- Use `PipelineRun`/`StepRun` as execution ground truth.
- Keep `TestRun`/`TestResult` for developer tests and generic quality suites.
- When needed by existing dashboards, mirror key validations/metrics from `StepRun` into `TestRun`/`TestResult` (additive).

### Orchestrator alignment

- The plan preserves the current Node/Express orchestrator. We apply the same logging/validation strategy intended by the FastAPI note in `enhanceplan.md`.

### Analytics helpers

- `runGroupId`: include a grouping identifier (e.g., pipeline execution ID) in `PipelineRun.summary` or `StepRun.params` and expose it in queries.
- `metrics_results` view: define a SQL (or materialized) view `metrics_results_v` flattening `MetricResult` joined with `StepRun`/`PipelineRun` for analytics parity with the conceptual table in `enhanceplan.md`.

### HiTL → GroundTruth curation

- Curate selected `ReviewFeedback` into `GroundTruth` with provenance (runId, reviewer, timestamp) and scope/reference IDs.
- Ground-truth evaluation functions compare outputs to `GroundTruth` and store results as `MetricResult` (and optionally as `TestResult`).

### Retention and backfill

- Retention: define TTL/archival policy for verbose `IRArtifact` and large `MetricResult.details`; keep summaries indefinitely.
- Backfill: if legacy JSON logs exist, provide a one-off script to migrate summaries into `PipelineRun`/`StepRun`/`MetricResult`.

## Later Development Enhancements: Pipeline Orchestration via DAG and Runtime Policy

To improve reproducibility, auditability, and flexibility without hardcoding execution order in code, evolve the orchestration to a database-defined DAG with runtime policy.

- __Why define order in the DB (DAG)__
  - Reproducibility & auditability: the exact flow for any run is captured independently of code releases.
  - UI & Ops: visualize runs, rewire paths, experiment with A/B branches without code changes.
  - Parallelization & conditions: explicit dependencies enable parallel steps and runtime decisions.
  - Clean responsibility model: the pipeline defines order/policy; step code focuses only on transforming inputs → IR → outputs.

- __Data model additions (additive)__
  - `PipelineDefinition`, `PipelineVersion.dag` as JSON:
    - `nodes`: `[{ key, stepVersionId, params?, metricProfileId?, order? }]`
    - `edges`: `[{ from, to }]`
  - `StepRun.nodeKey` must match `nodes[i].key` for traceability.

- __MVP path (minimal ordering)__
  - If a full DAG is deferred, store `order: int` on nodes and execute ascending by `order`.
  - Later, add `dependsOn` without breaking existing runs; orchestrator upgrades to topological sort.

- __Runtime policy fields (per node)__
  - `condition`: expression on prior IR/metrics (e.g., `metrics.generate.faithfulness >= 0.8`).
  - `continueOnFail: boolean`: continue pipeline even if node fails.
  - `retries: int`, `timeoutMs: int`: resilience controls.
  - `parallelGroup: string`: group key for parallel batches.

- __Example DAG (`PipelineVersion.dag`)__

```json
{
  "nodes": [
    { "key": "split", "stepVersionId": "…", "metricProfileId": "split_profile_v1" },
    { "key": "generate", "stepVersionId": "…", "dependsOn": ["split"], "metricProfileId": "module_profile_v1" },
    { "key": "validate", "stepVersionId": "…", "dependsOn": ["generate"], "params": { "strict": true } }
  ],
  "edges": [
    { "from": "split", "to": "generate" },
    { "from": "generate", "to": "validate" }
  ]
}
```

- __Conditional example__

```json
{
  "key": "publish",
  "stepVersionId": "…",
  "dependsOn": ["validate"],
  "condition": "metrics.validate.passed == true",
  "retries": 1,
  "timeoutMs": 60000
}
```

- __Orchestrator behavior__
  - Perform topological sort on DAG; schedule eligible nodes.
  - Enforce `condition`, `retries`, `timeoutMs`, and `parallelGroup`.
  - Step code remains unaware of sequence; it consumes inputs and produces IR/outputs only.
