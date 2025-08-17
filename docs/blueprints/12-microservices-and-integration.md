# 🔗 Microservices & Integration Blueprint
## Service Boundaries, API Gateways, Messaging, Contracts, and Observability

Production-ready architecture guidance for decomposing services and integrating internal/external systems with reliability and clear contracts.

---

Quick links: [Database Integration](#db-integration)

## 🎯 Objectives
- Define clear service boundaries and ownership
- Enable safe inter-service communication with versioned contracts
- Provide resilience via async messaging and retries
- Ensure observability across requests spanning multiple services

---

## 🧭 Service Boundaries & Ownership
- Domain-driven decomposition: `auth`, `templates`, `ai`, `projects`, `assets`, `analytics`
- Single-writer rule: one service is the source of truth per aggregate
- Data duplication allowed through events (read models, caches)
- Versioning: API and event schemas must be versioned and backward compatible

---

## 🛡 API Gateway & Edge
- API Gateway responsibilities:
  - Authentication/authorization (Clerk session verification)
  - Rate limiting, request shaping, response compression
  - Routing to internal services
  - Centralized request logging/trace injection
- Public vs Private:
  - Public: REST/GraphQL with auth
  - Private: gRPC/REST over internal network or service mesh

---

## 📨 Messaging & Event-Driven Architecture
- Broker: Redis Streams, NATS, or Kafka (size dependent)
- Patterns:
  - Outbox pattern to avoid dual-write issues
  - Idempotency keys and deduplication at consumers
  - Dead-letter queues for poison messages
  - Retention policies for replayability
- Event design:
  - `eventType`, `version`, `aggregateId`, `occurredAt`, `payload`
  - Schema evolution with additive changes and deprecation windows

---

## 🤝 Contracts & Schema Governance
- REST/GraphQL: OpenAPI/SDL stored with code, versioned
- Async events: JSON Schema with versioning (e.g., `templator.events.v1.ai.PromptRunRecorded`)
- Consumer-driven contracts (Pact) in CI for providers and consumers
- Backward compatibility tests enforced in pipelines

---

## 🧩 Integration Scenarios
- AI Service:
  - Exposes: `/ai/analyze`, `/ai/generate`, `/ai/rag/query`
  - Emits: `PromptRunRecorded`, `AIErrorsOccurred`
  - Consumes: `TemplateUpdated`, `AssetUploaded`
- Templates Service:
  - Exposes: `/templates`, `/modules`
  - Emits: `TemplatePublished`, `TemplateDeprecated`
- Analytics Service:
  - Exposes: `/metrics`, `/events`
  - Emits: `UsageReportReady`
  - Consumes: All domain events for BI

---

## 🔄 Transactions & Consistency
- Prefer eventual consistency via events
- Use sagas for multi-service workflows (orchestration vs choreography)
- Compensating actions to rollback side effects on failure

---

## 🧪 Testing Strategy (Microservices)
- Unit & Integration inside each service
- Contract tests:
  - HTTP: Pact provider/consumer tests in CI
  - Events: Schema validation + CDC tests
- End-to-end synthetic checks through the gateway
- Resilience tests: fault injection, chaos experiments on non-prod

---

## 📈 Observability
- Tracing: OpenTelemetry with trace propagation across services
- Metrics: RED/SLA metrics per service; error budget alerts
- Logs: Structured logs with `traceId`, `spanId`, `requestId`
- Dashboards: Service-level + cross-service flow views

---

## 🔐 Security
- Zero-trust networking, mTLS between services or service mesh
- Per-service secrets and scoped tokens
- Input validation at edges; PII minimization; audit logging

---

## 🧰 Reference Stack
- Transport: REST (public), gRPC/REST (private)
- Messaging: Redis Streams → Kafka when scale requires
- Config: 12-factor, env + secret manager
- Infra: Docker Compose (dev), Kubernetes (prod), GitHub Actions CI/CD

---

<a id="db-integration"></a>
## 🗄️ Database Integration

Keep service-local data in each service DB. For cross-service reliability use event storage patterns:

- Outbox table (per service):
  - Fields: `id`, `aggregateId`, `eventType`, `version`, `payload`, `status`(PENDING|SENT|FAILED), `retryCount`, `occurredAt`
  - Indexed by `(status, occurredAt)`
  - Background dispatcher publishes to broker, marks SENT, retries with backoff
- Event Store (optional central stream):
  - Append-only for auditing and replay; use partitioning by time
- Idempotency:
  - `idempotency_key` table: `key`, `status`, `responseHash`, `createdAt`, TTL
  - Enforce unique keys per endpoint/consumer to dedupe retried messages
- CDC (alternative to outbox):
  - Use logical decoding (e.g., Debezium) to project changes to topics
- Migrations:
  - Owned by each service; versioned and deployed independently

For schema specifics, see `03-database-architecture.md` for core patterns (indexing, backups) and service blueprints for feature tables.

---

## ✅ Checklist
- [ ] Service boundaries defined with owners
- [ ] Gateway configured with auth and rate limiting
- [ ] Contracts versioned and validated in CI (REST + events)
- [ ] Messaging with outbox, idempotency, DLQ
- [ ] Tracing/metrics/logging across services
- [ ] Saga patterns for cross-service workflows

---

## 🔗 Related
- `06-application-foundation.md`
- `09-ai-pipeline-architecture.md`
- `11-ai-maintenance-and-quality.md`
- `03-database-architecture.md` (Core DB conventions; outbox/idempotency patterns referenced here)
